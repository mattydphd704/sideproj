// Worker entry for the Cloudflare dev deploy (ADR-16): the same app, but it also serves the
// built web app files itself instead of using Workers Static Assets.
import worker from "./index";
import type { Env } from "./env";
import { ASSETS } from "./generated/assets";

const decoded = new Map<string, { type: string; bytes: Uint8Array }>();
function asset(path: string) {
  const hit = decoded.get(path);
  if (hit) return hit;
  const a = ASSETS[path];
  if (!a) return null;
  const v = { type: a.type, bytes: Uint8Array.from(atob(a.body), (c) => c.charCodeAt(0)) };
  decoded.set(path, v);
  return v;
}

export default {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/api/")) return worker.fetch(req, env, ctx);
    // Built files (hashed names) are cached for a long time; everything else is the app shell.
    const file = asset(path);
    if (file) {
      return new Response(file.bytes, { headers: { "content-type": file.type, "cache-control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" } });
    }
    const shell = asset("/index.html")!; // single-page app: /j/<code>, /new, /g/<id> all load the app
    return new Response(shell.bytes, { headers: { "content-type": shell.type, "cache-control": "no-cache" } });
  },
  scheduled: worker.scheduled,
} satisfies ExportedHandler<Env>;
