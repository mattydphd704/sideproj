// UI-13: the wording in the code matches the wording approved in the docs, ID for ID.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { COPY } from "../../src/web/copy";

function docCopy(): Map<string, string> {
  const md = readFileSync("docs/UI_INTERACTION_MAPS.md", "utf8");
  const out = new Map<string, string>();
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*\**(C-[A-Z]+-[A-Z0-9-]+)\**\s*\|[^|]*\|\s*(.*?)\s*\|/);
    if (m) out.set(m[1]!, m[2]!.replace(/\\\|/g, "|").replace(/^\*|\*$/g, ""));
  }
  return out;
}

test("[UI-13] every C- ID in the interaction maps exists in copy.ts with the same text, and vice versa", () => {
  const doc = docCopy();
  expect(doc.size).toBeGreaterThan(50);
  const mismatches: string[] = [];
  for (const [id, text] of doc) {
    if (!(id in COPY)) mismatches.push(`${id}: in the doc but not in copy.ts`);
    else if (COPY[id as keyof typeof COPY] !== text) mismatches.push(`${id}: doc "${text}" ≠ code "${COPY[id as keyof typeof COPY]}"`);
  }
  for (const id of Object.keys(COPY)) if (!doc.has(id)) mismatches.push(`${id}: in copy.ts but not in the doc`);
  expect(mismatches).toEqual([]);
});
