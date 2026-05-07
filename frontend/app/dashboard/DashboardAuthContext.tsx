"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
type AuthState = {
  user: { email: string } | null;
  loading: boolean;
  /** โหมด dev ไม่ต้องล็อกอิน */
  skipAuth: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  setAuthKey: (key: string) => void;
};

const DashboardAuthContext = createContext<AuthState | null>(null);

export function useDashboardAuth(): AuthState {
  const ctx = useContext(DashboardAuthContext);
  if (!ctx) throw new Error("useDashboardAuth must be used within DashboardAuthProvider");
  return ctx;
}

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const [authKey, setAuthKeyInternal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const skipAuth = false; // Always use auth for De-Firebase unless explicitly disabled

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("dashboard_key") : null;
    if (saved) {
      setAuthKeyInternal(saved);
    }
    setLoading(false);
  }, []);

  const setAuthKey = useCallback((key: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard_key", key);
    }
    setAuthKeyInternal(key);
  }, []);

  const signOut = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dashboard_key");
    }
    setAuthKeyInternal(null);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    return authKey;
  }, [authKey]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (skipAuth) return {};
    const token = await getIdToken();
    if (token) return { "X-Admin-Key": token };
    return {};
  }, [getIdToken, skipAuth]);

  const value: AuthState = {
    user: authKey ? { email: "admin@local" } : null,
    loading,
    skipAuth,
    signOut,
    getIdToken,
    getAuthHeaders,
    setAuthKey,
  };

  return (
    <DashboardAuthContext.Provider value={value}>
      {children}
    </DashboardAuthContext.Provider>
  );
}
