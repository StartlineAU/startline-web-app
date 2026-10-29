import { test, expect, type Page } from "@playwright/test";

const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

async function stubGeocode(page: Page, result: { latitude: number; longitude: number } | null, delay = 0) {
  await page.route("**/api/places/geocode**", async (route) => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ json: { result } });
  });
}

/** Make the browser's location request fail with one GeolocationPositionError code. */
async function stubGeolocationFailure(page: Page, code: 1 | 2 | 3) {
  await page.addInitScript((errorCode) => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, failure?: PositionErrorCallback) => {
          failure?.({
            code: errorCode,
            message: "",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    });
  }, code);
}

async function searchWhere(page: Page, query: string) {
  await page.getByPlaceholder("State, city, or suburb").fill(query);
  await page.keyboard.press("Enter");
}

test.describe("distance-based search", () => {
  test("geocoding a valid suburb sorts events closest-first and shows distance badges", async ({ page }) => {
    await stubGeocode(page, SYDNEY);
    await page.goto("/events?view=list");
    await expect(page.getByPlaceholder("State, city, or suburb")).toBeVisible();

    await searchWhere(page, "Sydney");

    // Distance badges appear once geocoding succeeds.
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });

    // Sydney events are all near the origin — badges read like "0km away".
    // Poll the settled list instead of snapshotting allTextContents mid-render.
    await expect
      .poll(async () => {
        const texts = await page.locator('[data-testid="event-distance"]').allTextContents();
        return texts.length > 0 && texts.every((t) => /^[\d.]+km away$/.test(t));
      }, { timeout: 10000 })
      .toBe(true);
  });

  test("loading state shows a spinner while geocoding", async ({ page }) => {
    await stubGeocode(page, SYDNEY, 1500);
    await page.goto("/events?view=list");
    await expect(page.getByPlaceholder("State, city, or suburb")).toBeVisible();

    await searchWhere(page, "Sydney");

    await expect(page.locator('[data-testid="geocoding-spinner"]').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });
  });

  test("falls back to substring matching when geocoding fails", async ({ page }) => {
    await stubGeocode(page, null);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "Sydney");

    // No distance badges (geocode returned nothing), but substring filtering still applies.
    await expect(page.locator('[data-testid="event-distance"]').first()).toHaveCount(0);
    await expect(page.getByText(/Sydney Harbour 10K/).first()).toBeVisible();
  });

  test("unknown suburb without geocode results shows no events and empty state", async ({ page }) => {
    await stubGeocode(page, null);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "zzz-no-such-place");

    await expect(page.getByText("No events matched your search.").first()).toBeVisible({ timeout: 10000 });
    // A dead end is no use: the empty state falls back to the whole listing.
    await expect(page.getByText("All events").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible();
  });

  test("a suburb far from all events still shows the closest events", async ({ page }) => {
    const PERTH = { latitude: -31.9522, longitude: 115.8589 };
    await stubGeocode(page, PERTH);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "Perth");

    // The radius cap is dropped for geocoded search — events still appear,
    // sorted closest-first, with a "closest events" heading.
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/closest event/i).first()).toBeVisible();
  });

  // #352: a suburb with no events of its own must still produce the closest
  // events, ordered by distance. St Kilda is the reported example.
  test("a no-event suburb pressed into the where field sorts events by distance", async ({ page }) => {
    const ST_KILDA = { latitude: -37.8679, longitude: 144.9811 };
    await stubGeocode(page, ST_KILDA);
    await page.route("**/api/events/suburbs**", (route) =>
      route.fulfill({ json: { nearby: false, results: [] } }),
    );
    await page.goto("/events?view=list");
    await expect(page.getByPlaceholder("State, city, or suburb")).toBeVisible();

    await searchWhere(page, "St Kilda");

    await expect(page.getByText(/closest events to St Kilda/i).first()).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => {
        // The map tab keeps a hidden copy of the card list mounted, so only the
        // visible list is in distance order.
        const texts = await page
          .locator('[data-testid="event-distance"]')
          .filter({ visible: true })
          .allTextContents();
        const km = texts.map((text) => Number.parseFloat(text.replace(/km.*/i, "")));
        if (km.length < 2 || km.some((value) => Number.isNaN(value))) return false;
        return km.every((value, index) => index === 0 || km[index - 1] <= value);
      }, { timeout: 10000 })
      .toBe(true);
  });

  test("typing in the where field suggests suburbs that host events", async ({ page }) => {
    await page.route("**/api/events/suburbs**", (route) =>
      route.fulfill({
        json: {
          nearby: false,
          results: [{ city: "Perth", state: "wa", eventCount: 3 }],
        },
      }),
    );
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("State, city, or suburb").fill("Per");

    await expect(page.getByRole("button", { name: /Perth, WA/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /3 events/ })).toBeVisible();
  });

  test("where field offers the nearest hosting suburbs when none match", async ({ page }) => {
    await page.route("**/api/events/suburbs**", (route) =>
      route.fulfill({
        json: {
          nearby: true,
          searched: "Parramatta",
          results: [{ city: "Sydney", state: "nsw", eventCount: 4, distanceKm: 23 }],
        },
      }),
    );
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("State, city, or suburb").fill("Parramatta");

    await expect(page.getByText(/No events in Parramatta/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Sydney, NSW/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /23 km/ })).toBeVisible();
  });

  test("clearing the where input resets to normal listing", async ({ page }) => {
    await stubGeocode(page, SYDNEY);
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await searchWhere(page, "Sydney");
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });

    // Clear the input via the X button.
    await page.getByRole("button", { name: "Clear where" }).first().click();
    await expect(page.locator('[data-testid="event-distance"]').first()).toHaveCount(0);
    await expect(page.getByText(/events found/i).first()).toBeVisible();
  });

  test("use my location button triggers device geolocation", async ({ page }) => {
    await stubGeocode(page, SYDNEY);
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: SYDNEY.latitude, longitude: SYDNEY.longitude });
    await page.goto("/events?view=list");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Use my current location" }).first().click();

    // GPS resolves to the device position — distance badges appear.
    await expect(page.locator('[data-testid="event-distance"]').first()).toBeVisible({ timeout: 10000 });
  });

  // #352: a failed locate from the home page used to blank the Where field with
  // no explanation. The home button hands off to the listing, so testing the
  // handoff also covers the auto-search path that page uses.
  const locationFailures = [
    { code: 1 as const, message: /location access was denied/i },
    { code: 2 as const, message: /location is unavailable/i },
    { code: 3 as const, message: /took too long/i },
  ];

  for (const failure of locationFailures) {
    test(`home locate explains geolocation error ${failure.code}`, async ({ page }) => {
      await stubGeolocationFailure(page, failure.code);
      await page.goto("/");

      await page
        .getByRole("button", { name: "Use my current location" })
        .filter({ visible: true })
        .first()
        .click();

      await expect(page).toHaveURL(/\/events\?.*where=Current/);
      const alert = page.getByTestId("location-error");
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(failure.message);
      // The request failed, but the search text is not silently erased.
      await expect(page.getByPlaceholder("State, city, or suburb").first()).toHaveValue("Current location");
    });
  }

  test("editing the where field clears a location error", async ({ page }) => {
    await stubGeolocationFailure(page, 1);
    await page.goto("/events?where=Current+location");

    await expect(page.getByTestId("location-error")).toBeVisible();
    await page.getByPlaceholder("State, city, or suburb").first().fill("Melbourne");

    await expect(page.getByTestId("location-error")).toHaveCount(0);
  });
});
