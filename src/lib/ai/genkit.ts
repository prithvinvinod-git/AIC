import "server-only";

// Lazily-initialised Genkit runtime. Only created when a Google AI API key is
// present; otherwise every flow falls back to the deterministic keyword
// classifier so the app stays fully demoable without a Google AI key.

let aiInstance: Awaited<ReturnType<typeof createGenkit>> | null = null;

async function createGenkit() {
  const [{ genkit }, { googleAI }] = await Promise.all([
    import("genkit"),
    import("@genkit-ai/googleai"),
  ]);
  return genkit({
    plugins: [googleAI()],
  });
}

export async function getGenkit() {
  if (!aiInstance) aiInstance = await createGenkit();
  return aiInstance;
}

export function aiEnabled(): boolean {
  return process.env.GOOGLE_GENAI_API_KEY !== undefined &&
    process.env.GOOGLE_GENAI_API_KEY !== "" &&
    process.env.GOOGLE_GENAI_API_KEY !== "demo-key";
}

export function aiModelName(): string {
  return process.env.AI_MODEL || "gemini-2.0-flash";
}
