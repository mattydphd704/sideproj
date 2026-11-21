// Where review flags and scenario results are kept. In the published prototype this is the
// artifact's shared store (the `db` capability), so Claude can read every flag back.
// Anywhere else (a local preview) it falls back to this browser only.
import { COPY } from "../web/copy";

export type FlagKind = "change" | "question" | "bug";
export type Flag = {
  id: string; scenarioId: string; screen: string; copyId: string | null; element: string;
  note: string; kind: FlagKind; status: "open" | "done"; createdAt: number; resolution?: string;
};
export type Run = { scenarioId: string; result: "pass" | "fail"; note: string; updatedAt: number };

export type Store = {
  mode: "shared" | "local";
  onFlags(cb: (f: Flag[]) => void): () => void;
  onRuns(cb: (r: Record<string, Run>) => void): () => void;
  addFlag(f: Omit<Flag, "id" | "status" | "createdAt">): Promise<void>;
  deleteFlag(id: string): Promise<void>;
  setRun(r: Run): Promise<void>;
};

type Doc = { id: string; data(): Record<string, unknown> | undefined };

async function sharedDb(): Promise<any | null> {
  const claude = (window as any).claude;
  if (!claude?.use) return null;
  return Promise.race([claude.use("db").catch(() => null), new Promise((r) => setTimeout(() => r(null), 10_000))]);
}

export async function connectStore(): Promise<Store> {
  const db = await sharedDb();
  if (db) {
    return {
      mode: "shared",
      onFlags: (cb) => db.collection("flags").orderBy("createdAt", "desc").onSnapshot(
        (s: { docs: Doc[] }) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<Flag, "id">), id: d.id }))),
        () => cb([]),
      ),
      onRuns: (cb) => db.collection("runs").onSnapshot(
        (s: { docs: Doc[] }) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data() as Run]))),
        () => cb({}),
      ),
      addFlag: async (f) => { await db.collection("flags").add({ ...f, status: "open", createdAt: Date.now() }); },
      deleteFlag: async (id) => { await db.doc(`flags/${id}`).delete(); },
      setRun: async (r) => { await db.doc(`runs/${r.scenarioId}`).set(r); },
    };
  }
  // Local fallback: this browser only.
  const KEY = "gl-proto-v1";
  const read = (): { flags: Flag[]; runs: Record<string, Run> } => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "") ; } catch { return { flags: [], runs: {} }; }
  };
  const listeners = new Set<() => void>();
  const write = (v: ReturnType<typeof read>) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} listeners.forEach((l) => l()); };
  const sub = (fn: () => void) => { listeners.add(fn); fn(); return () => { listeners.delete(fn); }; };
  return {
    mode: "local",
    onFlags: (cb) => sub(() => cb(read().flags ?? [])),
    onRuns: (cb) => sub(() => cb(read().runs ?? {})),
    addFlag: async (f) => { const v = read(); v.flags = [{ ...f, id: `f${Date.now()}`, status: "open", createdAt: Date.now() }, ...(v.flags ?? [])]; write(v); },
    deleteFlag: async (id) => { const v = read(); v.flags = (v.flags ?? []).filter((x) => x.id !== id); write(v); },
    setRun: async (r) => { const v = read(); v.runs = { ...(v.runs ?? {}), [r.scenarioId]: r }; write(v); },
  };
}

// ---- Identify what was clicked, by matching on-screen text to the C- wording IDs ----
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = Object.entries(COPY).map(([id, text]) => ({
  id,
  re: new RegExp(`^${esc(text).replace(/\\\{\w+\\\}/g, ".+")}$`, "s"),
}));

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function identify(target: Element, root: Element): { copyId: string | null; element: string } {
  let el: Element | null = target;
  let firstText = "";
  for (let depth = 0; el && el !== root && depth < 6; depth++, el = el.parentElement) {
    const candidates = [
      clean((el as HTMLElement).innerText),
      clean(el.getAttribute("placeholder")),
      clean(el.getAttribute("aria-label")),
    ];
    // A field: use its label's text.
    if (el.id) {
      const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) candidates.unshift(clean((label as HTMLElement).innerText));
    }
    for (const text of candidates) {
      if (!text) continue;
      if (!firstText) firstText = text;
      const hit = MATCHERS.find((m) => m.re.test(text));
      if (hit) return { copyId: hit.id, element: text.slice(0, 140) };
    }
  }
  return { copyId: null, element: (firstText || target.tagName.toLowerCase()).slice(0, 140) };
}

export function screenName(root: Element): string {
  const h = root.querySelector('[data-slot="card-title"], h1, h2');
  return clean((h as HTMLElement | null)?.innerText) || "Home";
}
