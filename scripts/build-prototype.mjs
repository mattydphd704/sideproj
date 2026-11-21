// Builds the clickable prototype and inlines it into one self-contained HTML file
// in the format the Artifact viewer publishes. Usage: node scripts/build-prototype.mjs <out.html>
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "dist/prototype/prototype-inline.html";
const b = spawnSync("npx", ["vite", "build", "--config", "vite.prototype.config.ts"], { stdio: "inherit" });
if (b.status !== 0) process.exit(b.status ?? 1);
const dir = "dist/prototype/assets";
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8"));
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dir, f), "utf8"));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.length}`);
const safeJs = js[0].replace(/<\/script/gi, "<\\/script");
const safeCss = css.join("\n").replace(/<\/style/gi, "<\\/style");
const html = `<title>Gift Lists Prototype</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${safeCss}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`;
writeFileSync(out, html);
console.log(`Prototype written to ${out} (${Math.round(html.length / 1024)} KB)`);
