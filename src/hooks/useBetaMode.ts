import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BetaModeSettings {
  enabled: boolean;
  /** Créditos de IA sugeridos por reporte aprovado. */
  reward_credits: number;
}

export const DEFAULT_BETA: BetaModeSettings = { enabled: false, reward_credits: 5 };

// Stripe test card (fixed, never editable in Beta).
export const BETA_TEST_CARD = { number: "4242 4242 4242 4242", expiry: "12/34", cvc: "123" };

let cache: BetaModeSettings | null = null;
let pending: Promise<BetaModeSettings> | null = null;
const listeners = new Set<(s: BetaModeSettings) => void>();

async function fetchBeta(): Promise<BetaModeSettings> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "beta_mode").maybeSingle();
  const v = (data?.value ?? {}) as Partial<BetaModeSettings>;
  return { ...DEFAULT_BETA, ...v };
}

export function setBetaCache(s: BetaModeSettings) {
  cache = s;
  listeners.forEach((l) => l(s));
}

export function useBetaMode() {
  const [settings, setSettings] = useState<BetaModeSettings>(cache ?? DEFAULT_BETA);
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    listeners.add(setSettings);
    if (!cache) {
      pending = pending ?? fetchBeta();
      pending.then((s) => {
        setBetaCache(s);
        setLoaded(true);
      });
    }
    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  return { beta: settings.enabled, settings, loaded };
}

export async function saveBetaMode(s: BetaModeSettings) {
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "beta_mode", value: s as any }, { onConflict: "key" });
  if (!error) setBetaCache(s);
  return error;
}
