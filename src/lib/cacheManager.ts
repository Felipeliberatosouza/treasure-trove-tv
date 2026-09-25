import { supabase } from "@/integrations/supabase/client";

/**
 * Gestor central de cache.
 * - Nunca remove a sessão de login (chaves sb-*-auth-token).
 * - Invalida caches locais quando a versão do app muda (novo build).
 * - Invalida quando o admin força atualização global (platform_settings.cache_version).
 */
const BUILD_VERSION: string =
  (import.meta.env.VITE_BUILD_ID as string | undefined) ?? (typeof __BUILD_TIME__ !== "undefined" ? String(__BUILD_TIME__) : "dev");
const LOCAL_BUILD_KEY = "rf_build_version";
const LOCAL_REMOTE_KEY = "rf_remote_cache_version";

const isAuthKey = (k: string) => k.startsWith("sb-") && k.includes("auth-token");
// Preferências do usuário que não devem ser apagadas
const PRESERVE = new Set<string>([
  LOCAL_BUILD_KEY,
  LOCAL_REMOTE_KEY,
  "rf_referral_code",
  "cookie-consent",
  "cookieConsent",
]);

export function clearLocalCaches(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach((k) => {
      if (isAuthKey(k) || PRESERVE.has(k)) return;
      if (k.startsWith("rf_") || k.includes("cache")) localStorage.removeItem(k);
    });
    sessionStorage.clear();
  } catch {
    /* navegador sem storage */
  }
  if (typeof caches !== "undefined") {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n))).catch(() => {});
  }
}

export function clearCacheAndReload(): void {
  clearLocalCaches();
  window.location.reload();
}

async function checkRemoteVersion() {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "cache_version")
      .maybeSingle();
    const remote = String((data?.value as { version?: number } | null)?.version ?? "");
    if (!remote) return;
    const local = localStorage.getItem(LOCAL_REMOTE_KEY);
    localStorage.setItem(LOCAL_REMOTE_KEY, remote);
    if (local && local !== remote) {
      clearLocalCaches();
      localStorage.setItem(LOCAL_REMOTE_KEY, remote);
      window.location.reload();
    }
  } catch {
    /* ignore */
  }
}

let started = false;
export function startCacheManager(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const prev = localStorage.getItem(LOCAL_BUILD_KEY);
    if (prev && prev !== BUILD_VERSION) clearLocalCaches();
    localStorage.setItem(LOCAL_BUILD_KEY, BUILD_VERSION);
  } catch {
    /* ignore */
  }
  // Verifica sem atrasar a primeira tela
  setTimeout(checkRemoteVersion, 3000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkRemoteVersion();
  });
}

/** Admin: força todos os usuários a descartarem o cache local. */
export async function forceGlobalCacheRefresh(): Promise<void> {
  const version = Date.now();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "cache_version", value: { version } } as never, { onConflict: "key" });
  if (error) throw error;
  localStorage.setItem(LOCAL_REMOTE_KEY, String(version));
}
