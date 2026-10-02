// Modelo de IA de texto escolhido pelo admin para cada área (Gestão de IA →
// "IA por área"). Lido de platform_settings.ai_models_config com cache curto.
export type AiArea = "revisoes" | "trabalhos" | "atendente" | "provas_reais";

export const DEFAULT_TEXT_MODEL = "openai/gpt-6-astra";
export const ALLOWED_TEXT_MODELS = [
  "openai/gpt-6-astra",
  "openai/gpt-6-sol",
  "openai/gpt-6-luna",
  "google/gemini-3.8-flash",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.1-flash-lite",
];

let cache: { at: number; value: Record<string, unknown> } | null = null;

export async function loadSetting(key: string): Promise<Record<string, unknown>> {
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return {};
  try {
    const res = await fetch(`${url}/rest/v1/platform_settings?key=eq.${key}&select=value`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    if (!res.ok) return {};
    const rows = await res.json();
    const value = rows?.[0]?.value;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export async function resolveModel(area: AiArea): Promise<string> {
  if (!cache || Date.now() - cache.at > 60_000) {
    cache = { at: Date.now(), value: await loadSetting("ai_models_config") };
  }
  const chosen = cache.value?.[area];
  return typeof chosen === "string" && ALLOWED_TEXT_MODELS.includes(chosen) ? chosen : DEFAULT_TEXT_MODEL;
}
