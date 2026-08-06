"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { setAuthToken } from "@/lib/clientApi";
import type { Role } from "@/lib/types";

export interface SessionClaims {
  role: Role;
  department: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  claims: SessionClaims | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [ready, setReady] = useState(false);

  const refreshClaims = useCallback(async () => {
    const auth = getClientAuth();
    const current = auth.currentUser;
    if (!current) {
      setClaims(null);
      setAuthToken(null);
      return;
    }
    const result = await current.getIdTokenResult(true);
    setAuthToken(result.token);
    setClaims({
      role: (result.claims.role as Role) || "reporter",
      department: (result.claims.department as string) || "",
      name:
        (result.claims.name as string) ||
        current.displayName ||
        current.email?.split("@")[0] ||
        "User",
    });
  }, []);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        void refreshClaims();
      } else {
        setClaims(null);
        setAuthToken(null);
      }
      setReady(true);
    });
    return unsub;
  }, [refreshClaims]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email, password);
    await refreshClaims();
  }, [refreshClaims]);

  const logout = useCallback(async () => {
    await signOut(getClientAuth());
  }, []);

  const value = useMemo(
    () => ({ user, claims, ready, login, logout, refreshClaims }),
    [user, claims, ready, login, logout, refreshClaims]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
