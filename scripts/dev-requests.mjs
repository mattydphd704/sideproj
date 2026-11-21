// Engineer-only helper until the admin area exists (Section 5): list, approve or decline
// group requests on the Cloudflare DEV database. Same effect as services/groupRequests.ts.
// Usage: node scripts/dev-requests.mjs list | approve <requestId> | decline <requestId>
// Needs CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in the environment (never committed).
import { spawnSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";

const run = (sql, json = false) => {
  const r = spawnSync("npx", ["wrangler", "d1", "execute", "DB", "--config", "wrangler.dev.jsonc", "--remote", ...(json ? ["--json"] : []), "--command", sql], { encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
  return json ? JSON.parse(r.stdout) : r.stdout;
};
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const [cmd, id] = process.argv.slice(2);

if (cmd === "list") {
  const rows = run("SELECT id, requested_group_name, requester_display_name, requested_currency, status, created_at FROM group_requests ORDER BY created_at DESC LIMIT 20", true)[0].results;
  for (const r of rows) console.log(`${r.status.padEnd(9)} ${r.id}  "${r.requested_group_name}" from ${r.requester_display_name} (${r.requested_currency})  ${new Date(r.created_at).toISOString()}`);
  if (!rows.length) console.log("No group requests.");
} else if (cmd === "approve" && id) {
  const A = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const code = Array.from({ length: 8 }, () => A[randomInt(A.length)]).join("");
  const gid = randomBytes(16).toString("base64url"), mid = randomBytes(16).toString("base64url"), now = Date.now();
  run(`INSERT INTO groups (id, name, group_code, currency, created_via, request_id, created_at)
         SELECT ${q(gid)}, requested_group_name, ${q(code)}, requested_currency, 'request', id, ${now} FROM group_requests WHERE id = ${q(id)} AND status = 'pending';
       INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, pin_hash, pin_salt, pin_hint, joined_at, created_at)
         SELECT ${q(mid)}, ${q(gid)}, requester_display_name, lower(trim(requester_display_name)), 'joined', 'request', requester_pin_hash, requester_pin_salt, requester_pin_hint, ${now}, ${now}
         FROM group_requests WHERE id = ${q(id)} AND status = 'pending';
       UPDATE group_requests SET status = 'approved', group_id = ${q(gid)}, decided_at = ${now} WHERE id = ${q(id)} AND status = 'pending';`);
  console.log(`Approved. New group code: ${code.slice(0, 4)}-${code.slice(4)}`);
} else if (cmd === "decline" && id) {
  run(`UPDATE group_requests SET status = 'declined', decided_at = ${Date.now()} WHERE id = ${q(id)} AND status = 'pending'`);
  console.log("Declined.");
} else {
  console.log("Usage: node scripts/dev-requests.mjs list | approve <requestId> | decline <requestId>");
}
