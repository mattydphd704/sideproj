import { GROUP_CODE_ALPHABET, LIMITS } from "../../shared/limits";
import { randomBytes } from "./crypto";

/** New group code: 8 characters from the look-alike-free alphabet (G2), unbiased. */
export function generateGroupCode(): string {
  const n = GROUP_CODE_ALPHABET.length;
  const max = 256 - (256 % n);
  let out = "";
  while (out.length < LIMITS.groupCodeLength) {
    for (const b of randomBytes(16)) {
      if (b < max && out.length < LIMITS.groupCodeLength) out += GROUP_CODE_ALPHABET[b % n];
    }
  }
  return out;
}

/** Accepts "k7qm-4xtr", "K7QM4XTR", " K7QM 4XTR " → "K7QM4XTR". Returns null if it can't be a code (FR-1.10). */
export function normalizeGroupCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== LIMITS.groupCodeLength) return null;
  for (const ch of s) if (!GROUP_CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** Display format: XXXX-XXXX. */
export const formatGroupCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
