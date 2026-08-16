"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveDark, setStoredTheme } from "@/lib/themePref";

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
  setDark: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start light on both server and first client render so SSR/hydration
  // never mismatch. The real persisted/system value is adopted in an
  // effect right after mount — by then the bootstrap script in layout
  // has already painted the `dark` class, so there is no flash.
  const [dark, setDarkState] = useState<boolean>(false);

  useEffect(() => {
    // Adopt the persisted/system theme once after mount. Reading it in the
    // state initializer would mismatch SSR (no window) vs client hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    const initial = resolveDark();
    setDarkState(initial);
    document.documentElement.classList.toggle("dark", initial);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const applyDark = useCallback((next: boolean) => {
    setDarkState(next);
    setStoredTheme(next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }, []);

  const setDark = useCallback((next: boolean) => applyDark(next), [applyDark]);

  const toggle = useCallback(() => {
    setDarkState((prev) => {
      const next = !prev;
      setStoredTheme(next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ dark, toggle, setDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
