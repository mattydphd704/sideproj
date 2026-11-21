// Thin API client. Adds the CSRF header (architecture §6.1) and turns errors into ApiError.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfterSec = 0) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        ...(method !== "GET" ? { "x-giftlist-client": "1" } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "offline", "offline");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "server_error", data.message ?? "", Number(res.headers.get("retry-after") ?? 0));
  }
  return data as T;
}

export type Lookup = { group: { id: string; name: string }; members: { displayName: string; pending: boolean }[] };
export type Me = { groups: { id: string; name: string; member: { id: string; displayName: string } }[] };
export type JoinResult = { group: { id: string; name: string }; member: { id: string; displayName: string }; pinWasReset?: boolean };
export type RequestStatus = { status: "pending" | "approved" | "declined"; groupName: string; group?: { id: string; name: string } };

export const api = {
  me: () => request<Me>("GET", "/api/me"),
  lookup: (code: string) => request<Lookup>("POST", "/api/groups/lookup", { code }),
  join: (code: string, displayName: string, pin: string) => request<JoinResult>("POST", "/api/join", { code, displayName, pin }),
  recover: (code: string, displayName: string, pin: string) => request<JoinResult>("POST", "/api/recover", { code, displayName, pin }),
  requestGroup: (b: { groupName: string; currency: string; displayName: string; pin: string }) =>
    request<{ request: { id: string; status: string; groupName: string } }>("POST", "/api/group-requests", b),
  currentRequest: () => request<RequestStatus>("GET", "/api/group-requests/current"),
};
