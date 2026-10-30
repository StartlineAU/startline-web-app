// Australian Business Register (ABR) ABN lookup.
// Register for a free GUID at: https://abr.business.gov.au/Tools/WebServicesRegister
// Set ABR_GUID in your environment variables.
//
// The ABR retired the old `/abn/json` endpoint in favour of the JSON service
// documented at https://abr.business.gov.au/json/. The retired path now answers
// with a 302 to `/Error/NotFound`, which is why every lookup failed (#354).
// The live endpoint always replies as JSONP — `callback({...})` — even when no
// callback is named, so the body has to be unwrapped before it can be parsed.

export interface AbnResult {
  abn:        string;
  entityName: string;
  entityType: string;
  status:     "Active" | "Cancelled" | string;
  state:      string;
  postcode:   string;
}

const ABR_LOOKUP_URL = "https://abr.business.gov.au/json/AbnDetails.aspx";

// The JSONP wrapper is the service's choice rather than part of the contract
// we depend on, so accept a plain JSON body too.
function parseBody(body: string): Record<string, unknown> | null {
  const trimmed = body.trim();
  const jsonp   = trimmed.match(/^[A-Za-z_$][\w$]*\s*\(([\s\S]*)\)\s*;?$/);

  try {
    const parsed: unknown = JSON.parse(jsonp ? jsonp[1] : trimmed);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ABR reports the trading name as a list of registered business names. The
// first one is the fallback when the entity itself has no name.
function firstBusinessName(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const first: unknown = value[0];
  if (!first || typeof first !== "object") return "";
  return text((first as { OrganisationName?: unknown }).OrganisationName);
}

export async function lookupAbn(abn: string): Promise<AbnResult | null> {
  const guid = process.env.ABR_GUID;
  if (!guid) return null;

  const clean = abn.replace(/\s/g, "");
  if (!clean) return null;

  // Built through URLSearchParams so a caller cannot smuggle extra ABR
  // parameters (such as a second `guid`) in through the ABN string.
  const url = new URL(ABR_LOOKUP_URL);
  url.searchParams.set("abn", clean);
  url.searchParams.set("guid", guid);

  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) return null;

  const data = parseBody(await res.text());
  if (!data || data.Message) return null; // ABR returns errors in Message
  if (!data.Abn) return null;             // a reply without an ABN is no match

  return {
    abn:        text(data.Abn),
    entityName: text(data.EntityName) || firstBusinessName(data.BusinessName),
    entityType: text(data.EntityTypeName),
    status:     text(data.AbnStatus),
    state:      text(data.AddressState),
    postcode:   text(data.AddressPostcode),
  };
}

// Whether an organiser's stored ABN is complete enough to host events that
// take money through Startline.
//
// The threshold is 9 digits rather than the 11 a real ABN carries. That is the
// rule the event routes have always applied, and raising it here would lock
// out organisers whose stored value predates any validation. Tightening it is
// a data-migration decision, not a validation one.
export const MIN_ABN_DIGITS = 9;

export function hasAbn(abn: string | null | undefined): boolean {
  return (abn?.replace(/\D/g, "").length ?? 0) >= MIN_ABN_DIGITS;
}

// Shown wherever an organiser is told their account is not ready to take
// money. Kept in one place so the wizard, the dashboard and the admin portal
// all describe the same gap the same way.
export const ABN_REQUIRED_MESSAGE =
  "An ABN is required to host paid events on Startline. Add your ABN in Payments or onboarding, or use external registration.";
