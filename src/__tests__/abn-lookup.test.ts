import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { lookupAbn } from "@/lib/abn";
import { getServerSession } from "@/lib/amplify-server";
import { rateLimitPaid } from "@/lib/rate-limit";
import { GET } from "@/app/api/abn/route";

vi.mock("@/lib/amplify-server", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitPaid: vi.fn() }));

const sessionMock = getServerSession as ReturnType<typeof vi.fn>;
const rateLimitMock = rateLimitPaid as ReturnType<typeof vi.fn>;

const GUID = "test-guid";
const ABN = "51 824 753 556";
const ABN_DIGITS = "51824753556";

const abrReply = (over: Record<string, unknown> = {}) =>
  `callback(${JSON.stringify({
    Abn: ABN_DIGITS,
    AbnStatus: "Active",
    AbnStatusEffectiveFrom: "2000-11-01",
    Acn: "824753556",
    AddressPostcode: "3000",
    AddressState: "VIC",
    BusinessName: [],
    EntityName: "EXAMPLE PTY LTD",
    EntityTypeCode: "PRV",
    EntityTypeName: "Australian Private Company",
    Gst: "2000-11-01",
    Message: "",
    ...over,
  })})`;

const fetchMock = vi.fn();

const reply = (body: string, ok = true, status = 200) =>
  fetchMock.mockResolvedValue({ ok, status, text: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.ABR_GUID = GUID;
  sessionMock.mockResolvedValue({ sub: "org-1" });
  rateLimitMock.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.ABR_GUID;
  vi.unstubAllGlobals();
});

describe("lookupAbn", () => {
  it("calls the live ABR JSON endpoint with the ABN and GUID", async () => {
    reply(abrReply());

    await lookupAbn(ABN);

    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe("https://abr.business.gov.au/json/AbnDetails.aspx");
    expect(url.searchParams.get("abn")).toBe(ABN_DIGITS);
    expect(url.searchParams.get("guid")).toBe(GUID);
  });

  // The old endpoint answered with a 302 to /Error/NotFound (#354), so this
  // asserts the false premise that produced the bug cannot come back.
  it("does not use the retired /abn/json endpoint", async () => {
    reply(abrReply());

    await lookupAbn(ABN);

    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/abn/json");
  });

  it("maps the JSONP reply onto the organiser-facing fields", async () => {
    reply(abrReply());

    expect(await lookupAbn(ABN)).toEqual({
      abn: ABN_DIGITS,
      entityName: "EXAMPLE PTY LTD",
      entityType: "Australian Private Company",
      status: "Active",
      state: "VIC",
      postcode: "3000",
    });
  });

  it("strips whitespace from the ABN before it queries ABR", async () => {
    reply(abrReply());

    await lookupAbn("  51 824 753 556  ");

    expect((fetchMock.mock.calls[0][0] as URL).searchParams.get("abn")).toBe(ABN_DIGITS);
  });

  it("falls back to the first registered business name", async () => {
    reply(abrReply({
      EntityName: "",
      BusinessName: [
        { OrganisationName: "EXAMPLE TRADING" },
        { OrganisationName: "EXAMPLE SECOND" },
      ],
    }));

    expect((await lookupAbn(ABN))?.entityName).toBe("EXAMPLE TRADING");
  });

  // ABR's JSON service is expected to wrap replies, but the wrapper is not a
  // contract we control, so plain JSON must keep working too.
  it("accepts an unwrapped JSON reply", async () => {
    reply(JSON.stringify({
      Abn: ABN_DIGITS,
      AbnStatus: "Cancelled",
      AddressPostcode: "2000",
      AddressState: "NSW",
      EntityName: "EXAMPLE PTY LTD",
      EntityTypeName: "Australian Private Company",
    }));

    expect((await lookupAbn(ABN))?.status).toBe("Cancelled");
  });

  it("returns null for an ABR error reply", async () => {
    reply(abrReply({ Abn: "", Message: "Search text is not a valid ABN or ACN" }));

    expect(await lookupAbn("123")).toBeNull();
  });

  it("returns null when ABR answers non-2xx", async () => {
    reply("", false, 404);

    expect(await lookupAbn(ABN)).toBeNull();
  });

  // A redirect that lands on an HTML error page is what the stale endpoint did,
  // so an unparseable body must not throw out of the lookup.
  it("returns null when the body is not JSON", async () => {
    reply("<html><body>Not Found</body></html>");

    expect(await lookupAbn(ABN)).toBeNull();
  });

  it("returns null without calling ABR when no GUID is configured", async () => {
    delete process.env.ABR_GUID;

    expect(await lookupAbn(ABN)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not let the ABN string inject extra query parameters", async () => {
    reply(abrReply());

    await lookupAbn(`${ABN_DIGITS}&guid=someone-elses-guid`);

    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get("guid")).toBe(GUID);
    expect(url.searchParams.get("abn")).toBe(`${ABN_DIGITS}&guid=someone-elses-guid`);
  });
});

describe("GET /api/abn", () => {
  const get = (query: string) => GET(new NextRequest(`http://localhost/api/abn${query}`));

  // #429: the route only serves signed-in organisers so an anonymous caller
  // cannot burn the ABR quota.
  it("answers 401 when nobody is signed in", async () => {
    sessionMock.mockResolvedValue(null);

    const res = await get(`?abn=${ABN_DIGITS}`);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 429 when the paid-lookup limiter blocks the call", async () => {
    rateLimitMock.mockResolvedValue(
      NextResponse.json({ error: "Too many requests." }, { status: 429 }),
    );

    const res = await get(`?abn=${ABN_DIGITS}`);

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the lookup result", async () => {
    reply(abrReply());

    const res = await get(`?abn=${ABN_DIGITS}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ abn: ABN_DIGITS, entityName: "EXAMPLE PTY LTD" });
  });

  it("answers 400 without an abn query parameter", async () => {
    expect((await get("")).status).toBe(400);
  });

  it("answers 503 when the GUID is not configured", async () => {
    delete process.env.ABR_GUID;

    expect((await get(`?abn=${ABN_DIGITS}`)).status).toBe(503);
  });

  it("answers 404 when ABR does not recognise the ABN", async () => {
    reply(abrReply({ Abn: "", Message: "Search text is not a valid ABN or ACN" }));

    expect((await get("?abn=123")).status).toBe(404);
  });
});
