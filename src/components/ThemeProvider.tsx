"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getStoredTheme, resolveDark, setStoredTheme } from "@/lib/themePref";

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
  setDark: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState<boolean>(() => resolveDark());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const setDark = useCallback((next: boolean) => {
    setDarkState(next);
    setStoredTheme(next ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setDarkState((prev) => {
      const next = !prev;
      setStoredTheme(next ? "dark" : "light");
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

export { getStoredTheme };
