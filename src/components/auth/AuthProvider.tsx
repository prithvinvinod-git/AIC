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
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { getAuthToken, setAuthToken, setTokenRefreshHandler } from "@/lib/clientApi";
import type { Role } from "@/lib/types";

export interface SessionClaims {
  role: Role;
  portal?: Role;
  department: string;
  college?: string;
  name: string;
  profilePromptDismissed?: boolean;
}

interface AuthContextValue {
  user: User | null;
  claims: SessionClaims | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<SessionClaims>;
  loginWithGoogle: () => Promise<SessionClaims>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<SessionClaims>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [ready, setReady] = useState(false);

  const refreshClaims = useCallback(async (): Promise<SessionClaims> => {
    const auth = getClientAuth();
    const current = auth.currentUser;
    if (!current) {
      setClaims(null);
      setAuthToken(null);
      return { role: "reporter", department: "", name: "User" };
    }
    const result = await current.getIdTokenResult(true);
    setAuthToken(result.token);
    const next: SessionClaims = {
      role: (result.claims.role as Role) || "reporter",
      portal: result.claims.portal as Role | undefined,
      department: (result.claims.department as string) || "",
      college: result.claims.college as string | undefined,
      profilePromptDismissed: Boolean(result.claims.profilePromptDismissed),
      name:
        (result.claims.name as string) ||
        current.displayName ||
        current.email?.split("@")[0] ||
        "User",
    };
    setClaims(next);
    return next;
  }, []);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        void refreshClaims().finally(() => setReady(true));
      } else {
        setClaims(null);
        setAuthToken(null);
        setReady(true);
      }
    });
    return unsub;
  }, [refreshClaims]);

  // Let `clientApi` refresh an expired ID token on 401 instead of failing.
  useEffect(() => {
    setTokenRefreshHandler(async () => {
      try {
        await refreshClaims();
        return getAuthToken();
      } catch {
        return null;
      }
    });
    return () => setTokenRefreshHandler(null);
  }, [refreshClaims]);

  const login = useCallback(
    async (email: string, password: string): Promise<SessionClaims> => {
      await signInWithEmailAndPassword(getClientAuth(), email, password);
      return refreshClaims();
    },
    [refreshClaims]
  );

  const loginWithGoogle = useCallback(async (): Promise<SessionClaims> => {
    await signInWithPopup(getClientAuth(), new GoogleAuthProvider());
    return refreshClaims();
  }, [refreshClaims]);

  const logout = useCallback(async () => {
    await signOut(getClientAuth());
  }, []);

  const value = useMemo(
    () => ({ user, claims, ready, login, loginWithGoogle, logout, refreshClaims }),
    [user, claims, ready, login, loginWithGoogle, logout, refreshClaims]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
