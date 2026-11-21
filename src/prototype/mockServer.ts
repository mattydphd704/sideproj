// A pretend server that runs inside the prototype page. It answers the same /api calls
// as the real Worker, with the same validation code (imported from src/worker/lib),
// the same error codes and the same messages. Nothing leaves the browser.
import { normalizeGroupCode } from "../worker/lib/codes";
import { ApiError, Errors } from "../worker/lib/errors";
import * as v from "../worker/lib/validate";

export type MockMember = { id: string; name: string; status: "pending" | "joined"; pin?: string; hint?: string | null; fails: number; lockedUntil?: number };
export type MockGroup = { id: string; name: string; code: string; members: MockMember[] };
export type MockRequest = { id: string; groupName: string; currency: string; name: string; pin: string; hint: string | null; status: "pending" | "approved" | "declined"; groupId?: string };

export type MockState = {
  groups: MockGroup[];
  requests: MockRequest[];
  /** What this browser "has cookies for". */
  browser: { memberIds: string[]; requestId?: string };
  ipFailures: number;
  codeAttempts: Record<string, number>;
};

export const newState = (): MockState => ({ groups: [], requests: [], browser: { memberIds: [] }, ipFailures: 0, codeAttempts: {} });

let state = newState();
let seq = 0;
const id = (p: string) => `${p}${++seq}`;
export const getState = () => state;
export function setState(s: MockState) { state = s; }

export function addGroup(name: string, code: string, members: Partial<MockMember>[] = []): MockGroup {
  const g: MockGroup = { id: id("g"), name, code, members: [] };
  for (const m of members) g.members.push({ id: id("m"), name: m.name!, status: m.status ?? "joined", pin: m.pin, hint: m.hint ?? null, fails: 0, lockedUntil: m.lockedUntil });
  state.groups.push(g);
  return g;
}

/** Organiser actions shown in the prototype's side panel (the admin area isn't built yet). */
export const organiser = {
  pendingRequest: () => state.requests.find((r) => r.status === "pending"),
  approve(reqId: string) {
    const r = state.requests.find((x) => x.id === reqId && x.status === "pending");
    if (!r) return;
    const g = addGroup(r.groupName, randomCode(), [{ name: r.name, pin: r.pin, hint: r.hint }]);
    r.status = "approved"; r.groupId = g.id;
  },
  decline(reqId: string) {
    const r = state.requests.find((x) => x.id === reqId && x.status === "pending");
    if (r) r.status = "declined";
  },
};

function randomCode() {
  const a = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return Array.from({ length: 8 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const norm = (s: string) => v.normName(s);
const IP_MAX = 10, CODE_MAX = 30, IP_WAIT = 15 * 60, CODE_WAIT = 60 * 60;

function groupFromCode(raw: unknown) {
  if (state.ipFailures >= IP_MAX) throw Errors.rateLimited(IP_WAIT);
  const code = normalizeGroupCode(raw);
  if (!code) { state.ipFailures++; throw Errors.invalidCode(); }
  state.codeAttempts[code] = (state.codeAttempts[code] ?? 0) + 1;
  if (state.codeAttempts[code]! > CODE_MAX) throw Errors.rateLimited(CODE_WAIT);
  const g = state.groups.find((x) => x.code === code);
  if (!g) { state.ipFailures++; throw Errors.invalidCode(); }
  return g;
}

async function handle(method: string, path: string, body: Record<string, unknown>): Promise<Response> {
  if (method !== "GET" && !("__csrf" in body)) { /* the real app always sends the header; nothing to check here */ }
  if (method === "GET" && path === "/api/health") return json(200, { ok: true, env: "prototype" });

  if (method === "GET" && path === "/api/me") {
    const groups = state.groups.flatMap((g) => g.members.filter((m) => state.browser.memberIds.includes(m.id) && m.status === "joined")
      .map((m) => ({ id: g.id, name: g.name, member: { id: m.id, displayName: m.name } })));
    return json(200, { groups: groups.sort((a, b) => a.name.localeCompare(b.name)) });
  }

  if (method === "POST" && path === "/api/groups/lookup") {
    const g = groupFromCode(body.code);
    return json(200, {
      group: { id: g.id, name: g.name },
      members: g.members.slice().sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map((m) => ({ displayName: m.name, pending: m.status === "pending" })),
    });
  }

  if (method === "POST" && path === "/api/join") {
    const name = v.displayName(body.displayName);
    const pin = v.pin(body.pin);
    const hint = v.pinHint(body.pinHint, pin);
    const g = groupFromCode(body.code);
    const existing = g.members.find((m) => norm(m.name) === norm(name));
    let m: MockMember;
    if (existing?.status === "pending") { existing.status = "joined"; existing.pin = pin; existing.hint = hint; m = existing; }
    else if (existing) throw new ApiError(409, "name_taken", "Someone in this group already uses that name. If it's you, use \"I've been here before\" to sign back in.");
    else { m = { id: id("m"), name, status: "joined", pin, hint, fails: 0 }; g.members.push(m); }
    state.browser.memberIds.push(m.id);
    return json(201, { group: { id: g.id, name: g.name }, member: { id: m.id, displayName: m.name } });
  }

  if (method === "POST" && path === "/api/recover") {
    const name = v.displayName(body.displayName);
    const pin = v.pin(body.pin);
    const g = groupFromCode(body.code);
    const m = g.members.find((x) => norm(x.name) === norm(name) && x.status === "joined");
    const now = Date.now();
    if (!m) { state.ipFailures++; throw Errors.invalidCredentials(); }
    if (m.lockedUntil && m.lockedUntil > now) throw Errors.locked(Math.ceil((m.lockedUntil - now) / 1000));
    let pinWasReset = false;
    if (!m.pin) { m.pin = pin; pinWasReset = true; }
    else if (m.pin !== pin) {
      m.fails++; state.ipFailures++;
      if (m.fails >= 5) { m.fails = 0; m.lockedUntil = now + 15 * 60_000; throw Errors.locked(15 * 60); }
      throw Errors.invalidCredentials();
    }
    m.fails = 0; m.lockedUntil = undefined;
    if (!state.browser.memberIds.includes(m.id)) state.browser.memberIds.push(m.id);
    return json(200, { group: { id: g.id, name: g.name }, member: { id: m.id, displayName: m.name }, pinWasReset });
  }

  if (method === "POST" && path === "/api/groups/hint") {
    const g = groupFromCode(body.code);
    const name = v.displayName(body.displayName);
    const m = g.members.find((x) => norm(x.name) === norm(name) && x.status === "joined");
    return json(200, { hint: m?.hint ?? null });
  }

  if (method === "POST" && path === "/api/group-requests") {
    const groupName = typeof body.groupName === "string" ? body.groupName.trim() : "";
    if (!groupName) throw Errors.validation("Enter a name for your group.");
    if (groupName.length > 60) throw Errors.validation("Group names can be up to 60 characters.");
    const name = v.displayName(body.displayName);
    const pin = v.pin(body.pin);
    const hint = v.pinHint(body.pinHint, pin);
    const r: MockRequest = { id: id("r"), groupName, currency: String(body.currency ?? "USD").toUpperCase(), name, pin, hint, status: "pending" };
    state.requests.push(r);
    state.browser.requestId = r.id;
    return json(201, { request: { id: r.id, status: "pending", groupName } });
  }

  if (method === "GET" && path === "/api/group-requests/current") {
    const r = state.requests.find((x) => x.id === state.browser.requestId);
    if (!r) return json(404, { error: "no_request", message: "No group request on this device." });
    if (r.status === "approved" && r.groupId) {
      const g = state.groups.find((x) => x.id === r.groupId)!;
      state.browser.memberIds.push(g.members[0]!.id);
      state.browser.requestId = undefined;
      return json(200, { status: "approved", groupName: r.groupName, group: { id: g.id, name: g.name } });
    }
    return json(200, { status: r.status, groupName: r.groupName });
  }

  return json(404, { error: "not_found", message: "Not found." });
}

/** Routes the app's /api fetches to the pretend server, with a short, realistic delay. */
export function installMockFetch(onCall?: (method: string, path: string, status: number) => void) {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    if (!url.startsWith("/api/")) return real(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    let body: Record<string, unknown> = {};
    try { body = init?.body ? JSON.parse(String(init.body)) : {}; } catch {}
    await new Promise((r) => setTimeout(r, 250));
    let res: Response;
    try { res = await handle(method, url, body); }
    catch (e) {
      if (e instanceof ApiError) res = json(e.status, { error: e.code, message: e.message }, e.headers);
      else res = json(500, { error: "server_error", message: "Something went wrong. Please try again." });
    }
    onCall?.(method, url, res.status);
    return res;
  };
}
