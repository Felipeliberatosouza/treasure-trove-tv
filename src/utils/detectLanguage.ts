/**
 * Heuristic language detector for the in-browser spellchecker.
 *
 * Returns a BCP-47 language tag based on character frequency and stop-words.
 * Supports: pt-BR (default), en, es. Falls back to pt-BR for short / empty strings,
 * since the platform's primary audience writes in Brazilian Portuguese.
 */

export type SpellLang = "pt-BR" | "en" | "es";

const PT_HINTS = [
  "ção",
  "ões",
  "ãe",
  "ão",
  "ç",
  " não ",
  " que ",
  " para ",
  " com ",
  " uma ",
  " você ",
  " também ",
  " já ",
  " é ",
];

const ES_HINTS = [
  "ñ",
  " que ",
  " para ",
  " con ",
  " una ",
  " también ",
  " más ",
  " sí ",
  "ción",
  "¿",
  "¡",
];

const EN_HINTS = [
  " the ",
  " and ",
  " for ",
  " with ",
  " you ",
  " this ",
  " that ",
  " have ",
  " not ",
  " are ",
  "ing ",
  "tion ",
];

function score(text: string, hints: string[]): number {
  let s = 0;
  for (const h of hints) {
    let idx = 0;
    while ((idx = text.indexOf(h, idx)) !== -1) {
      s += h.length > 2 ? 2 : 1;
      idx += h.length;
    }
  }
  return s;
}

export function detectLanguage(raw: string): SpellLang {
  if (!raw) return "pt-BR";
  const text = ` ${raw.toLowerCase()} `;
  // Too short to confidently detect — keep platform default.
  if (text.trim().length < 8) return "pt-BR";

  const pt = score(text, PT_HINTS);
  const es = score(text, ES_HINTS);
  const en = score(text, EN_HINTS);

  // Strong PT/ES character signals beat English-looking stop words.
  if (/[ãõçâêôáéíóú]/.test(text) && pt >= es) return "pt-BR";
  if (/ñ|¿|¡/.test(text) && es >= pt) return "es";

  const max = Math.max(pt, en, es);
  if (max === 0) return "pt-BR";
  if (max === pt) return "pt-BR";
  if (max === es) return "es";
  return "en";
}
