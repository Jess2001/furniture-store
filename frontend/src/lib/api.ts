const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const ACCESS_KEY = "kl.access";
const REFRESH_KEY = "kl.refresh";

export const AUTH_EXPIRED_EVENT = "auth:expired";

export interface Tokens {
  access: string;
  refresh?: string;
}

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ access, refresh }: Tokens) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh); // the API rotates refresh tokens
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Turns DRF error bodies ({"detail": ...} or {field: [messages]}) into one readable string. */
export function errorMessage(error: unknown): string {
  const data = error instanceof ApiError ? error.data : error;
  const messages: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") messages.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(data);
  if (messages.length) return messages.join(" ");
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`Request failed with status ${status}`);
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time: several requests failing together share a single refresh call. */
function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) {
          tokenStore.clear();
          window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
          return false;
        }
        tokenStore.set((await response.json()) as Tokens);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** false for public endpoints (catalog, login, register): no token is sent. */
  auth?: boolean;
}

export async function api<T>(path: string, { method = "GET", body, auth = true }: RequestOptions = {}): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const access = tokenStore.access;
    if (auth && access) headers.Authorization = `Bearer ${access}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send();
  if (response.status === 401 && auth && tokenStore.refresh) {
    if (await refreshTokens()) response = await send();
  }
  if (!response.ok) {
    throw new ApiError(response.status, await response.json().catch(() => null));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
