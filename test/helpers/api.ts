import { createApp, type Env } from "../../src/worker/index";

export const TEST_PEPPER = "test-pepper";

export function makeEnv(db: D1Database, over: Partial<Env> = {}): Env {
  return {
    DB: db, PIN_PEPPER: TEST_PEPPER, APP_ENV: "test", SOFT_DELETE_DAYS: "90", PIN_MAX_ATTEMPTS: "5",
    PIN_LOCKOUT_MINUTES: "15", DASHBOARD_REFRESH_SECONDS: "30", FAIR_SHARE_BUFFER_DEFAULT: "1.0", ...over,
  };
}

/** A tiny browser: remembers cookies between calls and sends the app's CSRF header. */
export class Client {
  cookies = new Map<string, string>();
  constructor(private env: Env, public ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) {}
  app = createApp();

  async call(method: string, path: string, body?: unknown, opts: { headers?: Record<string, string>; csrf?: boolean } = {}) {
    const headers: Record<string, string> = { "cf-connecting-ip": this.ip, ...opts.headers };
    if (opts.csrf !== false && method !== "GET") headers["x-giftlist-client"] = "1";
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await this.app.request(`https://giftlist.test${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }, this.env);
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(";");
      const i = pair!.indexOf("=");
      this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, headers: res.headers, setCookies: res.headers.getSetCookie() };
  }
  post = (p: string, b?: unknown, o?: Parameters<Client["call"]>[3]) => this.call("POST", p, b, o);
  get = (p: string) => this.call("GET", p);
}
