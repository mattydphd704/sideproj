// Runs every baseline check and writes the results to docs/TEST_RESULTS.md.
// Usage: npm run verify
// Everything runs locally. Nothing is sent to Cloudflare.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "docs/TEST_RESULTS.md";
const HISTORY_START = "<!-- history:start -->";
const HISTORY_END = "<!-- history:end -->";
const started = new Date();
const checks = [];

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
function record(id, name, ok, detail) {
  checks.push({ id, name, ok, detail: detail.replace(/\s+/g, " ").trim().slice(0, 160) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}  ${ok ? "" : detail.slice(0, 300)}`);
}

// ENV-01: clean install exactly from the lockfile (ADR-13).
{
  const r = run("npm", ["ci", "--no-audit"]);
  const m = r.out.match(/added (\d+) packages/);
  record("ENV-01", "Clean install from lockfile (npm ci)", r.ok, r.ok ? `${m?.[1] ?? "?"} packages installed` : r.out);
}
// ENV-02: dependency security audit.
{
  const r = run("npm", ["audit"]);
  const m = r.out.match(/found (\d+) vulnerabilit/);
  record("ENV-02", "Security audit (npm audit)", r.ok, m ? `${m[1]} vulnerabilities` : r.out);
}
// ENV-03: type check.
{
  const r = run("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"]);
  record("ENV-03", "Type check (src, tests, scripts)", r.ok, r.ok ? "no type errors" : r.out);
}
// ENV-04: production build.
{
  const r = run("npx", ["vite", "build"]);
  record("ENV-04", "Production build", r.ok, r.ok ? "web app + Worker built" : r.out);
}
// ENV-05: migrations apply cleanly to an empty database using wrangler's own tool.
{
  const dir = mkdtempSync(join(tmpdir(), "giftlist-verify-"));
  const r = run("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", dir]);
  const m = r.out.match(/(\d+) commands executed successfully/);
  record("ENV-05", "Migrations apply to an empty database", r.ok && !!m, m ? `${m[1]} SQL statements applied` : r.out);
  rmSync(dir, { recursive: true, force: true });
}
// TST-*: automated test suite (Vitest), one row per test.
const tests = [];
{
  const jsonFile = join(mkdtempSync(join(tmpdir(), "giftlist-vitest-")), "r.json");
  const r = run("npx", ["vitest", "run", "--reporter=json", `--outputFile=${jsonFile}`]);
  if (existsSync(jsonFile)) {
    const data = JSON.parse(readFileSync(jsonFile, "utf8"));
    for (const file of data.testResults) {
      for (const t of file.assertionResults) {
        const m = t.title.match(/^\[([A-Z]+-\d+)\]\s*(.*)$/);
        tests.push({
          id: m?.[1] ?? "—",
          name: m?.[2] ?? t.title,
          suite: t.ancestorTitles.join(" › "),
          file: file.name.replace(process.cwd() + "/", ""),
          ok: t.status === "passed",
          ms: Math.round(t.duration ?? 0),
        });
      }
    }
  }
  const passed = tests.filter((t) => t.ok).length;
  record("ENV-06", "Automated test suite (Vitest)", r.ok && tests.length > 0, `${passed}/${tests.length} tests passed`);
}
// ENV-07..09: start the app locally and call it like a browser would.
{
  const port = 5199;
  // The local server needs .dev.vars (gitignored). A fresh checkout doesn't have it, so create it
  // from the example, which holds only local placeholders (BUG-007).
  if (!existsSync(".dev.vars")) writeFileSync(".dev.vars", readFileSync(".dev.vars.example", "utf8"));
  const dev = spawn("npx", ["vite", "dev", "--port", String(port), "--strictPort"], { stdio: "ignore", detached: true });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  try {
    const h = ready ? await (await fetch(`${base}/api/health`)).json() : null;
    record("ENV-07", "API health check reaches the database", h?.ok === true, JSON.stringify(h));
    const j = ready ? await fetch(`${base}/j/K7QM-4XTR`) : null;
    const jt = j ? await j.text() : "";
    record("ENV-08", "Invite path /j/<code> serves the app (FR-1.10)", !!j?.ok && jt.includes("<title>Gift Lists</title>"), `HTTP ${j?.status}`);
    const n = ready ? await fetch(`${base}/api/does-not-exist`) : null;
    const nb = n ? await n.json().catch(() => null) : null;
    record("ENV-09", "Unknown API path returns a JSON 404", n?.status === 404 && nb?.error === "not_found", `HTTP ${n?.status} ${JSON.stringify(nb)}`);
  } finally {
    try { process.kill(-dev.pid, "SIGTERM"); } catch {}
  }
}

// ENV-10: end-to-end browser tests (Playwright, phone + desktop), one row per test.
{
  const jsonFile = join(mkdtempSync(join(tmpdir(), "giftlist-pw-")), "r.json");
  const r = run("npx", ["playwright", "test", "--project=phone", "--project=desktop", "--reporter=json"], {
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile },
  });
  let count = 0, passed = 0;
  if (existsSync(jsonFile)) {
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests) {
          const m = spec.title.match(/^\[([A-Z]+-\d+[a-z]?)\]\s*(.*?)(\s*@desktop)?$/);
          const ok = t.results.length > 0 && t.results.every((x) => x.status === "passed");
          tests.push({ id: m?.[1] ?? "—", name: m?.[2] ?? spec.title, suite: `browser (${t.projectName})`, file: spec.file, ok,
            ms: Math.round(t.results.reduce((a, x) => a + (x.duration ?? 0), 0)) });
          count++; if (ok) passed++;
        }
      }
      for (const child of suite.suites ?? []) walk(child);
    };
    for (const sname of JSON.parse(readFileSync(jsonFile, "utf8")).suites ?? []) walk(sname);
  }
  record("ENV-10", "End-to-end browser tests (Playwright)", r.ok && count > 0, `${passed}/${count} browser tests passed`);
}

// ENV-11: build the clickable prototype and walk every scenario as its card describes.
{
  const bld = run("node", ["scripts/build-prototype.mjs"]);
  const jsonFile = join(mkdtempSync(join(tmpdir(), "giftlist-proto-")), "r.json");
  const r = bld.ok ? run("npx", ["playwright", "test", "--project=prototype", "--reporter=json"], { env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile } }) : bld;
  let count = 0, passed = 0;
  if (existsSync(jsonFile)) {
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) for (const t of spec.tests) {
        const m = spec.title.match(/^\[([A-Z]+-\d+)\]\s*(.*)$/);
        const ok = t.results.length > 0 && t.results.every((x) => x.status === "passed");
        tests.push({ id: m?.[1] ?? "—", name: m?.[2] ?? spec.title, suite: "prototype scenarios", file: spec.file, ok, ms: Math.round(t.results.reduce((a, x) => a + (x.duration ?? 0), 0)) });
        count++; if (ok) passed++;
      }
      for (const c of suite.suites ?? []) walk(c);
    };
    for (const sname of JSON.parse(readFileSync(jsonFile, "utf8")).suites ?? []) walk(sname);
  }
  record("ENV-11", "Prototype builds and every scenario walks as described", r.ok && count > 0, bld.ok ? `${passed}/${count} scenario walkthroughs passed` : bld.out);
}

// ---- write the report ----
const git = (a) => run("git", a).out.trim();
const commit = git(["rev-parse", "--short", "HEAD"]);
const dirty = git(["status", "--porcelain"]).length > 0;
const allOk = checks.every((c) => c.ok);
const passedTests = tests.filter((t) => t.ok).length;
const stamp = started.toISOString().replace("T", " ").slice(0, 16) + " UTC";
const env = `Node ${process.version}, local (this container), no Cloudflare account used`;

const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
const oldHistory = prev.includes(HISTORY_START)
  ? prev.split(HISTORY_START)[1].split(HISTORY_END)[0].trim().split("\n").filter((l) => l.startsWith("| 20"))
  : [];
const historyRow = `| ${stamp} | \`${commit}\`${dirty ? " + uncommitted changes" : ""} | ${allOk ? "✅ PASS" : "❌ FAIL"} | ${checks.filter((c) => c.ok).length}/${checks.length} | ${passedTests}/${tests.length} |`;
const history = [historyRow, ...oldHistory].slice(0, 50);

const md = `# Test Results

Generated automatically by \`npm run verify\` (\`scripts/verify.mjs\`). **Don't edit by hand.** What each test means is described in [TEST_PLAN.md](TEST_PLAN.md).

## Latest run

| | |
|---|---|
| **Result** | ${allOk ? "✅ **PASS**: stable baseline" : "❌ **FAIL**: see failures below"} |
| **When** | ${stamp} |
| **Code version** | \`${commit}\`${dirty ? " (plus uncommitted changes)" : ""} |
| **Environment** | ${env} |
| **Environment checks** | ${checks.filter((c) => c.ok).length} of ${checks.length} passed |
| **Automated tests** | ${passedTests} of ${tests.length} passed |

### Environment checks
| ID | Check | Result | Detail |
|---|---|---|---|
${checks.map((c) => `| ${c.id} | ${c.name} | ${c.ok ? "✅" : "❌"} | ${c.detail.replace(/\|/g, "\\|")} |`).join("\n")}

### Automated tests
| ID | Test | Area | Result | Time |
|---|---|---|---|---|
${tests.map((t) => `| ${t.id} | ${t.name.replace(/\|/g, "\\|")} | ${t.suite || t.file} | ${t.ok ? "✅" : "❌"} | ${t.ms} ms |`).join("\n")}

## Run history (newest first)
${HISTORY_START}
| When | Code version | Result | Env checks | Tests |
|---|---|---|---|---|
${history.join("\n")}
${HISTORY_END}
`;
writeFileSync(OUT, md);
console.log(`\n${allOk ? "PASS" : "FAIL"}: report written to ${OUT}`);
process.exit(allOk ? 0 : 1);
