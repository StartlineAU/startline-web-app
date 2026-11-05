import { createHash, randomInt, timingSafeEqual } from "crypto";

// No I, O, 0 or 1: these are read off a screen and typed by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

export const RECOVERY_CODE_COUNT = 10;

// XXXXX-XXXXX, drawn from 32^10 possibilities.
export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

// Dashes and spaces are only there to be read aloud, so case and grouping do
// not matter when a code is typed back in.
export function normaliseRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function hashRecoveryCode(input: string): string {
  return createHash("sha256").update(normaliseRecoveryCode(input)).digest("hex");
}

// Constant-time comparison against every stored hash; returns the hash that
// matched, or null. Comparing in constant time keeps a timing signal out of the
// one endpoint where a code can be guessed.
export function matchRecoveryCode(input: string, hashes: string[]): string | null {
  const candidate = Buffer.from(hashRecoveryCode(input), "hex");
  for (const hash of hashes) {
    const stored = Buffer.from(hash, "hex");
    if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) return hash;
  }
  return null;
}
