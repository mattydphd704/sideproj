// Builds the SQL that seeds a deployed environment with the Smith Family test group
// (same data as the prototype, docs/UI_INTERACTION_MAPS.md GR-8). PIN hashes use the
// environment's PIN_PEPPER, read from a file so it is never printed or committed.
// Usage: node scripts/dev-seed.mjs <pepper-file> <out.sql>
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const [pepperFile, out] = process.argv.slice(2);
const pepper = readFileSync(pepperFile, "utf8").trim();
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64u = (b) => Buffer.from(b).toString("base64url");
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
const id = () => b64u(rnd(16));
async function hashPin(salt, pin) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(`pin:${salt}:${pin}`)));
}
const q = (v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const now = Date.now();
const gid = id();
const members = [
  { name: "Sam", pin: "1234", hint: "the old house number" },
  { name: "Alex", pin: "1234", hint: null },
  { name: "Jo", pin: "2580", hint: "the garden gate" },
  { name: "Grandma" },
  { name: "Uncle Ray" },
];
const sql = [
  `INSERT INTO groups (id, name, group_code, currency, created_via, created_at) VALUES (${q(gid)}, 'Smith Family', 'SMTH2345', 'USD', 'admin', ${now});`,
];
for (const m of members) {
  if (m.pin) {
    const salt = b64u(rnd(16));
    sql.push(`INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, pin_hash, pin_salt, pin_hint, joined_at, created_at) VALUES (${q(id())}, ${q(gid)}, ${q(m.name)}, ${q(m.name.toLowerCase())}, 'joined', 'self', ${q(await hashPin(salt, m.pin))}, ${q(salt)}, ${q(m.hint)}, ${now}, ${now});`);
  } else {
    sql.push(`INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, created_at) VALUES (${q(id())}, ${q(gid)}, ${q(m.name)}, ${q(m.name.toLowerCase())}, 'pending', 'admin', ${now});`);
  }
}
writeFileSync(out, sql.join("\n") + "\n");
console.log(`Seed SQL written: 1 group, ${members.length} members`);
