// Admin protocol command line (docs/ADMIN_PROTOCOL.md, ADR-17).
//
//   npm run admin -- [--env dev|local] [--json] <command>
//     requests [pending|approved|declined|all]   the group request queue
//     groups                                     every group, with code and invite link
//     group <groupId>                            one group and the state of everyone in it
//     plan <changeset.json>                      check a change set; writes nothing
//     apply <changeId> <planId>                  run a reviewed plan, all or nothing
//     changes                                    the audit log
//
// The key: on dev, this session's network proxy adds the X-Admin-Key header itself, so the key
// is never on this machine. Locally, it comes from ADMIN_KEY or .dev.vars. Never pass it as an argument.
import { existsSync, readFileSync } from "node:fs";

const HOSTS = { dev: "https://giftlist-dev.mcjdonovan.workers.dev", local: "http://127.0.0.1:5173" };
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const val = args[i + 1]; args.splice(i, 2); return val; };
const env = flag("--env") ?? "dev";
const base = flag("--url") ?? HOSTS[env];
const asJson = args.includes("--json") && args.splice(args.indexOf("--json"), 1);
if (!base) die(`Unknown --env "${env}". Use dev or local.`);

function die(msg) { console.error(msg); process.exit(1); }
function localKey() {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY;
  if (existsSync(".dev.vars")) return readFileSync(".dev.vars", "utf8").match(/^ADMIN_KEY="?([^"\n]+)"?/m)?.[1];
  return undefined;
}

async function call(method, path, body) {
  const headers = { "x-giftlist-client": "1" };
  if (body) headers["content-type"] = "application/json";
  if (env === "local") { const k = localKey(); if (k) headers["x-admin-key"] = k; }
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { die(`Couldn't reach ${base}: ${e.cause?.message ?? e.message}`); }
  const json = await res.json().catch(() => ({ error: "not_json", message: `HTTP ${res.status}` }));
  return { status: res.status, json };
}

const when = (iso) => (iso ? iso.replace("T", " ").slice(0, 16) + " UTC" : "—");
const STATE = { joined: "Joined", not_joined_yet: "Not joined yet", locked: "Locked", pin_reset_waiting: "PIN reset, waiting" };

function show(r, human) {
  if (asJson || r.status >= 400) {
    console.log(JSON.stringify(r.json, null, 2));
    if (r.status >= 400) process.exit(2);
    return;
  }
  human(r.json);
}

const [cmd, a1, a2] = args;
switch (cmd) {
  case "requests":
    show(await call("GET", `/api/admin/requests?status=${a1 ?? "pending"}`), ({ requests }) => {
      if (!requests.length) return console.log("No requests.");
      for (const r of requests) console.log(`${r.status.padEnd(9)} ${r.id}  "${r.groupName}" from ${r.requester} (${r.currency})  sent ${when(r.createdAt)}`);
    });
    break;
  case "groups":
    show(await call("GET", "/api/admin/groups"), ({ groups }) => {
      if (!groups.length) return console.log("No groups.");
      for (const g of groups) console.log(`${g.id}  "${g.name}"  ${g.code}  ${g.joined} joined, ${g.notJoinedYet} not joined yet  (${g.currency}, ${g.createdVia}, ${when(g.createdAt)})`);
    });
    break;
  case "group":
    if (!a1) die("Usage: group <groupId>");
    show(await call("GET", `/api/admin/groups/${encodeURIComponent(a1)}`), ({ group: g, members }) => {
      console.log(`"${g.name}"  code ${g.code}  ${g.inviteUrl}\n${g.currency}, fair-share setting ${g.fairShareBuffer}, created ${when(g.createdAt)} (${g.createdVia})`);
      for (const m of members) {
        const extra = m.state === "locked" ? ` until ${when(m.lockedUntil)}` : "";
        console.log(`  ${m.name.padEnd(30)} ${(STATE[m.state] + extra).padEnd(34)} ${m.devices} device(s), last seen ${when(m.lastSeenAt)}`);
      }
    });
    break;
  case "plan": {
    if (!a1) die("Usage: plan <changeset.json>");
    const r = await call("POST", "/api/admin/plan", JSON.parse(readFileSync(a1, "utf8")));
    if (asJson) { console.log(JSON.stringify(r.json, null, 2)); break; }
    const j = r.json;
    if (r.status === 422) {
      console.log(`NOT PLANNED: ${j.message}`);
      for (const s of j.steps ?? []) console.log(`  [${s.index}] ${s.summary}`);
      for (const e of j.errors) console.log(`  [${e.index}] ✗ ${e.message}`);
      process.exit(2);
    }
    if (r.status !== 200) { console.log(JSON.stringify(j, null, 2)); process.exit(2); }
    console.log(`PLAN for "${j.changeId}" (nothing has changed yet):`);
    for (const s of j.steps) console.log(`  [${s.index}] ${s.summary}`);
    for (const w of j.warnings) console.log(`  [${w.index}] ! ${w.message}`);
    console.log(`\nTo apply: npm run admin -- --env ${env} apply ${j.changeId} ${j.planId}\n(valid until ${when(j.expiresAt)})`);
    break;
  }
  case "apply":
    if (!a1 || !a2) die("Usage: apply <changeId> <planId>");
    show(await call("POST", "/api/admin/apply", { changeId: a1, planId: a2 }), (j) => {
      console.log(`APPLIED "${j.changeId}" at ${when(j.appliedAt)}${j.replayed ? " (already applied earlier; same result)" : ""}:`);
      for (const s of j.steps) console.log(`  ${s}`);
      for (const g of j.newGroups) console.log(`\nNew group "${g.name}": code ${g.code}\n  Invite link: ${g.inviteUrl}\n  Group ID: ${g.id}`);
    });
    break;
  case "changes":
    show(await call("GET", "/api/admin/changes"), ({ changes }) => {
      if (!changes.length) return console.log("No change sets yet.");
      for (const c of changes) {
        console.log(`${c.status.padEnd(8)} ${c.changeId}  ${c.note ?? ""}  planned ${when(c.plannedAt)}${c.appliedAt ? `, applied ${when(c.appliedAt)}` : ""}`);
        for (const s of c.steps) console.log(`    ${s}`);
      }
    });
    break;
  default:
    die("Usage: npm run admin -- [--env dev|local] [--json] requests [status] | groups | group <id> | plan <file> | apply <changeId> <planId> | changes");
}
