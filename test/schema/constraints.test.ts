// Verifies the safety rules the database itself enforces (docs/DATA_SCHEMA.md v1.0).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { freshDb } from "../helpers/db";
import * as f from "../helpers/fixtures";

let db: D1Database;
let dispose: () => Promise<void>;
beforeAll(async () => { ({ db, dispose } = await freshDb()); });
afterAll(async () => { await dispose(); });

const rejects = (p: Promise<unknown>) => expect(p).rejects.toThrow();

describe("foreign keys", () => {
  test("[SCH-01] are enforced (a member must belong to a real group)", async () => {
    await rejects(f.member(db, "no_such_group", "Ghost"));
  });
});

describe("groups", () => {
  test("[SCH-02] group code must be exactly 8 characters (G2)", async () => {
    await rejects(f.group(db, { group_code: "SHORT" }));
  });
  test("[SCH-03] group codes are unique", async () => {
    await f.group(db, { group_code: "AAAA2222" });
    await rejects(f.group(db, { group_code: "AAAA2222" }));
  });
  test("[SCH-04] group name max 60 characters (G1)", async () => {
    await f.group(db, { name: "x".repeat(60) });
    await rejects(f.group(db, { name: "x".repeat(61) }));
  });
});

describe("members", () => {
  test("[SCH-05] display names are unique in a group, ignoring case (Q12)", async () => {
    const g = await f.group(db);
    await f.member(db, g, "Sam");
    await rejects(f.member(db, g, "SAM"));
  });
  test("[SCH-06] the same name is fine in a different group", async () => {
    await f.member(db, await f.group(db), "Sam");
    await f.member(db, await f.group(db), "Sam");
  });
  test("[SCH-07] a removed member's name can be reused (G12 interim)", async () => {
    const g = await f.group(db);
    await f.member(db, g, "Alex", { status: "removed", removed_at: Date.now() });
    await f.member(db, g, "Alex");
  });
  test("[SCH-08] display name max 30 characters (G4)", async () => {
    const g = await f.group(db);
    await rejects(f.member(db, g, "x".repeat(31)));
  });
});

describe("items", () => {
  test("[SCH-09] title max 100 characters (G6) and must not be blank", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam");
    await f.item(db, g, m, { title: "x".repeat(100) });
    await rejects(f.item(db, g, m, { title: "x".repeat(101) }));
    await rejects(f.item(db, g, m, { title: "   " }));
  });
  test("[SCH-10] deleted items must record when they were deleted", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam");
    await rejects(f.item(db, g, m, { status: "deleted" }));
    await f.item(db, g, m, { status: "deleted", deleted_at: Date.now() });
  });
  test("[SCH-11] archived items must belong to an archive batch", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam");
    await rejects(f.item(db, g, m, { status: "archived" }));
  });
  test("[SCH-12] mode and visibility only accept the glossary values", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam");
    await rejects(f.item(db, g, m, { mode: "anything" }));
    await rejects(f.item(db, g, m, { visibility: "friends" }));
  });
});

describe("product links", () => {
  test("[SCH-13] need a URL or a description", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam"); const i = await f.item(db, g, m);
    await rejects(f.link(db, i, { url: null }));
    await f.link(db, i, { url: null, description: "Blue scarf, wool" });
  });
  test("[SCH-14] at most 5 positions per item (G8)", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam");
    const i = await f.item(db, g, m, { mode: "givers_choice" });
    for (let p = 1; p <= 5; p++) await f.link(db, i, { position: p });
    await rejects(f.link(db, i, { position: 6 }));
    await rejects(f.link(db, i, { position: 1 }));
  });
  test("[SCH-15] a price needs a currency, and is a whole non-negative number (G16)", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam"); const i = await f.item(db, g, m);
    await rejects(f.link(db, i, { price_minor: 1999 }));
    await rejects(f.link(db, i, { price_minor: -1, currency: "USD" }));
    await f.link(db, i, { price_minor: 1999, currency: "USD" });
  });
  test("[SCH-16] URLs must look like http(s) links", async () => {
    const g = await f.group(db); const m = await f.member(db, g, "Sam"); const i = await f.item(db, g, m);
    await rejects(f.link(db, i, { url: "javascript:alert(1)" }));
  });
});

describe("claims (NFR-2: at most one live claim per item)", () => {
  test("[CLM-01] a second live claim on the same item is rejected", async () => {
    const g = await f.group(db); const owner = await f.member(db, g, "Sam");
    const a = await f.member(db, g, "Alex"); const b = await f.member(db, g, "Jordan");
    const i = await f.item(db, g, owner);
    await f.claim(db, i, a);
    await rejects(f.claim(db, i, b));
  });
  test("[CLM-02] a frozen claim (archived item) also blocks a second claim", async () => {
    const g = await f.group(db); const owner = await f.member(db, g, "Sam");
    const a = await f.member(db, g, "Alex"); const b = await f.member(db, g, "Jordan");
    const i = await f.item(db, g, owner);
    await f.claim(db, i, a, { status: "frozen" });
    await rejects(f.claim(db, i, b));
  });
  test("[CLM-03] after a claim is released, someone else can claim", async () => {
    const g = await f.group(db); const owner = await f.member(db, g, "Sam");
    const a = await f.member(db, g, "Alex"); const b = await f.member(db, g, "Jordan");
    const i = await f.item(db, g, owner);
    const c = await f.claim(db, i, a);
    await db.prepare("UPDATE claims SET status='released', released_at=?, release_reason='unclaimed' WHERE id=?").bind(Date.now(), c).run();
    await f.claim(db, i, b);
  });
  test("[CLM-04] simultaneous claims: exactly one succeeds", async () => {
    const g = await f.group(db); const owner = await f.member(db, g, "Sam");
    const claimers = await Promise.all(["A", "B", "C", "D", "E"].map((x) => f.member(db, g, x)));
    const i = await f.item(db, g, owner);
    const results = await Promise.allSettled(claimers.map((m) => f.claim(db, i, m)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  test("[CLM-05] a released claim must record when it was released", async () => {
    const g = await f.group(db); const owner = await f.member(db, g, "Sam"); const a = await f.member(db, g, "Alex");
    const i = await f.item(db, g, owner);
    await rejects(f.claim(db, i, a, { status: "released" }));
  });
});

describe("permanent delete (FR-7.2, G14)", () => {
  test("[SCH-17] deleting an item removes its links, visibility rows and all claims", async () => {
    const g = await f.group(db); const owner = await f.member(db, g, "Sam");
    const a = await f.member(db, g, "Alex"); const b = await f.member(db, g, "Jordan");
    const i = await f.item(db, g, owner, { visibility: "specific_members" });
    await f.link(db, i);
    await f.insert(db, "item_visibility", { item_id: i, member_id: a });
    const c1 = await f.claim(db, i, a);
    await db.prepare("UPDATE claims SET status='released', released_at=?, release_reason='unclaimed' WHERE id=?").bind(Date.now(), c1).run();
    await f.claim(db, i, b);

    await db.prepare("DELETE FROM items WHERE id=?").bind(i).run();

    for (const t of ["product_links", "item_visibility", "claims"]) {
      const row = await db.prepare(`SELECT count(*) AS n FROM ${t} WHERE item_id=?`).bind(i).first<{ n: number }>();
      expect(row?.n, t).toBe(0);
    }
  });
});
