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
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { getAuthToken, setAuthToken, setTokenRefreshHandler } from "@/lib/clientApi";
import { setOfflineUser, nuke } from "@/lib/offlineStore";
import type { Role } from "@/lib/types";

export interface SessionClaims {
  role: Role;
  portal?: Role;
  department: string;
  college?: string;
  /** Category a maintenance-family role is assigned to (admin-managed). */
  categoryId?: string;
  categoryName?: string;
  name: string;
  profilePromptDismissed?: boolean;
  /** Dismissed the "data is admin-managed" banner for staff accounts. */
  assignmentNoticeDismissed?: boolean;
  hasPassword?: boolean;
  requiresEmailVerification?: boolean;
}

interface AuthContextValue {
  user: User | null;
  claims: SessionClaims | null;
  ready: boolean;
  needsPasswordSetup: boolean;
  needsEmailVerification: boolean;
  login: (email: string, password: string) => Promise<SessionClaims>;
  loginWithGoogle: () => Promise<SessionClaims>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<SessionClaims>;
  clearNeedsPasswordSetup: () => void;
  reloadUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [ready, setReady] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  const refreshClaims = useCallback(async (force = false): Promise<SessionClaims> => {
    const auth = getClientAuth();
    const current = auth.currentUser;
    if (!current) {
      setClaims(null);
      setAuthToken(null);
      return { role: "reporter", department: "", name: "User" };
    }
    const result = await current.getIdTokenResult(force);
    setAuthToken(result.token);
    const next: SessionClaims = {
      role: (result.claims.role as Role) || "reporter",
      portal: result.claims.portal as Role | undefined,
      department: (result.claims.department as string) || "",
      college: result.claims.college as string | undefined,
      categoryId: (result.claims.categoryId as string) || undefined,
      categoryName: (result.claims.categoryName as string) || undefined,
      profilePromptDismissed: Boolean(result.claims.profilePromptDismissed),
      assignmentNoticeDismissed: Boolean(result.claims.assignmentNoticeDismissed),
      hasPassword: Boolean(result.claims.hasPassword),
      requiresEmailVerification: Boolean(result.claims.requiresEmailVerification),
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
        setOfflineUser(u.uid);
        // Boot with the token the session restore already issued (no extra
        // network round trip) so `ready` flips and the shell paints fast...
        void refreshClaims().then((c) => {
          const hasPwProvider = u.providerData.some((p) => p.providerId === "password");
          setNeedsPasswordSetup(!hasPwProvider && !c.hasPassword);
          setReady(true);
          // ...then reconcile claims that may have changed since that token was
          // minted (e.g. an admin reseated this role) without blocking paint.
          refreshClaims(true).catch(() => undefined);
        });
      } else {
        // Sign-out / switch: wipe the offline store so a different account
        // never sees the previous user's cached data or queued writes.
        void nuke();
        setOfflineUser(null);
        setClaims(null);
        setAuthToken(null);
        setNeedsPasswordSetup(false);
        setReady(true);
      }
    });
    return unsub;
  }, [refreshClaims]);

  // Let `clientApi` refresh an expired ID token on 401 instead of failing.
  useEffect(() => {
    setTokenRefreshHandler(async () => {
      try {
        await refreshClaims(true);
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
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    await signInWithPopup(getClientAuth(), provider);
    return refreshClaims();
  }, [refreshClaims]);

  const logout = useCallback(async () => {
    await signOut(getClientAuth());
  }, []);

  const clearNeedsPasswordSetup = useCallback(() => {
    setNeedsPasswordSetup(false);
  }, []);

  const sendVerificationEmail = useCallback(async (): Promise<void> => {
    const auth = getClientAuth();
    const current = auth.currentUser;
    if (!current) return;
    await sendEmailVerification(current, {
      url: `${window.location.origin}/verify-email`,
      handleCodeInApp: true,
    });
  }, []);

  const reloadUser = useCallback(async (): Promise<void> => {
    const auth = getClientAuth();
    const current = auth.currentUser;
    if (!current) return;
    await current.reload();
    setUser(auth.currentUser);
    if (current.emailVerified) {
      await refreshClaims(true);
    }
  }, [refreshClaims]);

  const needsEmailVerification = Boolean(
    claims?.requiresEmailVerification && user && !user.emailVerified
  );

  const value = useMemo(
    () => ({
      user,
      claims,
      ready,
      needsPasswordSetup,
      needsEmailVerification,
      login,
      loginWithGoogle,
      logout,
      refreshClaims,
      clearNeedsPasswordSetup,
      reloadUser,
      sendVerificationEmail,
    }),
    [
      user,
      claims,
      ready,
      needsPasswordSetup,
      needsEmailVerification,
      login,
      loginWithGoogle,
      logout,
      refreshClaims,
      clearNeedsPasswordSetup,
      reloadUser,
      sendVerificationEmail,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
