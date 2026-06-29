import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";

export type Role = "passenger" | "driver" | "admin";

export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
}

export interface Driver {
  user_id: string;
  kyc_status: "not_submitted" | "pending" | "approved" | "rejected";
  online: boolean;
  vehicle_no?: string;
  upi_id?: string;
  aadhar_number?: string;
  earnings_total?: number;
  earnings_withdrawn?: number;
  profile_photo?: string;
}

interface AuthState {
  user: User | null;
  driver: Driver | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    setTokenState(t);
    if (!t) {
      setUser(null);
      setDriver(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: User; driver?: Driver }>("/auth/me");
      setUser(data.user);
      setDriver(data.driver || null);
    } catch {
      await setToken(null);
      setTokenState(null);
      setUser(null);
      setDriver(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (t: string, u: User) => {
    await setToken(t);
    setTokenState(t);
    setUser(u);
    await refresh();
  };

  const signOut = async () => {
    // Explicit sign-out only: if a driver signs out, mark them offline while the
    // token is still valid. We intentionally do NOT do this on app close / token
    // expiry — a driver stays online across app restarts unless they sign out.
    if (user?.role === "driver") {
      try {
        await api("/drivers/online", { method: "POST", body: { online: false } });
      } catch {}
    }
    await setToken(null);
    setTokenState(null);
    setUser(null);
    setDriver(null);
  };

  return (
    <Ctx.Provider value={{ user, driver, token, loading, signIn, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
