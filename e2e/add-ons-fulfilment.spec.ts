import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { organiserLogin } from "./helpers";

// What happens to merchandise after the sale: the athlete's per-item refund
// request, the organiser's approve or decline, the picking list, the refund
// queue badge and the export columns.
//
// Fixtures come from the seed rather than being built here, because there is no
// route that creates a purchase: a RegistrationAddOn row is only ever written by
// the Stripe webhook. seed-event-007 carries the catalogue and seven purchases
// across four entries, two of them belonging to the __e2e_bypass "user"
// identity (Jade Nguyen).
//
// The tee carries the reversible round trip — a decline returns it to PURCHASED,
// so this file can run repeatedly without a reseed. The parking pass is the one
// the approve test consumes, because REFUNDED is terminal.
const EVENT_ID = "seed-event-007";
const MANAGE = `/organiser/events/${EVENT_ID}/dashboard?panel=manage`;
const REGISTRATIONS = `/api/organiser/events/${EVENT_ID}/registrations`;

type AddOn = {
  id: string;
  name: string;
  variantLabel: string;
  status: string;
  quantity: number;
  refundAmountCents: number | null;
};

/** The signed-in athlete's own entry on the add-on event, straight from Activity's API. */
async function athleteEntry(api: APIRequestContext) {
  const res = await api.get("/api/user/registrations");
  expect(res.ok(), `user registrations failed (${res.status()})`).toBeTruthy();
  const { registrations } = await res.json();
  const entry = registrations.find(
    (r: { eventId: string }) => r.eventId === EVENT_ID,
  );
  expect(entry, "expected a seeded add-on entry for the e2e athlete").toBeTruthy();
  return entry as {
    id: string;
    eventId: string;
    status: string;
    paidCents: number;
    addOns: AddOn[];
  };
}

async function athleteItem(api: APIRequestContext, name: string): Promise<AddOn> {
  const entry = await athleteEntry(api);
  const item = entry.addOns.find((a) => a.name === name);
  expect(item, `expected a seeded "${name}" on the e2e athlete's entry`).toBeTruthy();
  return item!;
}

function requestRefund(api: APIRequestContext, registrationId: string, itemId: string) {
  return api.post(
    `/api/user/registrations/${registrationId}/add-ons/${itemId}/refund-request`,
    { data: {} },
  );
}

function decide(api: APIRequestContext, itemId: string, decision: "approve" | "decline", reason?: string) {
  return api.post(`/api/organiser/events/${EVENT_ID}/add-ons/refunds/${itemId}`, {
    data: { decision, ...(reason ? { reason } : {}) },
  });
}

const bypassCookie = (identity: "user" | "organiser") => ({
  name: "__e2e_bypass",
  value: identity,
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
});

/**
 * Run `fn` against an API client holding one of the bypass identities, and
 * always close it.
 *
 * A browser context rather than a page: the organiser tests need both identities
 * at once and a signed-in athlete cannot share a context with a signed-in
 * organiser, but none of this needs anything rendered. Going through
 * organiserLogin instead would load and wait on the whole dashboard just to set
 * one cookie. The finally matters: a test.skip inside `fn` throws.
 */
async function asIdentity<T>(
  page: Page,
  identity: "user" | "organiser",
  fn: (api: APIRequestContext) => Promise<T>,
): Promise<T> {
  const context = await page.context().browser()!.newContext();
  await context.addCookies([bypassCookie(identity)]);
  try {
    return await fn(context.request);
  } finally {
    await context.close();
  }
}

const withAthlete = <T>(page: Page, fn: (api: APIRequestContext) => Promise<T>) =>
  asIdentity(page, "user", fn);

/**
 * Put the tee back to PURCHASED so each test starts from the seeded state.
 * Takes only a page, and borrows its browser for both identities, so it reads
 * the same from either describe block.
 */
async function resetTee(page: Page) {
  const item = await withAthlete(page, (api) => athleteItem(api, "Event tee"));
  if (item.status !== "REFUND_REQUESTED") return;
  // Asserted, not fire-and-forget: a silent failure here would surface three
  // lines into whichever test called it, as a confusing 409 on a fresh request.
  await asIdentity(page, "organiser", async (organiser) => {
    const res = await decide(organiser, item.id, "decline");
    expect(res.ok(), `could not reset the tee (${res.status()}): ${await res.text()}`).toBeTruthy();
  });
}

test.describe("athlete per-item refunds", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([bypassCookie("user")]);
  });

  test("Activity lists the extras bought with the entry, apart from the entry money", async ({ page }) => {
    const entry = await athleteEntry(page.request);

    const tee = entry.addOns.find((a) => a.name === "Event tee");
    expect(tee).toBeTruthy();
    // A $25.00 tee with the athlete-borne percentage fee and no fixed component.
    expect(tee!.refundAmountCents).toBe(2599);
    // The entry price stands alone: refunding a shirt must not touch it, and the
    // two numbers are never added together.
    expect(entry.paidCents).toBe(6500 + Math.round(6500 * 0.0395) + 145);

    await page.goto("/activity");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Extras", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/1 x Event tee \(M\)/).first()).toBeVisible();
  });

  test("asks for one item back and leaves the entry alone", async ({ page }) => {
    await resetTee(page);
    const before = await athleteEntry(page.request);
    const tee = before.addOns.find((a) => a.name === "Event tee")!;

    const res = await requestRefund(page.request, before.id, tee.id);
    expect(res.ok(), await res.text()).toBeTruthy();
    expect(await res.json()).toMatchObject({
      status: "REFUND_REQUESTED",
      refundAmountCents: 2599,
    });

    const after = await athleteEntry(page.request);
    expect(after.addOns.find((a) => a.id === tee.id)!.status).toBe("REFUND_REQUESTED");
    // The registration is untouched: same status, same money.
    expect(after.status).toBe(before.status);
    expect(after.paidCents).toBe(before.paidCents);
    // And the other item is untouched too.
    const parking = after.addOns.find((a) => a.name === "Parking pass");
    expect(parking!.status).not.toBe("REFUND_REQUESTED");
  });

  test("refuses a second request while one is already open", async ({ page }) => {
    await resetTee(page);
    const entry = await athleteEntry(page.request);
    const tee = entry.addOns.find((a) => a.name === "Event tee")!;

    expect((await requestRefund(page.request, entry.id, tee.id)).ok()).toBeTruthy();

    const second = await requestRefund(page.request, entry.id, tee.id);
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toMatch(/already asked/i);
  });

  test("refuses an item that is not on the registration in the path", async ({ page }) => {
    const entry = await athleteEntry(page.request);
    const tee = entry.addOns.find((a) => a.name === "Event tee")!;

    const res = await requestRefund(page.request, "seed-addon-reg-0", tee.id);
    expect(res.status()).toBe(404);
  });

  test("refuses an item on somebody else's entry", async ({ page }) => {
    // seed-addon-purchase-0 belongs to Harper Jones, not the signed-in athlete.
    const res = await requestRefund(page.request, "seed-addon-reg-0", "seed-addon-purchase-0");
    expect(res.status()).toBe(404);
  });
});

test.describe("organiser fulfilment", () => {
  test("the Add-ons tab shows the picking list grouped by option", async ({ page }) => {
    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /^add-ons/i }).click();

    await expect(page.getByText(/what to bring/i)).toBeVisible();
    // Grouped by variant, hyphenated, with a unit count per row.
    await expect(page.getByText("Event tee - M", { exact: true })).toBeVisible();
    await expect(page.getByText("Event tee - L", { exact: true })).toBeVisible();
    await expect(page.getByText("Parking pass - Saturday", { exact: true })).toBeVisible();
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
  });

  test("the tab badge counts pending add-on refunds", async ({ page }) => {
    await withAthlete(page, async (athlete) => {
      await resetTee(page);
      const entry = await athleteEntry(athlete);
      const tee = entry.addOns.find((a) => a.name === "Event tee")!;
      expect((await requestRefund(athlete, entry.id, tee.id)).ok()).toBeTruthy();
    });

    await organiserLogin(page);
    await page.goto(MANAGE);
    await page.waitForLoadState("networkidle");

    // Seeded: Aria's tee is already pending, and the athlete above just added one.
    const addOnsTab = page.getByRole("button", { name: /^add-ons/i });
    await expect(addOnsTab).toContainText("2");

    await addOnsTab.click();
    await expect(page.getByText(/add-on refund requests/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /approve/i }).first()).toBeVisible();
  });

  test("a decline returns the item to PURCHASED and charges nothing", async ({ page }) => {
    await withAthlete(page, async (athlete) => {
      await resetTee(page);
      const entry = await athleteEntry(athlete);
      const tee = entry.addOns.find((a) => a.name === "Event tee")!;
      expect((await requestRefund(athlete, entry.id, tee.id)).ok()).toBeTruthy();

      await organiserLogin(page);
      const res = await decide(page.request, tee.id, "decline", "Already collected from the merch tent");
      expect(res.ok(), await res.text()).toBeTruthy();
      expect(await res.json()).toMatchObject({ status: "PURCHASED" });

      // The athlete keeps the shirt, and can ask again.
      const after = await athleteItem(athlete, "Event tee");
      expect(after.status).toBe("PURCHASED");
      expect((await requestRefund(athlete, entry.id, tee.id)).ok()).toBeTruthy();
    });
  });

  test("refuses to decide an item with no open request", async ({ page }) => {
    const tee = await withAthlete(page, async (athlete) => {
      await resetTee(page);
      return athleteItem(athlete, "Event tee");
    });

    await organiserLogin(page);
    const res = await decide(page.request, tee.id, "approve");
    expect(res.status()).toBe(409);
  });

  // Approving is terminal, so this consumes the parking pass rather than the tee.
  // The seeded entry carries no PaymentIntent, so the route takes its comped
  // branch and settles without calling Stripe. The Stripe path itself — the
  // expanded charge, reverse_transfer, the explicit amount and the idempotency
  // key — is covered in src/__tests__/add-on-refund-routes.test.ts.
  test("an approval settles the item and takes it off the picking list", async ({ page }) => {
    const parkingId = await withAthlete(page, async (athlete) => {
      const entry = await athleteEntry(athlete);
      const parking = entry.addOns.find((a) => a.name === "Parking pass")!;
      test.skip(
        parking.status === "REFUNDED",
        "already approved by an earlier local run; reseed to re-test",
      );

      if (parking.status === "PURCHASED") {
        expect((await requestRefund(athlete, entry.id, parking.id)).ok()).toBeTruthy();
      }

      await organiserLogin(page);
      const res = await decide(page.request, parking.id, "approve");
      expect(res.ok(), await res.text()).toBeTruthy();
      expect(await res.json()).toMatchObject({ status: "REFUNDED" });

      expect((await athleteItem(athlete, "Parking pass")).status).toBe("REFUNDED");
      // The entry is untouched, which is the whole point of per-item refunds.
      expect((await athleteEntry(athlete)).paidCents).toBe(entry.paidCents);
      return parking.id;
    });

    // A second approval cannot go through, so a retry never refunds twice.
    const retry = await decide(page.request, parkingId, "approve");
    expect(retry.status()).toBe(409);
  });
});

test.describe("exports carry the add-on columns", () => {
  test("the machine CSV names what was bought and what it cost", async ({ page }) => {
    await organiserLogin(page);
    const res = await page.request.get(
      `/api/organiser/events/${EVENT_ID}/registrations/export?format=csv`,
    );
    expect(res.ok(), `export failed (${res.status()})`).toBeTruthy();

    const csv = await res.text();
    const [header, ...rows] = csv.trim().split("\n");
    const columns = header.split(",");
    expect(columns).toContain("addOns");
    expect(columns).toContain("addOnsPaidAud");

    const addOnsIndex = columns.indexOf("addOns");
    const cells = rows.map((r) => r.split(",")[addOnsIndex] ?? "");
    // Semicolon-separated, so a multi-item cell never splits the CSV.
    expect(cells.some((c) => c.includes("Event tee - M"))).toBe(true);
  });

  test("the registrations API keeps merchandise money out of the entry total", async ({ page }) => {
    await organiserLogin(page);
    const res = await page.request.get(REGISTRATIONS);
    expect(res.ok()).toBeTruthy();
    const { registrations } = await res.json();

    const buyer = registrations.find(
      (r: { name: string }) => r.name === "Harper Jones",
    );
    expect(buyer, "expected the seeded add-on buyer").toBeTruthy();
    // Entry only: a $65.00 ticket plus the athlete-borne booking fee.
    expect(buyer.amount).toBeCloseTo((6500 + Math.round(6500 * 0.0395) + 145) / 100, 2);
    // Merchandise is reported separately: a $25.00 tee and a $12.00 parking pass,
    // each with the percentage-only add-on fee.
    expect(buyer.addOnAmount).toBeCloseTo(
      (2500 + Math.round(2500 * 0.0395) + 1200 + Math.round(1200 * 0.0395)) / 100,
      2,
    );
    expect(buyer.addOns).toHaveLength(2);
  });
});
