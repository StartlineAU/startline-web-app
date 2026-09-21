import { test, expect, type Page } from "@playwright/test";
import { organiserLogin, adminLogin } from "./helpers";

// Sarah Mitchell's own event, so the ownership guard on the route passes.
const EVENT_ID = "seed-event-001";
const CATALOGUE = `/api/organiser/events/${EVENT_ID}/add-ons`;

/** Leaves the seeded event with no merchandise, so each test starts level. */
async function clearCatalogue(page: Page): Promise<void> {
  const res = await page.request.put(CATALOGUE, { data: { addOns: [] } });
  expect(res.ok()).toBeTruthy();
}

/** Step 3 of the wizard, where the merchandise section lives. */
async function openTicketsStep(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.getByText("Tickets & Pricing").first().click();
  await expect(page.getByText(/registration platform/i).first()).toBeVisible();
}

test.describe("organiser add-on catalogue", () => {
  test("the merchandise editor is on the tickets step of the organiser wizard", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");

    const addProduct = page.getByRole("button", { name: /add merchandise/i });
    await expect(addProduct).toBeVisible();
    await addProduct.click();

    // A new product starts on sizes, because most merchandise is sized.
    await expect(page.getByLabel("Option name 1")).toHaveValue("S");
    await expect(page.getByLabel("Option name 2")).toHaveValue("M");
    await expect(page.getByLabel("Option name 3")).toHaveValue("L");
  });

  test("the merchandise editor is absent from the admin wizard", async ({ page }) => {
    await adminLogin(page);
    await openTicketsStep(page, "/admin/events/create");

    // The admin portal has no add-ons route, so the section must not render.
    await expect(page.getByRole("button", { name: /add merchandise/i })).toHaveCount(0);
  });

  test("shows the Startline fee on a priced item as a percentage with no fixed charge", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");
    await page.getByRole("button", { name: /add merchandise/i }).click();

    await page.locator("#addon-name-0").fill("Event tee");
    await page.locator("#addon-price-0").fill("25.00");

    // 3.95% of $25.00, percentage only: the $1.45 fixed component belongs to the
    // entry, and the add-on rides on the same charge.
    await expect(page.getByText(/3\.95% of \$25\.00 is \$0\.99/)).toBeVisible();
    await expect(page.getByText(/no fixed charge applies to add-ons/i)).toBeVisible();
    await expect(page.getByText(/the athlete pays \$25\.99/i)).toBeVisible();
  });

  test("adds and removes option rows", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");
    await page.getByRole("button", { name: /add merchandise/i }).click();

    await page.getByRole("button", { name: /^add size$/i }).click();
    await expect(page.getByLabel("Option name 4")).toBeVisible();

    await page.getByRole("button", { name: /remove this option/i }).last().click();
    await expect(page.getByLabel("Option name 4")).toHaveCount(0);
  });

  test("reorders products and option values", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");

    await page.getByRole("button", { name: /add merchandise/i }).click();
    await page.locator("#addon-name-0").fill("Event tee");
    await page.getByRole("button", { name: /add merchandise/i }).click();
    await page.locator("#addon-name-1").fill("Cap");

    // Products: the order here is the order athletes see.
    await page.getByRole("button", { name: /^move cap up$/i }).click();
    await expect(page.locator("#addon-name-0")).toHaveValue("Cap");
    await expect(page.locator("#addon-name-1")).toHaveValue("Event tee");

    // Option values within a product: S, M, L becomes M, S, L.
    await page.getByRole("button", { name: /^move option 2 up$/i }).first().click();
    await expect(page.getByLabel("Option name 1").first()).toHaveValue("M");
    await expect(page.getByLabel("Option name 2").first()).toHaveValue("S");

    // The ends are dead: nothing to move past.
    await expect(page.getByRole("button", { name: /^move option 1 up$/i }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: /^move cap up$/i })).toBeDisabled();
  });

  // A 1x1 PNG, enough for the browser to decode and report naturalWidth.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  test("a chosen photo survives leaving the step and coming back", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");
    await page.getByRole("button", { name: /add merchandise/i }).click();

    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles({ name: "tee.png", mimeType: "image/png", buffer: PNG });

    const preview = page.locator('button[aria-label="Photo for add-on 1"] img');
    await expect(preview).toBeVisible();

    // Leave the step and come back. The object URL is minted in an effect and
    // revoked by that same effect, so a remount has to mint a live one: the
    // memoised version was revoked by StrictMode with no re-render to replace
    // it, and the photo came back as a broken image.
    await page.getByText("The Basics").first().click();
    await expect(page.getByRole("button", { name: /add merchandise/i })).toHaveCount(0);
    await page.getByText("Tickets & Pricing").first().click();

    await expect(preview).toBeVisible();
    // A revoked blob URL still renders an <img>; only naturalWidth tells the
    // truth about whether the bytes actually loaded.
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("rejects a photo over the upload cap at pick time", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");
    await page.getByRole("button", { name: /add merchandise/i }).click();

    // Uploads are deferred to save, so an oversized file has to be refused here
    // rather than five steps later.
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(6 * 1024 * 1024, 1),
      });

    await expect(page.getByText(/photo must be 5 MB or smaller/i)).toBeVisible();
    await expect(page.locator('button[aria-label="Photo for add-on 1"] img')).toHaveCount(0);
  });

  test("a photo and its rejection stay with the product through a reorder", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");

    await page.getByRole("button", { name: /add merchandise/i }).click();
    await page.locator("#addon-name-0").fill("Event tee");
    await page.getByRole("button", { name: /add merchandise/i }).click();
    await page.locator("#addon-name-1").fill("Cap");

    // Give the tee a good photo and the cap an oversized one.
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "tee.png", mimeType: "image/png", buffer: PNG });
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(6 * 1024 * 1024, 1),
      });

    // The rejection message is a sibling of its own product's photo button, so
    // this says which product is showing it, not merely that one is.
    const rejection = (slot: number) =>
      page.locator(`div:has(> button[aria-label="Photo for add-on ${slot}"]) > p`);
    const photo = (slot: number) => page.locator(`button[aria-label="Photo for add-on ${slot}"] img`);

    await expect(photo(1)).toBeVisible();
    // Every photo slot states the rule; only a rejected one turns red.
    await expect(rejection(1)).toHaveText(/JPG, PNG or WebP, up to 5 MB/i);
    await expect(rejection(2)).toHaveText(/photo must be 5 MB or smaller/i);

    // Move the cap above the tee. Rows are keyed on a stable draft key, so both
    // the preview and the rejection follow their product. Keyed on the array
    // index they stay with the slot instead, and the cap's rejection would then
    // be displayed under the tee.
    await page.getByRole("button", { name: /^move cap up$/i }).click();
    await expect(page.locator("#addon-name-0")).toHaveValue("Cap");

    // Slot 1 is now the cap: its rejection came with it, and it still has no photo.
    await expect(rejection(1)).toHaveText(/photo must be 5 MB or smaller/i);
    await expect(photo(1)).toHaveCount(0);

    // Slot 2 is the tee, photo intact and no rejection of its own.
    await expect(photo(2)).toBeVisible();
    await expect(rejection(2)).toHaveText(/JPG, PNG or WebP, up to 5 MB/i);
    await expect
      .poll(() => photo(2).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("blocks a save that the server would reject anyway", async ({ page }) => {
    await organiserLogin(page);
    await openTicketsStep(page, "/organiser/new-listing");
    await page.getByRole("button", { name: /add merchandise/i }).click();

    // A product with no name and no price: the editor has to say so before the
    // event is written, not after.
    await page.getByRole("button", { name: /save draft/i }).click();
    await expect(page.getByText("Every add-on needs a name.")).toBeVisible();
  });

  test("saves a catalogue through its own route and reads back derived stock", async ({ page }) => {
    await organiserLogin(page);
    await clearCatalogue(page);

    const put = await page.request.put(CATALOGUE, {
      data: {
        addOns: [
          {
            name: "Event tee",
            description: "Unisex fit",
            priceCents: 2500,
            imageUrl: null,
            optionLabel: "Size",
            variants: [
              { label: "M", stock: 10 },
              { label: "L", stock: 4 },
            ],
          },
        ],
      },
    });
    expect(put.ok()).toBeTruthy();

    const { addOns } = await (await page.request.get(CATALOGUE)).json();
    expect(addOns).toHaveLength(1);
    expect(addOns[0]).toMatchObject({ name: "Event tee", priceCents: 2500, optionLabel: "Size" });
    // Nothing sold yet, so remaining is the full declared stock.
    expect(addOns[0].variants.map((v: { label: string; remaining: number }) => [v.label, v.remaining]))
      .toEqual([["M", 10], ["L", 4]]);
    // Every variant gets a random six-character code, unique within the event.
    const codes = addOns[0].variants.map((v: { code: string }) => v.code);
    expect(codes.every((c: string) => /^[a-z0-9]{6}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);

    await clearCatalogue(page);
  });

  test("an edit keeps existing ids and reorders by position", async ({ page }) => {
    await organiserLogin(page);
    await clearCatalogue(page);

    const product = (name: string) => ({
      name,
      description: null,
      priceCents: 1500,
      imageUrl: null,
      optionLabel: "Size",
      variants: [{ label: "One size", stock: 5 }],
    });

    const first = await (
      await page.request.put(CATALOGUE, { data: { addOns: [product("Event tee"), product("Cap")] } })
    ).json();
    const [tee, cap] = first.addOns;
    expect(tee.sortOrder).toBe(0);
    expect(cap.sortOrder).toBe(1);

    // Swap them and restock the tee, keeping both ids.
    const second = await (
      await page.request.put(CATALOGUE, {
        data: {
          addOns: [
            { ...product("Cap"), id: cap.id, variants: [{ id: cap.variants[0].id, label: "One size", stock: 5 }] },
            { ...product("Event tee"), id: tee.id, variants: [{ id: tee.variants[0].id, label: "One size", stock: 9 }] },
          ],
        },
      })
    ).json();

    expect(second.addOns.map((a: { id: string }) => a.id)).toEqual([cap.id, tee.id]);
    expect(second.addOns[1].variants[0].id).toBe(tee.variants[0].id);
    expect(second.addOns[1].variants[0].remaining).toBe(9);
    // The codes are stable across the edit: an in-flight payment still resolves.
    expect(second.addOns[1].variants[0].code).toBe(tee.variants[0].code);

    await clearCatalogue(page);
  });

  test("rejects a catalogue the sanitizer refuses", async ({ page }) => {
    await organiserLogin(page);

    const res = await page.request.put(CATALOGUE, {
      data: { addOns: [{ name: "Event tee", priceCents: 2500, optionLabel: "Size", variants: [] }] },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/needs at least one size option/i);
  });

  test("refuses to manage another organiser's catalogue", async ({ page }) => {
    await organiserLogin(page);

    // seed-event-006 belongs to Coastal Fitness Collective, not Sarah's organiser.
    const res = await page.request.get("/api/organiser/events/seed-event-006/add-ons");
    expect([403, 404]).toContain(res.status());
  });
});
