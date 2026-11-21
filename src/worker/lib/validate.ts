import { LIMITS } from "../../shared/limits";
import { Errors } from "./errors";

// Disallow control characters (including newlines) in short names.
const CONTROL = /[\u0000-\u001f\u007f]/;

export function displayName(v: unknown): string {
  if (typeof v !== "string") throw Errors.validation("Please enter your name.");
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length < 1) throw Errors.validation("Please enter your name.");
  if (s.length > LIMITS.displayNameMax) throw Errors.validation(`Names can be up to ${LIMITS.displayNameMax} characters.`);
  if (CONTROL.test(s)) throw Errors.validation("Names can't contain special control characters.");
  return s;
}

export const normName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function pin(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}$/.test(v)) throw Errors.validation("Your PIN must be 4 numbers.");
  return v;
}

/** Optional PIN hint (G29): up to 40 characters, and it must not contain the PIN itself. */
export function pinHint(v: unknown, thePin: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw Errors.validation("Your hint wasn't in the expected format.");
  const s = v.trim().replace(/\s+/g, " ");
  if (!s) return null;
  if (s.length > LIMITS.pinHintMax) throw Errors.validation(`Hints can be up to ${LIMITS.pinHintMax} characters.`);
  if (CONTROL.test(s)) throw Errors.validation("Hints can't contain special control characters.");
  if (s.replace(/\D/g, "").includes(thePin)) throw Errors.validation("Your hint can't include your PIN.");
  return s;
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw Errors.validation("The request wasn't in the expected format.");
}
