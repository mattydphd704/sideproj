// Minimal client-side router (no extra package). Routes are listed in UI_INTERACTION_MAPS §1.0.
// Normally it uses the browser address bar. The clickable prototype switches it to an
// in-memory path, because the prototype runs inside another page (see src/prototype).
import { useEffect, useState } from "react";

export type Route =
  | { name: "home"; prefillCode?: string }
  | { name: "join"; code: string; mode: "join" | "recover" }
  | { name: "new" }
  | { name: "group"; groupId: string };

let memoryPath: string | null = null;
const EVENT = "gl:navigate";

/** Prototype only: keep the current path in memory instead of the address bar. */
export function startMemoryRouting(startPath: string) {
  memoryPath = startPath;
  window.dispatchEvent(new Event(EVENT));
}

/** Current path including any query string, e.g. "/?add=1". */
export const currentPath = () => memoryPath ?? location.pathname + location.search;

export function query(path = currentPath()) {
  return new URLSearchParams(path.split("?")[1] ?? "");
}

export function parse(fullPath: string): Route {
  const path = fullPath.split("?")[0]!;
  const j = path.match(/^\/j\/([^/]+)\/?$/);
  if (j) return { name: "join", code: decodeURIComponent(j[1]!), mode: "join" };
  const r = path.match(/^\/j\/([^/]+)\/back\/?$/);
  if (r) return { name: "join", code: decodeURIComponent(r[1]!), mode: "recover" };
  const g = path.match(/^\/g\/([^/]+)\/?$/);
  if (g) return { name: "group", groupId: decodeURIComponent(g[1]!) };
  if (path === "/new") return { name: "new" };
  return { name: "home" };
}

export function navigate(path: string, replace = false) {
  if (memoryPath !== null) memoryPath = path;
  else if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new Event(EVENT));
}

export function usePath() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener("popstate", on);
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener("popstate", on); window.removeEventListener(EVENT, on); };
  }, []);
  return path;
}

// G21: remember the last group used on this browser (a convenience; safe to lose).
export const lastGroup = {
  get: () => { try { return localStorage.getItem("lastGroup"); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem("lastGroup", id); } catch {} },
  clear: () => { try { localStorage.removeItem("lastGroup"); } catch {} },
};
