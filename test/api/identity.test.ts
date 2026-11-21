// Identity and access: joining, cookies, PINs, recovery, rate limits (TEST_PLAN §2.3).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { freshDb } from "../helpers/db";
import { Client, makeEnv } from "../helpers/api";
import { createGroup } from "../../src/worker/services/groups";
import { addPendingMember, resetPin } from "../../src/worker/services/members";
import { formatGroupCode } from "../../src/worker/lib/codes";
import { hashPin } from "../../src/worker/lib/crypto";
import type { Env } from "../../src/worker/env";

let db: D1Database;
let dispose: () => Promise<void>;
let env: Env;
beforeAll(async () => { ({ db, dispose } = await freshDb()); env = makeEnv(db); });
afterAll(async () => { await dispose(); });

const newGroup = async (name = "Smith Family") => createGroup(db, { name, currency: "USD", createdVia: "admin" });
const client = () => new Client(env);
const memberRow = (groupId: string, name: string) =>
  db.prepare("SELECT * FROM members WHERE group_id = ? AND display_name_norm = ?").bind(groupId, name.toLowerCase()).first<any>();

describe("joining", () => {
  test("[ID-01] join with a valid code creates a joined member and sets a cookie", async () => {
    const g = await newGroup(); const c = client();
    const r = await c.post("/api/join", { code: formatGroupCode(g.group_code), displayName: "Sam", pin: "1234" });
    expect(r.status).toBe(201);
    expect(r.json.group).toEqual({ id: g.id, name: "Smith Family" });
    expect(r.json.member.displayName).toBe("Sam");
    expect(c.cookies.has(`m_${g.id}`)).toBe(true);
    expect((await memberRow(g.id, "Sam")).status).toBe("joined");
  });

  test("[ID-02] unknown and malformed codes give the same generic error", async () => {
    const a = await client().post("/api/join", { code: "ZZZZ-ZZZZ", displayName: "Sam", pin: "1234" });
    const b = await client().post("/api/join", { code: "not a code", displayName: "Sam", pin: "1234" });
    expect(a.status).toBe(400); expect(b.status).toBe(400);
    expect(a.json).toEqual(b.json);
    expect(a.json.error).toBe("invalid_code");
  });

  test("[ID-03] a display name already in use is rejected with a helpful message", async () => {
    const g = await newGroup();
    await client().post("/api/join", { code: g.group_code, displayName: "Alex", pin: "1234" });
    const r = await client().post("/api/join", { code: g.group_code, displayName: "  ALEX ", pin: "9999" });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("name_taken");
    expect(r.json.message).toMatch(/been here before/);
  });

  test("[ID-04] picking a pending name on first visit sets the PIN and joins", async () => {
    const g = await newGroup();
    const pendingId = await addPendingMember(db, g.id, "Grandma");
    const c = client();
    const r = await c.post("/api/join", { code: g.group_code, displayName: "grandma", pin: "2468" });
    expect(r.status).toBe(201);
    expect(r.json.member.id).toBe(pendingId);
    const row = await memberRow(g.id, "Grandma");
    expect(row.status).toBe("joined");
    expect(row.pin_hash).toBeTruthy();
    // A second person can no longer take that name.
    expect((await client().post("/api/join", { code: g.group_code, displayName: "Grandma", pin: "1111" })).status).toBe(409);
  });

  test("[ID-05] the member cookie is HttpOnly, Secure, SameSite=Lax, one per group", async () => {
    const g = await newGroup(); const c = client();
    const r = await c.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    const cookie = r.setCookies.find((s) => s.startsWith(`m_${g.id}=`))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=34560000/);
  });

  test("[ID-06] only the token's hash is stored; the raw token is not in the database", async () => {
    const g = await newGroup(); const c = client();
    await c.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    const raw = c.cookies.get(`m_${g.id}`)!;
    const { results } = await db.prepare("SELECT token_hash FROM member_tokens").all<{ token_hash: string }>();
    expect(results.some((r) => r.token_hash === raw)).toBe(false);
    expect(results.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });

  test("[ID-11] PIN must be 4–6 digits", async () => {
    const g = await newGroup();
    for (const pin of ["123", "1234567", "12a4", "", 1234]) {
      const r = await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin });
      expect(r.status, String(pin)).toBe(400);
      expect(r.json.error).toBe("validation");
    }
    for (const [i, pin] of ["1234", "123456"].entries()) {
      expect((await client().post("/api/join", { code: g.group_code, displayName: `Ok${i}`, pin })).status).toBe(201);
    }
  });

  test("[ID-12] PINs are stored as salted HMACs with the pepper, never as plain text", async () => {
    const g = await newGroup();
    await client().post("/api/join", { code: g.group_code, displayName: "Pat", pin: "4321" });
    await client().post("/api/join", { code: g.group_code, displayName: "Lee", pin: "4321" });
    const pat = await memberRow(g.id, "Pat"); const lee = await memberRow(g.id, "Lee");
    expect(pat.pin_hash).not.toContain("4321");
    expect(pat.pin_hash).not.toBe(lee.pin_hash); // same PIN, different salts
    expect(pat.pin_hash).toBe(await hashPin(env.PIN_PEPPER, pat.pin_salt, "4321"));
    expect(pat.pin_hash).not.toBe(await hashPin("another-pepper", pat.pin_salt, "4321"));
  });

  test("[ID-14] codes work with or without the dash, in any case", async () => {
    const g = await newGroup();
    const lower = `${g.group_code.slice(0, 4)}-${g.group_code.slice(4)}`.toLowerCase();
    expect((await client().post("/api/join", { code: lower, displayName: "A", pin: "1234" })).status).toBe(201);
    expect((await client().post("/api/join", { code: ` ${g.group_code.toLowerCase()} `, displayName: "B", pin: "1234" })).status).toBe(201);
  });

  test("[ID-20] a pending member has no session until they set a PIN", async () => {
    const g = await newGroup();
    const id = await addPendingMember(db, g.id, "Kid");
    const tokens = await db.prepare("SELECT count(*) AS n FROM member_tokens WHERE member_id = ?").bind(id).first<{ n: number }>();
    expect(tokens?.n).toBe(0);
    expect((await client().post("/api/recover", { code: g.group_code, displayName: "Kid", pin: "1234" })).status).toBe(401);
  });

  test("[ID-21] lookup shows the group name and member names (pending flagged), not removed members", async () => {
    const g = await newGroup("Lookup Family");
    await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    await addPendingMember(db, g.id, "Grandma");
    await db.prepare("INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, created_at, removed_at) VALUES ('rm1', ?, 'Gone', 'gone', 'removed', 'admin', 1, 1)").bind(g.id).run();
    const r = await client().post("/api/groups/lookup", { code: g.group_code });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({
      group: { id: g.id, name: "Lookup Family" },
      members: [{ displayName: "Grandma", pending: true }, { displayName: "Sam", pending: false }],
    });
    expect(Object.keys(r.json.members[0]).sort()).toEqual(["displayName", "pending"]);
  });
});

describe("recovery", () => {
  test("[ID-07] correct PIN on a new browser issues a new token; the old device stays signed in", async () => {
    const g = await newGroup();
    const phone = client();
    await phone.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    const laptop = client();
    const r = await laptop.post("/api/recover", { code: g.group_code, displayName: "sam", pin: "1234" });
    expect(r.status).toBe(200);
    expect(laptop.cookies.get(`m_${g.id}`)).not.toBe(phone.cookies.get(`m_${g.id}`));
    expect((await phone.get("/api/me")).json.groups).toHaveLength(1);
    expect((await laptop.get("/api/me")).json.groups).toHaveLength(1);
  });

  test("[ID-08] a wrong PIN is rejected and counted", async () => {
    const g = await newGroup();
    await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    const r = await client().post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "0000" });
    expect(r.status).toBe(401);
    expect(r.json.error).toBe("invalid_credentials");
    expect((await memberRow(g.id, "Sam")).failed_pin_attempts).toBe(1);
  });

  test("[ID-09] 5 wrong PINs lock the name for 15 minutes, even against the correct PIN", async () => {
    const g = await newGroup();
    await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    const attacker = client();
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await attacker.post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "0000" })).status);
    expect(statuses).toEqual([401, 401, 401, 401, 423]);
    const r = await client().post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "1234" });
    expect(r.status).toBe(423);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(14 * 60);
    const row = await memberRow(g.id, "Sam");
    expect(row.locked_until - Date.now()).toBeGreaterThan(14 * 60_000);
  });

  test("[ID-10] after the lock expires the correct PIN works and the count resets", async () => {
    const g = await newGroup();
    await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    await db.prepare("UPDATE members SET failed_pin_attempts = 3, locked_until = ? WHERE group_id = ?").bind(Date.now() - 1000, g.id).run();
    expect((await client().post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "1234" })).status).toBe(200);
    const row = await memberRow(g.id, "Sam");
    expect(row.failed_pin_attempts).toBe(0);
    expect(row.locked_until).toBeNull();
  });

  test("[ID-18] an admin PIN reset signs the member out everywhere; their next PIN becomes the new one", async () => {
    const g = await newGroup();
    const phone = client();
    const r = await phone.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    await resetPin(db, r.json.member.id);
    expect((await phone.get("/api/me")).json.groups).toHaveLength(0);
    const again = client();
    expect((await again.post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "5678" })).status).toBe(200);
    expect((await client().post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "1234" })).status).toBe(401);
  });
});

describe("sessions", () => {
  test("[ID-16] one browser in several groups: /api/me lists them all", async () => {
    const g1 = await newGroup("Alpha Family"); const g2 = await newGroup("Beta Friends");
    const c = client();
    await c.post("/api/join", { code: g1.group_code, displayName: "Sam", pin: "1234" });
    await c.post("/api/join", { code: g2.group_code, displayName: "Sammy", pin: "1234" });
    const me = await c.get("/api/me");
    expect(me.json.groups.map((x: any) => [x.name, x.member.displayName])).toEqual([["Alpha Family", "Sam"], ["Beta Friends", "Sammy"]]);
  });

  test("[ID-17] a removed member's tokens stop working", async () => {
    const g = await newGroup(); const c = client();
    const r = await c.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    await db.prepare("UPDATE members SET status = 'removed', removed_at = ? WHERE id = ?").bind(Date.now(), r.json.member.id).run();
    expect((await c.get("/api/me")).json.groups).toHaveLength(0);
  });

  test("[ID-19] data-changing requests without the app header, or from another site, are blocked", async () => {
    const g = await newGroup();
    const noHeader = await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" }, { csrf: false });
    expect(noHeader.status).toBe(403);
    const otherSite = await client().post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" }, { headers: { origin: "https://evil.example" } });
    expect(otherSite.status).toBe(403);
    expect(await memberRow(g.id, "Sam")).toBeNull();
  });
});

describe("rate limits and logging", () => {
  test("[ID-13a] 10 failed attempts from one IP in 15 minutes → further attempts blocked", async () => {
    const c = client();
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await c.post("/api/join", { code: "ZZZZ-ZZZZ", displayName: "X", pin: "1234" })).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    // Even a valid code is refused from that IP while blocked.
    const g = await newGroup();
    const r = await c.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  test("[ID-13b] more than 30 attempts on one code in an hour → blocked", async () => {
    const g = await newGroup();
    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await client().post("/api/groups/lookup", { code: g.group_code })).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  test("[ID-13c] rate-limit keys don't store IP addresses or codes in plain text", async () => {
    const { results } = await db.prepare("SELECT bucket FROM rate_limits").all<{ bucket: string }>();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.bucket).toMatch(/^(ip|code):[0-9a-f]{64}$/);
  });

  test("[ID-15] codes, PINs and tokens never appear in logs", async () => {
    const logged: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => { logged.push(a.map(String).join(" ")); }));
    try {
      const g = await newGroup(); const c = client();
      await c.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "8642" });
      await c.post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "0000" });
      await c.call("GET", `/j/${g.group_code}`);
      const token = c.cookies.get(`m_${g.id}`)!;
      const all = logged.join("\n");
      for (const secret of [g.group_code, "8642", token]) expect(all).not.toContain(secret);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
