import { generateGroupCode } from "../lib/codes";
import { newId } from "../lib/crypto";

export type GroupRow = { id: string; name: string; group_code: string; currency: string };

/** Creates a group with a fresh, unique code. Used by the admin area and approved requests. */
export async function createGroup(
  db: D1Database,
  input: { name: string; currency: string; createdVia: "admin" | "request"; requestId?: string },
  now = Date.now(),
): Promise<GroupRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = { id: newId(), name: input.name.trim(), group_code: generateGroupCode(), currency: input.currency.toUpperCase() };
    try {
      await db.prepare(
        `INSERT INTO groups (id, name, group_code, currency, created_via, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(row.id, row.name, row.group_code, row.currency, input.createdVia, input.requestId ?? null, now).run();
      return row;
    } catch (e) {
      // A clash with an existing code is astronomically rare; try a new code.
      if (!String(e).includes("groups.group_code")) throw e;
    }
  }
  throw new Error("Could not generate a unique group code");
}

export const findGroupByCode = (db: D1Database, code: string) =>
  db.prepare("SELECT id, name, group_code, currency FROM groups WHERE group_code = ?").bind(code).first<GroupRow>();

export const bumpGroupVersion = (db: D1Database, groupId: string) =>
  db.prepare("UPDATE groups SET version = version + 1 WHERE id = ?").bind(groupId);
