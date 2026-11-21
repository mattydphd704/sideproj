import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";

// A fresh, in-memory local D1 database (real SQLite in Cloudflare's local
// runtime) with every migration applied. Nothing is sent to Cloudflare.
export async function freshDb() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: "wrangler.jsonc",
    persist: false,
  });
  const db = proxy.env.DB;
  for (const file of readdirSync("migrations").filter((f: string) => f.endsWith(".sql")).sort()) {
    for (const stmt of splitSql(readFileSync(join("migrations", file), "utf8"))) {
      await db.prepare(stmt).run();
    }
  }
  return { db, dispose: () => proxy.dispose() };
}

// Splits a migration into statements. Our migrations have no semicolons inside
// string literals, and comments are whole-line or trailing "--" comments.
export function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
