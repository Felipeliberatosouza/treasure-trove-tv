export type SeasonalMode = "on" | "off" | "disabled";
export type SeasonalEffect = "spider" | "snow" | "confetti" | "hearts" | "fireworks" | "balloons" | "none";

export interface SeasonalEvent {
  id: string;
  name: string;
  start_md: string; // "MM-DD"
  end_md: string;
  icon: string;
  effect: SeasonalEffect | string;
  primary_color: string;
  dark_mode: boolean;
  message: string | null;
  priority: number;
  active: boolean;
}

export interface SeasonalConfig {
  /** on = tema ligado ao entrar (aluno pode desligar); off = desligado ao entrar (aluno pode ligar); disabled = nenhum evento em execução. */
  mode: SeasonalMode;
  birthday_enabled: boolean;
}

export const DEFAULT_SEASONAL_CONFIG: SeasonalConfig = { mode: "on", birthday_enabled: true };

export const EFFECT_OPTIONS: { value: SeasonalEffect; label: string }[] = [
  { value: "spider", label: "Aranha descendo do ícone" },
  { value: "snow", label: "Neve caindo" },
  { value: "confetti", label: "Confetes" },
  { value: "hearts", label: "Corações flutuando" },
  { value: "fireworks", label: "Fogos de artifício" },
  { value: "balloons", label: "Balões subindo" },
  { value: "none", label: "Só ícone e cor (sem animação)" },
];

const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Verifica se a data está no período anual (aceita períodos que viram o ano, ex.: 12-20 a 01-06). */
export function isInPeriod(start: string, end: string, date: Date): boolean {
  const t = md(date);
  return start <= end ? t >= start && t <= end : t >= start || t <= end;
}

/** Evento ativo no dia; null quando o sistema está desativado ou não há evento no período. */
export function pickActiveEvent(events: SeasonalEvent[], config: SeasonalConfig, date: Date): SeasonalEvent | null {
  if (config.mode === "disabled") return null;
  const list = events
    .filter((e) => e.active && isInPeriod(e.start_md, e.end_md, date))
    .sort((a, b) => b.priority - a.priority);
  return list[0] ?? null;
}

/** Aniversário: compara mês/dia da data de nascimento (YYYY-MM-DD) com hoje. */
export function isBirthday(birthDate: string | null | undefined, date: Date): boolean {
  if (!birthDate) return false;
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(birthDate);
  return !!m && `${m[1]}-${m[2]}` === md(date);
}
