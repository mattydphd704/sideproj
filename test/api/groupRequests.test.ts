// Group requests: ask, wait, approve or decline (TEST_PLAN §2.4).
import { afterAll, beforeAll, expect, test } from "vitest";
import { freshDb } from "../helpers/db";
import { Client, makeEnv } from "../helpers/api";
import { approveRequest, declineRequest } from "../../src/worker/services/groupRequests";
import { resetPin } from "../../src/worker/services/members";
import { createGroup } from "../../src/worker/services/groups";
import type { Env } from "../../src/worker/env";

let db: D1Database; let dispose: () => Promise<void>; let env: Env;
beforeAll(async () => { ({ db, dispose } = await freshDb()); env = makeEnv(db); });
afterAll(async () => { await dispose(); });

const ask = (c: Client, over: Record<string, unknown> = {}) =>
  c.post("/api/group-requests", { groupName: "Smith Family", currency: "usd", displayName: "Pat", pin: "1234", ...over });

test("[REQ-01] submitting a request stores it as pending and sets a request cookie", async () => {
  const c = new Client(env);
  const r = await ask(c);
  expect(r.status).toBe(201);
  expect(r.json.request).toMatchObject({ status: "pending", groupName: "Smith Family" });
  expect(c.cookies.has("r_request")).toBe(true);
  const row = await db.prepare("SELECT * FROM group_requests WHERE id = ?").bind(r.json.request.id).first<any>();
  expect(row.requested_currency).toBe("USD");
  expect(row.requester_pin_hash).not.toContain("1234");
});

test("[REQ-01b] request fields are validated", async () => {
  for (const over of [{ groupName: "" }, { groupName: "x".repeat(61) }, { currency: "dollars" }, { displayName: "" }, { pin: "12" }, { pin: "123456" }]) {
    expect((await ask(new Client(env), over)).status, JSON.stringify(over)).toBe(400);
  }
});

test("[REQ-07] a hint given with a request carries over to the new member when approved", async () => {
  const c = new Client(env);
  const req = await ask(c, { groupName: "Hint Family", pin: "4321", pinHint: "phone code" });
  const approved = await approveRequest(db, req.json.request.id);
  const m = await db.prepare("SELECT pin_hint FROM members WHERE id = ?").bind(approved!.memberId).first<{ pin_hint: string }>();
  expect(m?.pin_hint).toBe("phone code");
  expect((await ask(new Client(env), { pin: "4321", pinHint: "4321!" })).status).toBe(400);
});

test("[REQ-02] while pending, the status check says pending", async () => {
  const c = new Client(env); await ask(c);
  const r = await c.get("/api/group-requests/current");
  expect(r.json).toEqual({ status: "pending", groupName: "Smith Family" });
});

test("[REQ-03] approval creates the group with the requester as first member and moves the browser in", async () => {
  const c = new Client(env);
  const req = await ask(c, { displayName: "Pat", pin: "2468" });
  const approved = await approveRequest(db, req.json.request.id);
  expect(approved).not.toBeNull();
  const r = await c.get("/api/group-requests/current");
  expect(r.json.status).toBe("approved");
  expect(r.json.group.id).toBe(approved!.group.id);
  expect(c.cookies.has(`m_${approved!.group.id}`)).toBe(true);
  const me = await c.get("/api/me");
  expect(me.json.groups).toEqual([{ id: approved!.group.id, name: "Smith Family", member: { id: approved!.memberId, displayName: "Pat" } }]);
  // The PIN chosen when asking works for recovery on another device.
  const other = new Client(env);
  expect((await other.post("/api/recover", { code: approved!.group.group_code, displayName: "Pat", pin: "2468" })).status).toBe(200);
  // Approving twice does nothing.
  expect(await approveRequest(db, req.json.request.id)).toBeNull();
});

test("[REQ-04] a declined request reports declined and creates no group", async () => {
  const c = new Client(env);
  const req = await ask(c, { groupName: "Never Group" });
  expect(await declineRequest(db, req.json.request.id)).toBe(true);
  const r = await c.get("/api/group-requests/current");
  expect(r.json).toEqual({ status: "declined", groupName: "Never Group" });
  const g = await db.prepare("SELECT count(*) AS n FROM groups WHERE name = 'Never Group'").first<{ n: number }>();
  expect(g?.n).toBe(0);
});

test("[REQ-05] more than 5 requests from one network in an hour are blocked", async () => {
  const ip = "10.99.99.99";
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await ask(new Client(env, ip), { groupName: `G${i}` })).status);
  expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
});

test("[REQ-06] no request cookie → 404 no_request", async () => {
  const r = await new Client(env).get("/api/group-requests/current");
  expect(r.status).toBe(404);
  expect(r.json.error).toBe("no_request");
});

test("[ID-22] after an admin PIN reset, recovery reports pinWasReset (G25)", async () => {
  const g = await createGroup(db, { name: "Reset Family", currency: "USD", createdVia: "admin" });
  const c = new Client(env);
  const j = await c.post("/api/join", { code: g.group_code, displayName: "Sam", pin: "1234" });
  expect((await new Client(env).post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "1234" })).json.pinWasReset).toBe(false);
  await resetPin(db, j.json.member.id);
  expect((await new Client(env).post("/api/recover", { code: g.group_code, displayName: "Sam", pin: "9999" })).json.pinWasReset).toBe(true);
});

test("[CFG-01] without a proper PIN pepper the API refuses to run (fails closed)", async () => {
  for (const PIN_PEPPER of ["", "short"]) {
    const c = new Client(makeEnv(db, { PIN_PEPPER }));
    const r = await c.post("/api/groups/lookup", { code: "ABCD-EFGH" });
    expect(r.status).toBe(500);
    expect(r.json.error).toBe("server_misconfigured");
  }
  expect((await new Client(makeEnv(db, { PIN_PEPPER: "" })).get("/api/health")).status).toBe(200);
});
