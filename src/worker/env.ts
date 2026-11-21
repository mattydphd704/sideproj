export type Env = {
  DB: D1Database;
  /** Secret key used for PIN hashes and rate-limit keys (ADR-05). Different in every environment. */
  PIN_PEPPER: string;
  /** Secret key for the admin protocol (ADR-17). Admin endpoints are off unless it's set (32+ characters). */
  ADMIN_KEY?: string;
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
