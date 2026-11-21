import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import { Errors } from "../lib/errors";
import * as v from "../lib/validate";
import { LIMITS } from "../../shared/limits";
import { bucketKey, hit } from "../services/rateLimit";
import * as reqs from "../services/groupRequests";
import { issueMemberToken } from "../auth/session";

export const groupRequests = new Hono<{ Bindings: Env }>();

// One request cookie per browser (architecture §6.1).
const REQUEST_COOKIE = "r_request";
const REQUEST_LIMIT = { max: 5, windowMs: 60 * 60_000 }; // 5 requests per network per hour

function groupName(vv: unknown): string {
  if (typeof vv !== "string" || !vv.trim()) throw Errors.validation("Enter a name for your group.");
  const s = vv.trim().replace(/\s+/g, " ");
  if (s.length > LIMITS.groupNameMax) throw Errors.validation(`Group names can be up to ${LIMITS.groupNameMax} characters.`);
  return s;
}
function currency(vv: unknown): string {
  if (typeof vv !== "string" || !/^[A-Za-z]{3}$/.test(vv)) throw Errors.validation("Choose a currency.");
  return vv.toUpperCase();
}

/** Ask for a new group (T-06). */
groupRequests.post("/api/group-requests", async (c) => {
  const now = Date.now();
  const body = await v.jsonBody(c.req.raw);
  const input = {
    groupName: groupName(body.groupName),
    currency: currency(body.currency),
    displayName: v.displayName(body.displayName),
    pin: v.pin(body.pin),
  };
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const wait = await hit(c.env.DB, await bucketKey(c.env.PIN_PEPPER, "req", ip), REQUEST_LIMIT, now);
  if (wait) throw Errors.rateLimited(wait);
  const { id, token } = await reqs.createRequest(c.env.DB, c.env.PIN_PEPPER, input, now);
  setCookie(c, REQUEST_COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 90 * 24 * 3600 });
  return c.json({ request: { id, status: "pending", groupName: input.groupName } }, 201);
});

/** Check this browser's request (T-07, T-08). On approval, moves the browser into the group. */
groupRequests.get("/api/group-requests/current", async (c) => {
  const token = getCookie(c, REQUEST_COOKIE);
  const r = token ? await reqs.findRequestByToken(c.env.DB, token) : null;
  if (!r) return c.json({ error: "no_request", message: "No group request on this device." }, 404);
  if (r.status === "approved" && r.group_id) {
    const m = await reqs.requesterMember(c.env.DB, r.group_id);
    if (m) await issueMemberToken(c, c.env.DB, m.id, r.group_id);
    deleteCookie(c, REQUEST_COOKIE, { path: "/", secure: true });
    return c.json({ status: "approved", groupName: r.requested_group_name, group: { id: r.group_id, name: r.requested_group_name } });
  }
  return c.json({ status: r.status, groupName: r.requested_group_name });
});
