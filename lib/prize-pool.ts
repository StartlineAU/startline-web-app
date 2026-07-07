export interface PrizePool {
  amount: string;   // e.g. "2,000"
  details: string;  // e.g. "Awarded to podium finishers per division"
}

const PREFIX    = "Prize pool: ";
const SEPARATOR = " — ";

/** Strip any user-typed currency prefix so display can add its own "$". */
export function normalisePrizeAmount(raw: string): string {
  return raw.trim().replace(/^(A\$|\$)\s*/i, "");
}

/** Serialise prize pool fields into the Event.extras string column. */
export function encodePrizePool(amount: string, details: string): string | null {
  const amt = normalisePrizeAmount(amount);
  if (!amt) return null;
  const det = details.trim().replace(/—/g, "-");
  return `${PREFIX}${amt}${det ? `${SEPARATOR}${det}` : ""}`;
}

/** Parse Event.extras back into prize pool fields. Returns null when extras holds no prize pool. */
export function parsePrizePool(extras: string | null | undefined): PrizePool | null {
  if (!extras?.startsWith(PREFIX)) return null;
  const rest = extras.slice(PREFIX.length);
  const sep = rest.indexOf(SEPARATOR);
  if (sep === -1) return { amount: rest.trim(), details: "" };
  return {
    amount: rest.slice(0, sep).trim(),
    details: rest.slice(sep + SEPARATOR.length).trim(),
  };
}
