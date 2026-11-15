// Withdrawing gives an entry's spot away and cannot be undone by the athlete,
// so the dialog asks them to type a code back before it will go through (#551).
// The code is friction against a stray tap, not a secret: it is generated and
// checked in the browser, and the withdraw route itself is unchanged.

export const WITHDRAW_CODE_LENGTH = 5;

/** A random string of WITHDRAW_CODE_LENGTH digits, leading zeros allowed. */
export function generateWithdrawCode(): string {
  const digits = new Uint8Array(WITHDRAW_CODE_LENGTH);
  crypto.getRandomValues(digits);
  // 250 is the largest multiple of 10 under 256; rerolling above it keeps
  // every digit equally likely.
  for (let i = 0; i < digits.length; i++) {
    while (digits[i] >= 250) {
      const reroll = new Uint8Array(1);
      crypto.getRandomValues(reroll);
      digits[i] = reroll[0];
    }
  }
  return Array.from(digits, (d) => String(d % 10)).join("");
}

/** Keeps only digits, capped at the code length, for the input's onChange. */
export function sanitiseWithdrawInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, WITHDRAW_CODE_LENGTH);
}

export function withdrawCodeMatches(code: string, typed: string): boolean {
  return code.length === WITHDRAW_CODE_LENGTH && sanitiseWithdrawInput(typed) === code;
}
