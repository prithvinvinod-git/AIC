const KEY = "notify-sound";

/** Whether the in-app notification beep is enabled (defaults to on). */
export function soundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) !== "off";
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "on" : "off");
}
