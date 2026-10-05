import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, AUTH_EXPIRED_EVENT, tokenStore, type Tokens } from "../lib/api";
import type { User } from "../lib/types";

interface RegisterInput {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.access || tokenStore.refresh));
  const [authOpen, setAuthOpen] = useState(false);

  // restore the session on page load
  useEffect(() => {
    if (!tokenStore.access && !tokenStore.refresh) return;
    api<User>("/auth/me/")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // the API layer fires this when a refresh token stops working
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      queryClient.removeQueries({ queryKey: ["cart"] });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api<Required<Tokens>>("/auth/login/", { method: "POST", body: { email, password }, auth: false });
    tokenStore.set(tokens);
    setUser(await api<User>("/auth/me/"));
    setAuthOpen(false);
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await api("/auth/register/", { method: "POST", body: input, auth: false });
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh;
    try {
      if (refresh) await api("/auth/logout/", { method: "POST", body: { refresh } });
    } catch {
      // even if the server call fails we still sign out locally
    } finally {
      tokenStore.clear();
      setUser(null);
      queryClient.removeQueries({ queryKey: ["cart"] });
    }
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      authOpen,
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
    }),
    [user, loading, login, register, logout, authOpen],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
