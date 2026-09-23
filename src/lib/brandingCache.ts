/**
 * Cache local das configurações da plataforma (identidade visual, contatos,
 * etc.) para que o site já abra com as cores e a logomarca atuais, sem exibir
 * o tema padrão por alguns instantes enquanto o backend responde.
 */
const STORAGE_KEY = "rf_platform_settings_cache";

export type SettingsCache = Record<string, unknown>;

export function readSettingsCache(): SettingsCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SettingsCache) : {};
  } catch {
    return {};
  }
}

export function readCachedSetting<T>(key: string): T | null {
  const value = readSettingsCache()[key];
  return (value ?? null) as T | null;
}

/** Substitui todo o cache (usado quando buscamos todas as chaves de uma vez). */
export function writeSettingsCache(settings: SettingsCache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* localStorage indisponível (modo privado, cota cheia) — ignorar. */
  }
}

/** Atualiza apenas uma chave dentro do cache existente. */
export function writeCachedSetting(key: string, value: unknown) {
  const current = readSettingsCache();
  current[key] = value;
  writeSettingsCache(current);
}
