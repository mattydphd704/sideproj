export type Env = {
  DB: D1Database;
  /** Secret key used for PIN hashes and rate-limit keys (ADR-05). Different in every environment. */
  PIN_PEPPER: string;
  APP_ENV: string;
  SOFT_DELETE_DAYS: string;
  PIN_MAX_ATTEMPTS: string;
  PIN_LOCKOUT_MINUTES: string;
  DASHBOARD_REFRESH_SECONDS: string;
  FAIR_SHARE_BUFFER_DEFAULT: string;
};

export const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
