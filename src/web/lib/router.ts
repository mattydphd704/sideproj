// Minimal client-side router (no extra package). Routes are listed in UI_INTERACTION_MAPS §1.0.
import { useEffect, useState } from "react";

export type Route =
  | { name: "home"; prefillCode?: string }
  | { name: "join"; code: string; mode: "join" | "recover" }
  | { name: "new" }
  | { name: "group"; groupId: string };

export function parse(path: string): Route {
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
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return path;
}

// G21: remember the last group used on this browser (a convenience; safe to lose).
export const lastGroup = {
  get: () => { try { return localStorage.getItem("lastGroup"); } catch { return null; } },
  set: (id: string) => { try { localStorage.setItem("lastGroup", id); } catch {} },
};
