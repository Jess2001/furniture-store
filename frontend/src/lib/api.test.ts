import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, AUTH_EXPIRED_EVENT, errorMessage, tokenStore } from "./api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const headersOf = (call: number) => (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>;

describe("api", () => {
  it("sends the access token as a bearer header", async () => {
    tokenStore.set({ access: "A1", refresh: "R1" });
    fetchMock.mockResolvedValueOnce(json({ ok: true }));

    await api("/cart/");

    expect(headersOf(0).Authorization).toBe("Bearer A1");
  });

  it("sends no token to public endpoints", async () => {
    tokenStore.set({ access: "A1", refresh: "R1" });
    fetchMock.mockResolvedValueOnce(json([]));

    await api("/categories/", { auth: false });

    expect(headersOf(0).Authorization).toBeUndefined();
  });

  it("refreshes an expired access token once and retries the request", async () => {
    tokenStore.set({ access: "OLD", refresh: "R1" });
    fetchMock
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ access: "NEW", refresh: "R2" }))
      .mockResolvedValueOnce(json({ items: [] }));

    const result = await api<{ items: unknown[] }>("/cart/");

    expect(result.items).toEqual([]);
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh/");
    expect(headersOf(2).Authorization).toBe("Bearer NEW");
    expect(tokenStore.refresh).toBe("R2"); // refresh tokens rotate
  });

  it("shares one refresh between requests that fail together", async () => {
    tokenStore.set({ access: "OLD", refresh: "R1" });
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).includes("/auth/refresh/")) return json({ access: "NEW", refresh: "R2" });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer NEW" ? json({ ok: true }) : json({ detail: "expired" }, 401);
    });

    await Promise.all([api("/cart/"), api("/orders/")]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/refresh/"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("signs the user out when the refresh token no longer works", async () => {
    tokenStore.set({ access: "OLD", refresh: "DEAD" });
    const expired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    fetchMock
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ detail: "bad refresh" }, 401));

    await expect(api("/cart/")).rejects.toBeInstanceOf(ApiError);

    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  });

  it("does not try to refresh when there is no refresh token", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: "no" }, 401));

    await expect(api("/cart/")).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("errorMessage", () => {
  it("flattens DRF validation errors into one sentence", () => {
    const error = new ApiError(400, { password: ["Too common.", "Too short."], email: ["Taken."] });

    expect(errorMessage(error)).toBe("Too common. Too short. Taken.");
  });

  it("understands the detail shape", () => {
    expect(errorMessage(new ApiError(401, { detail: "No active account found." }))).toBe("No active account found.");
  });

  it("has a friendly fallback", () => {
    expect(errorMessage(undefined)).toMatch(/something went wrong/i);
  });
});
