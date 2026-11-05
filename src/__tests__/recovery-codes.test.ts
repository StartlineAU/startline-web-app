import { describe, expect, it } from "vitest";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  matchRecoveryCode,
  normaliseRecoveryCode,
} from "@/lib/recovery-codes";

describe("recovery codes", () => {
  it("generates ten distinct codes without the characters people misread", () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    }
  });

  it("ignores case, spaces and dashes", () => {
    expect(normaliseRecoveryCode("abcde fghjk")).toBe("ABCDEFGHJK");
    expect(hashRecoveryCode("abcde fghjk")).toBe(hashRecoveryCode("ABCDE-FGHJK"));
  });

  it("matches a stored code and nothing else", () => {
    const code = "ABCDE-FGHJK";
    const hashes = [hashRecoveryCode(code), hashRecoveryCode("ZZZZZ-ZZZZZ")];

    expect(matchRecoveryCode("abcde-fghjk", hashes)).toBe(hashRecoveryCode(code));
    expect(matchRecoveryCode("ABCDE-FGHJX", hashes)).toBeNull();
    expect(matchRecoveryCode(code, [])).toBeNull();
  });
});
