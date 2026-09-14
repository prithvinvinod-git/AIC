import "server-only";

// Lazily-initialised Genkit runtime. Created only when an AI provider key is
// present; otherwise every flow falls back to the deterministic keyword
// classifier so the app stays fully demoable without any AI key.
//
// Providers:
//   - Gemini (Google AI Studio) via @genkit-ai/googleai
//   - Groq (fast open models) via the community genkitx-groq plugin

let aiInstance: Awaited<ReturnType<typeof createGenkit>> | null = null;

async function createGenkit() {
  const [{ genkit }, { googleAI }] = await Promise.all([
    import("genkit"),
    import("@genkit-ai/googleai"),
  ]);
  const plugins: Awaited<ReturnType<typeof googleAI>>[] = [googleAI()];
  if (groqEnabled()) {
    const { groq } = await import("genkitx-groq");
    plugins.push(groq({ apiKey: process.env.GROQ_API_KEY }) as Awaited<ReturnType<typeof googleAI>>);
  }
  return genkit({ plugins });
}

export async function getGenkit() {
  if (!aiInstance) aiInstance = await createGenkit();
  return aiInstance;
}

/**
 * Real gate: a live AI provider key AND (if an override is given) the
 * admin-persisted `config.ai.enabled` flag. `override === false` force-disables
 * AI even when keys are present; `undefined` means "keys only" (used where the
 * caller doesn't hold a config, or the feature intentionally ignores the toggle).
 */
export function aiEnabled(override?: boolean): boolean {
  if (override === false) return false;
  return (
    (process.env.GOOGLE_GENAI_API_KEY !== undefined &&
      process.env.GOOGLE_GENAI_API_KEY !== "" &&
      process.env.GOOGLE_GENAI_API_KEY !== "demo-key") ||
    groqEnabled()
  );
}

export function groqEnabled(): boolean {
  return (
    process.env.GROQ_API_KEY !== undefined &&
    process.env.GROQ_API_KEY !== "" &&
    process.env.GROQ_API_KEY !== "demo-key"
  );
}

export function aiModelName(): string {
  return process.env.AI_MODEL || "gemini-3.1-flash-lite";
}

/**
 * Fallback chain of full model refs for triage. Gemini 3 models first — they
 * are what a free Google AI Studio key can actually generate with (2.5-flash
 * returns 404 "no longer available to new users", 2.0-flash/flash-lite come
 * back quota-zero). Groq is the fast second lane when GROQ_API_KEY is set.
 * The configured AI_MODEL and the legacy names round out the chain.
 */
export function triageModelChain(): string[] {
  const chain = [
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    ...(groqEnabled() ? ["groq/llama-3.3-70b-versatile", "groq/llama-3.1-8b-instant"] : []),
    aiModelName(),
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
  ];
  return [...new Set(chain)].map((m) => (m.startsWith("groq/") ? m : `googleai/${m}`));
}
