// Small crypto helpers built on Web Crypto (available in Workers and Node 22).
const enc = new TextEncoder();

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Random, URL-safe id: 16 bytes → 22 characters (DATA_SCHEMA §1). */
export const newId = () => base64url(randomBytes(16));

/** Raw member or request token: 32 random bytes. Only its hash is stored. */
export const newToken = () => base64url(randomBytes(32));

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

/** PIN hash = HMAC-SHA-256(pepper, salt ‖ pin) (ADR-05). */
export const hashPin = (pepper: string, salt: string, pin: string) => hmacHex(pepper, `pin:${salt}:${pin}`);

/** Compares two equal-format strings in constant time. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
