import type { Lookup } from "../lib/api";
// Avoids looking a code up twice when moving from Home to Join (each lookup counts toward the rate limit).
export const lookupCache = new Map<string, Lookup>();
