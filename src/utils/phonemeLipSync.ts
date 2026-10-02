/**
 * Sincronização fonética: converte os tempos de cada letra devolvidos pela
 * ElevenLabs em formatos de boca (visemas) para o professor(a) virtual.
 */
export interface SpeechAlignment {
  chars: string;
  starts: number[]; // ms
  ends: number[]; // ms
}

export type Viseme = "rest" | "A" | "O" | "E" | "MBP" | "FV";

/** Escala horizontal/vertical da boca e abertura do queixo para cada visema. */
export const VISEME_SHAPE: Record<Viseme, { sx: number; sy: number; open: number }> = {
  rest: { sx: 1, sy: 0.3, open: 0 },
  A: { sx: 1.05, sy: 1.25, open: 1 },
  O: { sx: 0.7, sy: 1, open: 0.75 },
  E: { sx: 1.25, sy: 0.6, open: 0.45 },
  MBP: { sx: 1, sy: 0.12, open: 0 },
  FV: { sx: 1.05, sy: 0.32, open: 0.15 },
};

const strip = (c: string) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const charToViseme = (char: string): Viseme => {
  const c = strip(char);
  if (!c || !/[a-z]/.test(c)) return "rest";
  if (c === "a") return "A";
  if (c === "o" || c === "u" || c === "w") return "O";
  if (c === "e" || c === "i" || c === "y") return "E";
  if (c === "m" || c === "b" || c === "p") return "MBP";
  if (c === "f" || c === "v") return "FV";
  // Consoantes restantes: boca entreaberta, puxando para a vogal seguinte.
  return "E";
};

/** Índice da letra falada no instante `ms` (busca binária); -1 se em silêncio. */
export const charIndexAt = (al: SpeechAlignment, ms: number): number => {
  const { starts, ends } = al;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ms < starts[mid]) hi = mid - 1;
    else if (ms > ends[mid]) lo = mid + 1;
    else return mid;
  }
  return -1;
};

export const visemeAt = (al: SpeechAlignment | null | undefined, seconds: number): Viseme => {
  if (!al || !al.starts?.length) return "rest";
  const i = charIndexAt(al, seconds * 1000);
  if (i < 0) return "rest";
  return charToViseme(al.chars[i] ?? "");
};

/** Quantas letras da narração já foram faladas até `seconds` (para a legenda). */
export const spokenCharsAt = (al: SpeechAlignment, seconds: number): number => {
  const ms = seconds * 1000;
  let lo = 0;
  let hi = al.starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (al.starts[mid] <= ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};
