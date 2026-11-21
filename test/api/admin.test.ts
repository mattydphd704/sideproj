// Admin protocol: plan → review → apply (TEST_PLAN §2.10, docs/ADMIN_PROTOCOL.md, ADR-17).
import { afterAll, beforeAll, expect, test } from "vitest";
import { freshDb } from "../helpers/db";
import { Client, makeEnv } from "../helpers/api";
import * as fx from "../helpers/fixtures";
import { apply as applyDirect } from "../../src/worker/admin/protocol";
import type { Env } from "../../src/worker/env";

const KEY = "test-admin-key-0123456789abcdef-0123456789";
let db: D1Database; let dispose: () => Promise<void>; let env: Env;
beforeAll(async () => { ({ db, dispose } = await freshDb()); env = makeEnv(db, { ADMIN_KEY: KEY }); });
afterAll(async () => { await dispose(); });

let seq = 0;
const cid = (p: string) => `${p}-${++seq}`;
const admin = (e: Env = env, key: string | null = KEY) => {
  const c = new Client(e);
  const h: Record<string, string> = key === null ? {} : { "x-admin-key": key };
  return {
    c,
    get: (p: string) => c.call("GET", p, undefined, { headers: h }),
    post: (p: string, b: unknown) => c.call("POST", p, b, { headers: h }),
  };
};
const cs = (changeId: string, ops: unknown[], note?: string) => ({ protocol: "giftlist-admin/1", changeId, note, ops });

/** Plans and applies in one go, checking both succeed. */
async function planApply(ops: unknown[], a = admin()) {
  const changeId = cid("c");
  const p = await a.post("/api/admin/plan", cs(changeId, ops));
  expect(p.status, JSON.stringify(p.json)).toBe(200);
  const r = await a.post("/api/admin/apply", { changeId, planId: p.json.planId });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return { plan: p.json, applied: r.json, changeId };
}
const groupVersion = async (id: string) => (await db.prepare("SELECT version FROM groups WHERE id = ?").bind(id).first<{ version: number }>())!.version;
const count = async (sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).first<{ n: number }>())!.n;
const snapshot = async () => {
  const out: Record<string, number> = {};
  for (const t of ["groups", "members", "member_tokens", "group_requests", "items", "claims", "tombstones"]) out[t] = await count(`SELECT COUNT(*) AS n FROM ${t}`);
  out.versions = await count("SELECT COALESCE(SUM(version), 0) AS n FROM groups");
  return out;
};

test("[ADM-01] admin endpoints need the right key, and are switched off when no key is configured", async () => {
  expect((await admin(env, null).get("/api/admin/groups")).status).toBe(401);
  expect((await admin(env, "wrong-key-wrong-key-wrong-key-wrong").get("/api/admin/groups")).status).toBe(401);
  expect((await admin(env, KEY.slice(0, -1)).get("/api/admin/groups")).status).toBe(401);
  expect((await admin().get("/api/admin/groups")).status).toBe(200);
  // Fail closed: no key, or a short one, disables every admin endpoint, even for a caller who sends one.
  for (const bad of [undefined, "", "short-key"]) {
    const off = makeEnv(db, { ADMIN_KEY: bad });
    const r = await admin(off, bad ?? "").get("/api/admin/groups");
    expect(r.status).toBe(503);
    expect(r.json.error).toBe("admin_disabled");
  }
  // A member's cookie grants nothing here.
  const gid = await fx.group(db, { name: "Cookie Test" });
  const member = new Client(env);
  member.cookies.set(`m_${gid}`, "anything");
  expect((await member.get("/api/admin/groups")).status).toBe(401);
});

test("[ADM-02] repeated wrong keys from one network are rate-limited", async () => {
  const ip = "10.99.0.1";
  let last = 0;
  for (let i = 0; i < 11; i++) {
    const a = admin(env, "nope-nope-nope-nope-nope-nope-nope-nope"); a.c.ip = ip;
    last = (await a.get("/api/admin/groups")).status;
  }
  expect(last).toBe(429);
  const right = admin(); right.c.ip = ip;
  expect((await right.get("/api/admin/groups")).status).toBe(429); // locked out for the window, even with the right key
});

test("[ADM-03] group.create makes a group with a code in the right format and an invite link", async () => {
  const { plan, applied } = await planApply([{ op: "group.create", ref: "jones", name: "Jones Family", currency: "gbp" }]);
  expect(plan.steps[0].summary).toContain('Create group "Jones Family" (GBP)');
  expect(applied.newGroups).toHaveLength(1);
  const g = applied.newGroups[0];
  expect(g.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  expect(g.inviteUrl).toBe(`https://giftlist.test/j/${g.code}`);
  const row = await db.prepare("SELECT created_via, currency, fair_share_buffer FROM groups WHERE id = ?").bind(g.id).first<any>();
  expect(row).toMatchObject({ created_via: "admin", currency: "GBP", fair_share_buffer: 1 });
  // Anyone can now look the group up with its code.
  const look = await new Client(env).post("/api/groups/lookup", { code: g.code });
  expect(look.json.group.name).toBe("Jones Family");
});

test("[ADM-04] member.add adds people as not joined yet; duplicate names are refused at plan time", async () => {
  const { applied } = await planApply([
    { op: "group.create", ref: "fam", name: "Add Family", currency: "USD" },
    { op: "member.add", group: "@fam", names: ["Grandma", "Uncle Ray"] },
  ]);
  const gid = applied.newGroups[0].id;
  const show = await admin().get(`/api/admin/groups/${gid}`);
  expect(show.json.members.map((m: any) => [m.name, m.state])).toEqual([["Grandma", "not_joined_yet"], ["Uncle Ray", "not_joined_yet"]]);
  // Grandma can now join by choosing her name (FR-2.2).
  const j = await new Client(env).post("/api/join", { code: applied.newGroups[0].code, displayName: "grandma", pin: "2468" });
  expect(j.status).toBe(201);

  const v0 = await groupVersion(gid);
  const p = await admin().post("/api/admin/plan", cs(cid("dup"), [
    { op: "member.add", group: gid, names: ["GRANDMA"] },
    { op: "member.add", group: gid, names: ["Ann", "ann "] },
  ]));
  expect(p.status).toBe(422);
  expect(p.json.errors.map((e: any) => e.index)).toEqual([0, 1]);
  expect(p.json.errors[0].message).toContain('already has someone called "Grandma"');
  expect(await groupVersion(gid)).toBe(v0);

  const { plan } = await planApply([{ op: "member.add", group: gid, names: ["Sam"] }]);
  expect(plan.steps[0].summary).toContain('Add Sam to "Add Family"');
  expect(await groupVersion(gid)).toBe(v0 + 1); // members' screens refresh
});

test("[ADM-05] member.remove deletes their items, releases their claims, leaves notes for claimers and signs them out", async () => {
  const gid = await fx.group(db, { name: "Remove Family" });
  const sam = await fx.member(db, gid, "Sam");
  const alex = await fx.member(db, gid, "Alex");
  const jo = await fx.member(db, gid, "Jo");
  const camera = await fx.item(db, gid, sam, { title: "Camera" });
  await fx.link(db, camera);
  await fx.item(db, gid, sam, { title: "Scarf" });
  await fx.claim(db, camera, alex, { purchased: 1 });           // Alex claimed Sam's camera
  const book = await fx.item(db, gid, jo, { title: "Book" });
  await fx.claim(db, book, sam);                                 // Sam claimed Jo's book
  await db.prepare("INSERT INTO member_tokens (token_hash, member_id, created_at, last_used_at) VALUES ('t1', ?, 1, 1), ('t2', ?, 1, 1)").bind(sam, sam).run();

  const { plan } = await planApply([{ op: "member.remove", group: gid, name: "sam" }]);
  expect(plan.steps[0].summary).toBe('− Remove Sam from "Remove Family": deletes 2 items, releases 1 claim Sam made, leaves 1 "no longer on the list" note for people who claimed Sam\'s items, signs Sam out on 2 devices. Their name can be used again.');

  expect(await count("SELECT COUNT(*) AS n FROM items WHERE owner_member_id = ?", sam)).toBe(0);
  expect(await count("SELECT COUNT(*) AS n FROM product_links WHERE item_id = ?", camera)).toBe(0);
  expect(await count("SELECT COUNT(*) AS n FROM claims WHERE item_id = ?", camera)).toBe(0);
  const t = await db.prepare("SELECT * FROM tombstones WHERE claimer_member_id = ?").bind(alex).first<any>();
  expect(t).toMatchObject({ recipient_name_snapshot: "Sam", item_title_snapshot: "Camera", was_purchased: 1 });
  expect(await db.prepare("SELECT status, release_reason FROM claims WHERE item_id = ?").bind(book).first()).toEqual({ status: "released", release_reason: "claimer_removed" });
  expect(await count("SELECT COUNT(*) AS n FROM member_tokens WHERE member_id = ? AND revoked_at IS NULL", sam)).toBe(0);
  expect(await db.prepare("SELECT status, pin_hash, removed_at IS NOT NULL AS r FROM members WHERE id = ?").bind(sam).first()).toEqual({ status: "removed", pin_hash: null, r: 1 });
  // The name is free again (G12 interim).
  await planApply([{ op: "member.add", group: gid, names: ["Sam"] }]);
  // Removing someone who isn't there is refused.
  const p = await admin().post("/api/admin/plan", cs(cid("x"), [{ op: "member.remove", group: gid, name: "Nobody" }]));
  expect(p.json.errors[0].message).toContain('nobody called "Nobody"');
});

test("[ADM-06] member.resetPin signs them out, clears the hint and lifts a lock; not for people who haven't joined", async () => {
  const gid = await fx.group(db, { name: "Reset Family" });
  const jo = await fx.member(db, gid, "Jo", { pin_hint: "the gate", failed_pin_attempts: 0, locked_until: Date.now() + 600_000 });
  await fx.member(db, gid, "Grandma", { status: "pending", added_by: "admin", pin_hash: null, pin_salt: null, joined_at: null });
  await db.prepare("INSERT INTO member_tokens (token_hash, member_id, created_at, last_used_at) VALUES ('rt1', ?, 1, 1)").bind(jo).run();

  let show = await admin().get(`/api/admin/groups/${gid}`);
  expect(show.json.members.find((m: any) => m.name === "Jo").state).toBe("locked");
  const { plan } = await planApply([{ op: "member.resetPin", group: gid, name: "Jo" }]);
  expect(plan.steps[0].summary).toContain("signs Jo out on 1 device, clears the hint, lifts the lock");
  const row = await db.prepare("SELECT pin_hash, pin_hint, locked_until FROM members WHERE id = ?").bind(jo).first();
  expect(row).toEqual({ pin_hash: null, pin_hint: null, locked_until: null });
  expect(await count("SELECT COUNT(*) AS n FROM member_tokens WHERE member_id = ? AND revoked_at IS NULL", jo)).toBe(0);
  show = await admin().get(`/api/admin/groups/${gid}`);
  expect(show.json.members.find((m: any) => m.name === "Jo").state).toBe("pin_reset_waiting");

  const p = await admin().post("/api/admin/plan", cs(cid("x"), [{ op: "member.resetPin", group: gid, name: "Grandma" }]));
  expect(p.json.errors[0].message).toContain("hasn't joined yet");
});

test("[ADM-07] request.approve and request.decline; the expect guard stops acting on the wrong request", async () => {
  const pat = new Client(env);
  const req = await pat.post("/api/group-requests", { groupName: "Pat's Family", currency: "usd", displayName: "Pat", pin: "1357" });
  const kim = new Client(env);
  const req2 = await kim.post("/api/group-requests", { groupName: "Kim's Crew", currency: "eur", displayName: "Kim", pin: "9753" });

  const list = await admin().get("/api/admin/requests");
  expect(list.json.requests.map((r: any) => r.groupName)).toEqual(expect.arrayContaining(["Pat's Family", "Kim's Crew"]));
  expect(JSON.stringify(list.json)).not.toMatch(/pin|hash|token/i);

  const wrong = await admin().post("/api/admin/plan", cs(cid("w"), [
    { op: "request.approve", requestId: req.json.request.id, expect: { groupName: "Kim's Crew", requester: "Kim" } },
  ]));
  expect(wrong.status).toBe(422);
  expect(wrong.json.errors[0].message).toContain(`is for "Pat's Family" from Pat`);

  const { applied } = await planApply([
    { op: "request.approve", requestId: req.json.request.id, expect: { groupName: "Pat's Family", requester: "Pat" }, ref: "pat" },
    { op: "member.add", group: "@pat", names: ["Robin"] },
    { op: "request.decline", requestId: req2.json.request.id, expect: { groupName: "Kim's Crew", requester: "Kim" } },
  ]);
  // Pat's waiting screen moves them straight in, using the PIN they chose (FR-1.2).
  const cur = await pat.get("/api/group-requests/current");
  expect(cur.json.status).toBe("approved");
  expect(cur.json.group.id).toBe(applied.newGroups[0].id);
  expect((await kim.get("/api/group-requests/current")).json.status).toBe("declined");
  const show = await admin().get(`/api/admin/groups/${applied.newGroups[0].id}`);
  expect(show.json.group.createdVia).toBe("request");
  expect(show.json.members.map((m: any) => [m.name, m.state, m.addedBy])).toEqual([["Pat", "joined", "request"], ["Robin", "not_joined_yet", "admin"]]);
  // A decided request can't be decided again.
  const again = await admin().post("/api/admin/plan", cs(cid("again"), [
    { op: "request.decline", requestId: req.json.request.id, expect: { groupName: "Pat's Family", requester: "Pat" } },
  ]));
  expect(again.json.errors[0].message).toContain("already approved");
});

test("[ADM-09] group.setFairShare changes the buffer within 0.5 to 3", async () => {
  const gid = await fx.group(db, { name: "Fair Family" });
  const { plan } = await planApply([{ op: "group.setFairShare", group: gid, buffer: 1.5 }]);
  expect(plan.steps[0].summary).toBe('⚖ Fair-share setting for "Fair Family": 1 → 1.5');
  expect((await admin().get(`/api/admin/groups/${gid}`)).json.group.fairShareBuffer).toBe(1.5);
  for (const buffer of [0, 0.4, 3.1, "1.2", null]) {
    const r = await admin().post("/api/admin/plan", cs(cid("fs"), [{ op: "group.setFairShare", group: gid, buffer }]));
    expect(r.status, String(buffer)).toBe(400);
  }
});

test("[ADM-10] planning writes nothing except the stored plan", async () => {
  const gid = await fx.group(db, { name: "Plan Only" });
  await fx.member(db, gid, "Sam");
  const before = await snapshot();
  const p = await admin().post("/api/admin/plan", cs(cid("p"), [
    { op: "group.create", name: "Never Made", currency: "USD" },
    { op: "member.add", group: gid, names: ["Zed"] },
    { op: "member.remove", group: gid, name: "Sam" },
  ]));
  expect(p.status).toBe(200);
  expect(p.json.planId).toBeTruthy();
  expect(await snapshot()).toEqual(before);
});

test("[ADM-11] apply is all or nothing: if the state changed after the checks, the whole batch rolls back", async () => {
  const gid = await fx.group(db, { name: "Atomic Family" });
  const changeId = cid("atomic");
  const p = await admin().post("/api/admin/plan", cs(changeId, [
    { op: "group.create", name: "Should Not Exist", currency: "USD" },
    { op: "member.add", group: gid, names: ["Ann", "Ben"] },
  ]));
  // Someone joins in the instant between apply's checks and its batch.
  let before: Record<string, number> = {};
  const beforeBatch = async () => {
    await db.prepare("UPDATE groups SET version = version + 1 WHERE id = ?").bind(gid).run();
    before = await snapshot();
  };
  await expect(applyDirect(db, changeId, p.json.planId, Date.now(), { beforeBatch })).rejects.toMatchObject({ code: "plan_stale" });
  expect(await snapshot()).toEqual(before);
  expect(await count("SELECT COUNT(*) AS n FROM groups WHERE name = 'Should Not Exist'")).toBe(0);
  expect((await db.prepare("SELECT status FROM admin_changes WHERE id = ?").bind(changeId).first<any>()).status).toBe("planned");
});

test("[ADM-12] a plan is refused if anything changed since it was reviewed", async () => {
  const pat = new Client(env);
  const req = await pat.post("/api/group-requests", { groupName: "Stale Family", currency: "usd", displayName: "Lee", pin: "1470" });
  const gid = await fx.group(db, { name: "Stale Group", group_code: "STQE2345" });
  const changeId = cid("stale");
  const p = await admin().post("/api/admin/plan", cs(changeId, [
    { op: "member.add", group: gid, names: ["Ann"] },
    { op: "request.approve", requestId: req.json.request.id, expect: { groupName: "Stale Family", requester: "Lee" } },
  ]));
  // Someone joins the group after the plan was made.
  expect((await new Client(env).post("/api/join", { code: "STQE2345", displayName: "Walk In", pin: "1111" })).status).toBe(201);
  const r = await admin().post("/api/admin/apply", { changeId, planId: p.json.planId });
  expect(r.status).toBe(409);
  expect(r.json.error).toBe("plan_stale");
  expect(await count("SELECT COUNT(*) AS n FROM members WHERE group_id = ? AND display_name = 'Ann'", gid)).toBe(0);
  expect((await pat.get("/api/group-requests/current")).json.status).toBe("pending");
  // Planning again picks up the new state, and then applies.
  const p2 = await admin().post("/api/admin/plan", cs(changeId, [{ op: "member.add", group: gid, names: ["Ann"] }]));
  const old = await admin().post("/api/admin/apply", { changeId, planId: p.json.planId });
  expect(old.json.error).toBe("plan_superseded");
  expect((await admin().post("/api/admin/apply", { changeId, planId: p2.json.planId })).status).toBe(200);
});

test("[ADM-13] the same change set is applied only once; repeating apply returns the first result", async () => {
  const { plan, applied, changeId } = await planApply([{ op: "group.create", name: "Once Family", currency: "USD" }]);
  const again = await admin().post("/api/admin/apply", { changeId, planId: plan.planId });
  expect(again.status).toBe(200);
  expect(again.json.replayed).toBe(true);
  expect(again.json.newGroups).toEqual(applied.newGroups);
  expect(await count("SELECT COUNT(*) AS n FROM groups WHERE name = 'Once Family'")).toBe(1);
  const replan = await admin().post("/api/admin/plan", cs(changeId, [{ op: "group.create", name: "Once Family", currency: "USD" }]));
  expect(replan.status).toBe(409);
  expect(replan.json.error).toBe("already_applied");
  // Two applies racing for the same plan: the guard stops the second one inside its batch.
  const raceId = cid("race");
  const p = await admin().post("/api/admin/plan", cs(raceId, [{ op: "group.create", name: "Race Family", currency: "USD" }]));
  const beforeBatch = async () => { await applyDirect(db, raceId, p.json.planId); }; // the other apply wins
  await expect(applyDirect(db, raceId, p.json.planId, Date.now(), { beforeBatch })).rejects.toMatchObject({ code: "plan_stale" });
  expect(await count("SELECT COUNT(*) AS n FROM groups WHERE name = 'Race Family'")).toBe(1);
});

test("[ADM-14] the audit log records each change set, without codes, PINs, hints or the key", async () => {
  const pat = new Client(env);
  const req = await pat.post("/api/group-requests", { groupName: "Audit Family", currency: "usd", displayName: "Ash", pin: "8642", pinHint: "my bike lock" });
  const { applied, changeId } = await planApply([
    { op: "request.approve", requestId: req.json.request.id, expect: { groupName: "Audit Family", requester: "Ash" } },
  ]);
  const log = await admin().get("/api/admin/changes");
  const entry = log.json.changes.find((c: any) => c.changeId === changeId);
  expect(entry).toMatchObject({ status: "applied", actor: "admin-key" });
  expect(entry.steps[0]).toContain('Approve "Audit Family" from Ash');
  const { results } = await db.prepare("SELECT * FROM admin_changes").all();
  const everything = JSON.stringify(results);
  const code = applied.newGroups[0].code as string;
  for (const secret of [code, code.replace("-", ""), "8642", "my bike lock", KEY]) expect(everything).not.toContain(secret);
});

test("[ADM-15] reading: requests, groups and one group's people with their states", async () => {
  const gid = await fx.group(db, { name: "Read Family", group_code: "READ2345" });
  await fx.member(db, gid, "Sam", { last_seen_at: 1_700_000_000_000 });
  await fx.member(db, gid, "Grandma", { status: "pending", added_by: "admin", pin_hash: null, pin_salt: null, joined_at: null });
  const groups = await admin().get("/api/admin/groups");
  expect(groups.json.groups.find((g: any) => g.id === gid)).toMatchObject({ code: "READ-2345", joined: 1, notJoinedYet: 1, inviteUrl: "https://giftlist.test/j/READ-2345" });
  const show = await admin().get(`/api/admin/groups/${gid}`);
  expect(show.json.members).toEqual([
    expect.objectContaining({ name: "Grandma", state: "not_joined_yet", devices: 0 }),
    expect.objectContaining({ name: "Sam", state: "joined", lastSeenAt: "2023-11-14T22:13:20.000Z" }),
  ]);
  expect(JSON.stringify(show.json)).not.toMatch(/pin_hash|pin_salt|token_hash|"h"/);
  expect((await admin().get("/api/admin/groups/nope")).status).toBe(404);
  expect((await admin().get("/api/admin/requests?status=weird")).status).toBe(400);
});

test("[ADM-16] change sets are checked strictly: version, IDs, unknown ops or fields, references and limits", async () => {
  const gid = await fx.group(db, { name: "Strict Family" });
  const bad: [unknown, string][] = [
    [{ ...cs("a", [{ op: "group.create", name: "X", currency: "USD" }]), protocol: "giftlist-admin/2" }, "protocol"],
    [cs("has space", [{ op: "group.create", name: "X", currency: "USD" }]), "changeId"],
    [cs("a", []), "ops"],
    [cs("a", Array.from({ length: 51 }, () => ({ op: "group.create", name: "X", currency: "USD" }))), "ops"],
    [cs("a", [{ op: "group.delete", group: gid }]), "ops[0]"],
    [cs("a", [{ op: "group.create", name: "X", currency: "USD", group_code: "ABCD2345" }]), "ops[0].group_code"],
    [cs("a", [{ op: "group.create", name: "X", currency: "dollars" }]), "ops[0].currency"],
    [cs("a", [{ op: "group.create", name: "x".repeat(61), currency: "USD" }]), "ops[0].name"],
    [cs("a", [{ op: "member.add", group: gid, names: [] }]), "ops[0].names"],
    [cs("a", [{ op: "member.add", group: gid, names: ["x".repeat(31)] }]), "ops[0].names[0]"],
    [cs("a", [{ op: "request.approve", requestId: "r" }]), "ops[0].expect"],
    [{ ...cs("a", [{ op: "group.create", name: "X", currency: "USD" }]), extra: 1 }, "extra"],
  ];
  for (const [body, where] of bad) {
    const r = await admin().post("/api/admin/plan", body);
    expect(r.status, where).toBe(400);
    expect(r.json.message, where).toContain(where);
  }
  const refs = await admin().post("/api/admin/plan", cs(cid("refs"), [
    { op: "member.add", group: "@later", names: ["Ann"] },
    { op: "group.create", ref: "later", name: "Later", currency: "USD" },
    { op: "group.create", ref: "later", name: "Again", currency: "USD" },
    { op: "member.add", group: "no-such-id", names: ["Ann"] },
  ]));
  expect(refs.status).toBe(422);
  expect(refs.json.errors.map((e: any) => e.index)).toEqual([0, 2, 3]);
});

test("[ADM-17] plans expire after 24 hours", async () => {
  const changeId = cid("old");
  const p = await admin().post("/api/admin/plan", cs(changeId, [{ op: "group.create", name: "Old Plan", currency: "USD" }]));
  await db.prepare("UPDATE admin_changes SET planned_at = planned_at - 25 * 3600 * 1000 WHERE id = ?").bind(changeId).run();
  const r = await admin().post("/api/admin/apply", { changeId, planId: p.json.planId });
  expect(r.status).toBe(409);
  expect(r.json.error).toBe("plan_expired");
  expect((await admin().post("/api/admin/apply", { changeId: "nope", planId: "x" })).status).toBe(404);
});
