const KEY = "theme";

export type ThemePref = "dark" | "light";

/** Stored user choice, or null when the user has never touched the toggle. */
export function getStoredTheme(): ThemePref | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "light" ? v : null;
}

export function setStoredTheme(t: ThemePref): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, t);
}

/** Whether the OS is currently requesting a dark color scheme. */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/**
 * Initial dark flag: stored choice wins; otherwise follow the OS.
 */
export function resolveDark(): boolean {
  const stored = getStoredTheme();
  if (stored) return stored === "dark";
  return systemPrefersDark();
}

/** Mirrors resolveDark() for use in the layout's inline bootstrap script. */
export const themeBootstrapScript = `(function(){try{var k='theme',s=localStorage.getItem(k),d=(s==='dark')||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}}catch(e){}})();`;
