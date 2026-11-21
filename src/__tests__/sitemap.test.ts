import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { headersMock, eventFindMany } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: () => headersMock() }));
vi.mock("@/lib/prisma", () => ({ default: { event: { findMany: eventFindMany } } }));

import sitemap from "@/app/sitemap";

const SITE = "https://www.startlineau.com";
const urls = (entries: { url: string }[]) => entries.map((e) => e.url);

function onHost(host: string) {
  headersMock.mockResolvedValue(new Headers({ host }));
}

beforeEach(() => {
  headersMock.mockReset();
  eventFindMany.mockReset();
  eventFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap.xml (#547)", () => {
  it("is empty on a host that is not a production portal", async () => {
    onHost("main.d1xamplifyapp.com.amplifyapp.com");
    vi.stubEnv("PUBLIC_SITE_MODE", "live");
    expect(await sitemap()).toEqual([]);
    expect(eventFindMany).not.toHaveBeenCalled();
  });

  it("lists only the waitlist and legal pages while waitlisted", async () => {
    onHost("startlineau.com");
    vi.stubEnv("PUBLIC_SITE_MODE", "");
    expect(urls(await sitemap())).toEqual([
      `${SITE}/`, `${SITE}/terms`, `${SITE}/privacy`, `${SITE}/cookies`,
    ]);
    expect(eventFindMany).not.toHaveBeenCalled();
  });

  it("lists the public site and its published events once live", async () => {
    onHost("www.startlineau.com");
    vi.stubEnv("PUBLIC_SITE_MODE", "live");
    const updatedAt = new Date("2026-11-01T00:00:00Z");
    eventFindMany.mockResolvedValue([
      { id: "evt-1", slug: "sydney-harbour-10k", updatedAt },
      { id: "evt-2", slug: null, updatedAt },
    ]);

    const entries = await sitemap();

    expect(urls(entries)).toEqual(expect.arrayContaining([
      `${SITE}/`, `${SITE}/events`, `${SITE}/about`, `${SITE}/contact`, `${SITE}/faq`,
      `${SITE}/events/sydney-harbour-10k`, `${SITE}/events/evt-2`,
    ]));
    expect(entries.find((e) => e.url.endsWith("/sydney-harbour-10k"))?.lastModified).toBe(updatedAt);
    // Only what discovery shows: published, not finished, approved organiser.
    expect(eventFindMany.mock.calls[0][0].where).toMatchObject({
      status: { in: ["APPROVED", "IN_PROGRESS"] },
      organiser: { status: "APPROVED" },
    });
  });

  it("keeps the static pages when the events query fails", async () => {
    onHost("startlineau.com");
    vi.stubEnv("PUBLIC_SITE_MODE", "live");
    eventFindMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(urls(await sitemap())).toContain(`${SITE}/about`);
  });
});
