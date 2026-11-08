import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { organiserLogin, ensureDatabaseUrl } from "./helpers";

ensureDatabaseUrl();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const createdIds: string[] = [];

const listing = (title: string) => ({
  title,
  discipline: "Running",
  eventDate: "2027-06-14",
  startTime: "07:00",
  endTime: "10:00",
  venue: "Albert Park",
  city: "Melbourne",
  state: "VIC",
  format: "Individual",
  level: "All levels",
  registrationType: "startline",
  waves: [{ label: "General", price: "0", closes: "", startTime: "" }],
});

async function createEvent(
  page: Parameters<typeof organiserLogin>[0],
  title: string,
  submit: boolean,
) {
  const res = await page.request.post("/api/organiser/events", {
    data: { ...listing(title), submit },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const body = await res.json();
  createdIds.push(body.id);
  return body.id as string;
}

async function setStatus(id: string, status: "PENDING" | "REJECTED" | "IN_PROGRESS" | "ARCHIVED") {
  await prisma.event.update({ where: { id }, data: { status } });
}

test.afterEach(async () => {
  if (createdIds.length === 0) return;
  await prisma.event.deleteMany({ where: { id: { in: createdIds } } });
  createdIds.length = 0;
});

test.describe("organiser event edit policy", () => {
  // Published events are editable again (#490). Every edit is logged, and a
  // material change with paid entrants needs confirming: see event-edit.spec.ts.
  test("opens a published event in the wizard and keeps it live on save", async ({ page }) => {
    await organiserLogin(page);
    const title = `E2E Published Edit ${Date.now()}`;
    const id = await createEvent(page, title, true);

    await page.goto(`/organiser/new-listing?id=${id}`);

    await expect(page.getByPlaceholder(/Apex Throwdown/i)).toHaveValue(title);
    await expect(page.getByText("Editing is locked")).toHaveCount(0);

    const res = await page.request.patch(`/api/organiser/events/${id}`, {
      data: { title: `${title} changed` },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).status).toBe("APPROVED");
  });

  test("blocks an in-progress event", async ({ page }) => {
    await organiserLogin(page);
    const id = await createEvent(page, `E2E In Progress Lock ${Date.now()}`, false);
    const now = Date.now();
    await prisma.event.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        eventDate: new Date(now - 86_400_000).toISOString().slice(0, 10),
        endDate: new Date(now + 86_400_000).toISOString().slice(0, 10),
        startsAtUtc: new Date(now - 86_400_000),
        endsAtUtc: new Date(now + 86_400_000),
      },
    });

    await page.goto(`/organiser/new-listing?id=${id}`);

    await expect(page.getByText("Editing is locked")).toBeVisible();
    await expect(page.getByText(/Events that are underway can't be edited/)).toBeVisible();

    const res = await page.request.patch(`/api/organiser/events/${id}`, {
      data: { title: "Changed while running" },
    });
    expect(res.status()).toBe(409);
  });

  test("blocks an archived event", async ({ page }) => {
    await organiserLogin(page);
    const id = await createEvent(page, `E2E Archived Lock ${Date.now()}`, false);
    await setStatus(id, "ARCHIVED");

    await page.goto(`/organiser/new-listing?id=${id}`);

    await expect(page.getByText("Editing is locked")).toBeVisible();
    await expect(page.getByText(/Archived events can't be edited/)).toBeVisible();
  });

  test("keeps the pending edit path without moving the event out of review", async ({ page }) => {
    await organiserLogin(page);
    const title = `E2E Pending Edit ${Date.now()}`;
    const id = await createEvent(page, title, false);
    await setStatus(id, "PENDING");

    await page.goto(`/organiser/new-listing?id=${id}`);

    await expect(page.getByPlaceholder(/Apex Throwdown/i)).toHaveValue(title);
    await expect(page.getByText("Editing is locked")).toHaveCount(0);

    const res = await page.request.patch(`/api/organiser/events/${id}`, {
      data: { title: `${title} edited`, submit: false },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).status).toBe("PENDING");
  });

  test("lets a rejected event be edited and resubmitted into review", async ({ page }) => {
    await organiserLogin(page);
    const title = `E2E Rejected Edit ${Date.now()}`;
    const id = await createEvent(page, title, false);
    await setStatus(id, "REJECTED");

    await page.goto(`/organiser/new-listing?id=${id}`);
    await expect(page.getByPlaceholder(/Apex Throwdown/i)).toHaveValue(title);

    const res = await page.request.patch(`/api/organiser/events/${id}`, {
      data: { ...listing(`${title} resubmitted`), submit: true },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).status).toBe("PENDING");
  });
});
