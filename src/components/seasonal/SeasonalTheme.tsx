import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_SEASONAL_CONFIG, isBirthday, pickActiveEvent,
  type SeasonalConfig, type SeasonalEvent,
} from "@/lib/seasonal";

const PARTICLES: Record<string, string[]> = {
  snow: ["❄", "❅", "❆"], confetti: ["🎊", "✨", "🎉"], hearts: ["❤", "💕", "💖"],
  fireworks: ["🎆", "🎇", "✨"], balloons: ["🎈", "🎈", "🎁"],
};

const Particles = ({ kind }: { kind: string }) => {
  const chars = PARTICLES[kind];
  const items = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 6, dur: 6 + Math.random() * 6, ch: chars?.[i % 3],
  })), [chars]);
  if (!chars) return null;
  const up = kind === "balloons";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {items.map((p, i) => (
        <span key={i} className={up ? "seasonal-rise" : "seasonal-fall"}
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}>{p.ch}</span>
      ))}
    </div>
  );
};

const SeasonalTheme = () => {
  const { profile, user } = useAuth();
  const { pathname } = useLocation();
  const [config, setConfig] = useState<SeasonalConfig>(DEFAULT_SEASONAL_CONFIG);
  const [events, setEvents] = useState<SeasonalEvent[]>([]);
  const [on, setOn] = useState<boolean | null>(null);
  const [hover, setHover] = useState(false);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const [bdayClosed, setBdayClosed] = useState(() => localStorage.getItem("rf_bday_closed") === todayKey);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: e }] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "seasonal_themes").maybeSingle(),
        supabase.from("seasonal_events").select("*").eq("active", true),
      ]);
      if (s?.value) setConfig({ ...DEFAULT_SEASONAL_CONFIG, ...(s.value as any) });
      setEvents((e as SeasonalEvent[]) || []);
    })();
  }, []);

  const event = pickActiveEvent(events, config, today);
  const storeKey = event ? `rf_seasonal_${event.id}` : "";

  useEffect(() => {
    if (!event) return setOn(null);
    const saved = localStorage.getItem(storeKey);
    setOn(saved != null ? saved === "1" : config.mode === "on");
  }, [event?.id, config.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Troca claro/escuro durante o tema festivo. As cores vão numa folha de estilo
  // com !important para não serem desfeitas pela identidade visual do site, e a
  // direção é sempre o oposto do tema base (lido do atributo data-theme).
  const [seasonalMode, setSeasonalMode] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!event?.dark_mode || !on) { root.removeAttribute("data-seasonal"); setSeasonalMode(null); return; }
    const fgLight = "0 0% 96%", fgDark = "222 47% 11%";
    const light: Record<string, string> = {
      "--background": "0 0% 100%", "--foreground": fgDark,
      "--card": "0 0% 100%", "--card-foreground": fgDark,
      "--popover": "0 0% 100%", "--popover-foreground": fgDark,
      "--muted": "210 20% 94%", "--muted-foreground": "215 16% 35%",
      "--secondary": "210 20% 92%", "--secondary-foreground": fgDark,
      "--border": "214 20% 86%", "--input": "214 20% 86%",
      "--sidebar-background": "0 0% 100%", "--sidebar-foreground": fgDark,
      "--sidebar-accent": "210 20% 94%", "--sidebar-accent-foreground": fgDark,
      "--selection-btn-bg": "#e5e9f0", "--selection-btn-text": "#111827",
    };
    const dark: Record<string, string> = {
      "--background": "210 30% 8%", "--foreground": fgLight,
      "--card": "210 25% 12%", "--card-foreground": fgLight,
      "--popover": "210 25% 12%", "--popover-foreground": fgLight,
      "--muted": "210 15% 20%", "--muted-foreground": "210 10% 72%",
      "--secondary": "210 20% 18%", "--secondary-foreground": fgLight,
      "--border": "210 15% 24%", "--input": "210 15% 24%",
      "--sidebar-background": "210 30% 8%", "--sidebar-foreground": fgLight,
      "--sidebar-accent": "210 20% 18%", "--sidebar-accent-foreground": fgLight,
      "--selection-btn-bg": "#1f2937", "--selection-btn-text": "#ffffff",
    };
    const css = (sel: string, p: Record<string, string>) =>
      `${sel}{${Object.entries(p).map(([k, v]) => `${k}:${v} !important;`).join("")}}`;
    let tag = document.getElementById("seasonal-palette") as HTMLStyleElement | null;
    if (!tag) { tag = document.createElement("style"); tag.id = "seasonal-palette"; document.head.appendChild(tag); }
    tag.textContent = css(':root[data-seasonal="light"]', light) + css(':root[data-seasonal="dark"]', dark);
    const apply = () => {
      const mode = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-seasonal", mode);
      setSeasonalMode(mode);
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { obs.disconnect(); root.removeAttribute("data-seasonal"); setSeasonalMode(null); };
  }, [on, event?.dark_mode]);

  // No celular não há "passar o mouse": ao tocar, a mensagem aparece por 3 s.
  useEffect(() => {
    if (!hover) return;
    const t = setTimeout(() => setHover(false), 3000);
    return () => clearTimeout(t);
  }, [hover, on]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard/admin")) return null;

  const birthday = config.mode !== "disabled" && config.birthday_enabled && !!user && isBirthday(profile?.birth_date, today);
  const firstName = (profile?.name || "").trim().split(/\s+/)[0];

  const toggle = () => {
    const next = !on;
    setOn(next);
    localStorage.setItem(storeKey, next ? "1" : "0");
  };

  return (
    <>
      {event && (
        <div className="fixed bottom-24 left-4 z-[70] flex flex-col items-center" data-beta-allow
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <button type="button" onClick={toggle} title={`${event.name}: ${on ? "desligar" : "ligar"} tema`}
            aria-pressed={!!on} aria-label={`Tema ${event.name} ${on ? "ligado" : "desligado"}`}
            className="seasonal-icon flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-2xl shadow-lg"
            style={{ boxShadow: on ? `0 0 18px ${event.primary_color}` : undefined }}>
            {event.icon}
          </button>
          {event.effect === "spider" && (
            <span aria-hidden className="seasonal-spider" data-down={on || hover ? "1" : "0"}>🕷️</span>
          )}
          {on && hover && event.message && (() => {
            // Cor contrária à do fundo real da página (lida no momento da exibição).
            const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) || [0, 0, 0];
            const pageLight = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255 > 0.5;
            return (
            <span className="absolute bottom-14 left-0 whitespace-nowrap rounded-md border-2 px-3 py-1.5 text-xs font-semibold shadow-lg"
              style={{ borderColor: event.primary_color, backgroundColor: pageLight ? "#111827" : "#ffffff", color: pageLight ? "#ffffff" : "#111827" }}>
              {event.message}
            </span>
            );
          })()}
        </div>
      )}
      {event && on && <Particles kind={event.effect} />}

      {birthday && !bdayClosed && (
        <>
          <Particles kind="confetti" />
          <div role="dialog" aria-live="polite" data-beta-allow
            className="fixed left-1/2 top-24 z-[80] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-border bg-card p-5 text-center shadow-2xl">
            <div className="text-4xl">🎂🎈</div>
            <p className="mt-2 font-display text-xl font-bold text-foreground">
              Parabéns! Feliz Aniversário{firstName ? `, ${firstName}` : ""}!
            </p>
            <p className="mt-1 text-sm text-muted-foreground">A equipe Revisão Fácil deseja um dia incrível para você.</p>
            <Button className="mt-4" size="sm" onClick={() => { localStorage.setItem("rf_bday_closed", todayKey); setBdayClosed(true); }}>
              Obrigado! (Fechar)
            </Button>
          </div>
        </>
      )}
    </>
  );
};

export default SeasonalTheme;
