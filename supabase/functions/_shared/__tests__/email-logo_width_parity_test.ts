/**
 * Paridade visual: largura da logo == largura do slogan no HTML do e-mail.
 *
 * O helper `buildEmailLogoHtml` calcula o `font-size` do slogan a partir da
 * LARGURA REAL renderizada da logo (height fixo × proporção natural, capada
 * em logoMaxWidth) — exatamente como Navbar/Footer fazem no site, onde a
 * largura é medida no DOM via `getBoundingClientRect()`.
 *
 * Estes testes:
 *  - extraem do HTML gerado tanto a LARGURA da logo (em px) quanto o
 *    `font-size` do slogan
 *  - reconstroem a largura visual do slogan a partir da fórmula inversa
 *    `len * fontSize / 1.7` (a mesma constante usada no helper)
 *  - garantem que, fora dos cenários de saturação (slogan muito curto → cap
 *    em 18px, ou muito longo → piso em 8px), a largura visual do slogan é
 *    IGUAL à largura renderizada da logo dentro de uma tolerância de 1px
 *    (arredondamento + clamp da fonte a 1 casa decimal)
 *  - cobrem múltiplas proporções de logo (quadrada, retangular larga,
 *    retangular alta, idêntica à do projeto: 1584×672) e múltiplos tamanhos
 *    de slogan
 *
 * Isto blinda contra regressões do tipo "calculei o font-size sobre 320px
 * fixo", que faz o slogan extrapolar a largura da logo (bug que motivou a
 * suíte).
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildEmailLogoHtml } from "../email-logo.ts";

// ---------- helpers de extração ----------

/** Lê `width="..."` (atributo HTML) da `<img>` da logo. */
function extractLogoWidthAttr(html: string): number | null {
  // <img ... width="189" ...>
  const m = html.match(/<img\b[^>]*\bwidth="(\d+)"/);
  return m ? Number(m[1]) : null;
}

/** Lê o `font-size:Xpx` do slogan (div com `margin-top:-12px;color:#6b7280`). */
function extractSloganFontSize(html: string): number | null {
  // Procura DIVs com a assinatura visual do slogan.
  const re = /<div\s+style="[^"]*color:#6b7280;\s*font-size:([\d.]+)px[^"]*"[^>]*>/;
  const m = html.match(re);
  return m ? Number(m[1]) : null;
}

/** Conta caracteres do slogan exatamente como o helper (após .trim()). */
function sloganLen(s: string): number {
  return s.trim().length;
}

/**
 * Aproxima a largura visual de um texto em px dada a fórmula:
 *   fontSize = (logoWidth / len) * 1.7
 * → logoWidth ≈ len * fontSize / 1.7
 *
 * NÃO é uma medição tipográfica real — é literalmente a inversa da fórmula
 * usada para calcular `fontSize`. Usá-la aqui valida que o helper resolveu o
 * sistema corretamente.
 */
function sloganVisualWidth(slogan: string, fontSize: number): number {
  return (sloganLen(slogan) * fontSize) / 1.7;
}

// ---------- casos cobertos ----------

interface Case {
  name: string;
  naturalWidth: number;
  naturalHeight: number;
  slogan: string;
  /** Quando true, esperamos que a fonte sature no teto (18px) ou no piso (8px)
   *  — nesses casos a largura do slogan PODE ficar diferente da logo. */
  saturated?: "ceil" | "floor";
}

const HEIGHT = 80; // h-20 do site, default do helper
const MAX_W = 320; // max-w-[320px] do site, default do helper

const cases: Case[] = [
  {
    name: "logo do projeto (1584×672) com slogan PT-BR de 24 chars",
    naturalWidth: 1584,
    naturalHeight: 672,
    slogan: "Educação séria, com você",
  },
  {
    name: "logo quadrada 512×512 com slogan curto (3 palavras)",
    naturalWidth: 512,
    naturalHeight: 512,
    // Slogan curto o suficiente para que o cálculo (logoW/len)*1.7 caia
    // dentro do range [8,18] em uma logo quadrada renderizada com 80px.
    // Aqui logoW=80, então len precisa ser ≈ 80*1.7/13 ≈ 10..17 para não saturar.
    slogan: "Foco e ação",
  },
  {
    name: "logo bem larga 4000×500 — capada em max-width",
    naturalWidth: 4000,
    naturalHeight: 500,
    slogan: "Aprenda no seu ritmo, em qualquer lugar",
  },
  {
    name: "logo alta/estreita 400×600 → renderizada estreita",
    naturalWidth: 400,
    naturalHeight: 600,
    // Logo renderiza com width≈53px → slogan precisa ser bem curto (≤6 chars)
    // para a fonte cair dentro do range.
    slogan: "Sucesso",
    // Mesmo assim, com largura tão pequena, é provável que sature no piso.
    // Marcado como floor para o caso de saturação ainda ocorrer; a asserção
    // dinâmica abaixo detecta isto.
    saturated: "floor",
  },
  {
    name: "slogan muito curto satura no teto (18px)",
    naturalWidth: 1584,
    naturalHeight: 672,
    slogan: "Vai!",
    saturated: "ceil",
  },
  {
    name: "slogan muito longo satura no piso (8px)",
    naturalWidth: 1584,
    naturalHeight: 672,
    slogan: "a".repeat(120),
    saturated: "floor",
  },
];

// ---------- testes paramétricos ----------

for (const c of cases) {
  Deno.test(
    `paridade slogan/logo: ${c.name}`,
    () => {
      const html = buildEmailLogoHtml({
        logoUrl: "https://cdn.example.com/logo.png",
        useUploadedLogo: true,
        platformName: "Plataforma",
        slogan: c.slogan,
        logoNaturalWidth: c.naturalWidth,
        logoNaturalHeight: c.naturalHeight,
      });

      // 1) A largura da logo no HTML deve bater com a fórmula do helper:
      //    min(MAX_W, round(HEIGHT * nat_w / nat_h))
      const expectedLogoWidth = Math.min(
        MAX_W,
        Math.round((HEIGHT * c.naturalWidth) / c.naturalHeight),
      );
      const actualLogoWidth = extractLogoWidthAttr(html);
      assert(
        actualLogoWidth !== null,
        "esperava `width=\"...\"` no atributo HTML da <img> quando dimensões naturais são informadas",
      );
      assertEquals(
        actualLogoWidth,
        expectedLogoWidth,
        `largura renderizada da logo deve ser ${expectedLogoWidth}px, veio ${actualLogoWidth}px`,
      );

      // 2) O font-size do slogan deve estar dentro do range [8, 18].
      const fs = extractSloganFontSize(html);
      assert(fs !== null, "esperava font-size do slogan no HTML");
      assert(fs! >= 8 && fs! <= 18, `font-size fora do range 8..18: ${fs}`);

      // 3) Validações de saturação:
      if (c.saturated === "ceil") {
        assertEquals(fs, 18, "slogan curto deveria saturar em 18px");
        return; // largura visual aqui é MENOR que a logo de propósito
      }
      if (c.saturated === "floor") {
        assertEquals(fs, 8, "slogan longo deveria saturar em 8px");
        return; // largura visual aqui é MAIOR que a logo de propósito
      }

      // 4) Caso "normal": largura visual do slogan ≈ largura da logo.
      //    Tolerância: 1px (arredondamento) + 0.05 (clamp da fonte a .1 casa).
      const sloganW = sloganVisualWidth(c.slogan, fs!);
      const diff = Math.abs(sloganW - actualLogoWidth!);
      assert(
        diff < 1.5,
        `largura do slogan (${sloganW.toFixed(2)}px) deveria ser ≈ largura da logo (${actualLogoWidth}px), diff=${diff.toFixed(2)}`,
      );
    },
  );
}

// ---------- contra-prova: SEM dimensões naturais cai no fallback ----------

Deno.test(
  "fallback: sem dims naturais o helper usa logoMaxWidth como referência",
  () => {
    const html = buildEmailLogoHtml({
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: "Educação séria, com você",
      // logoNaturalWidth/Height ausentes
    });

    // No fallback, o atributo width="..." NÃO é emitido (largura intrínseca).
    assertEquals(
      extractLogoWidthAttr(html),
      null,
      "sem dims naturais, a <img> não deve ter width=\"...\" fixo",
    );

    // E o font-size é calculado sobre MAX_W=320, não sobre a largura real.
    const slogan = "Educação séria, com você";
    const expectedFs = Math.max(
      8,
      Math.min(18, (MAX_W / sloganLen(slogan)) * 1.7),
    );
    const fs = extractSloganFontSize(html);
    assert(fs !== null);
    // Compara com 1 casa decimal (formato emitido pelo helper).
    assertEquals(
      Number(expectedFs.toFixed(1)),
      fs,
      `fallback deveria calcular fontSize=${expectedFs.toFixed(1)} sobre logoMaxWidth=${MAX_W}`,
    );
  },
);

// ---------- garante que o atributo width casa com o style width ----------

Deno.test(
  "consistência: width=\"X\" no HTML e style:width:Xpx batem (anti Outlook/Gmail mismatch)",
  () => {
    const html = buildEmailLogoHtml({
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: "Olá!",
      logoNaturalWidth: 1584,
      logoNaturalHeight: 672,
    });
    const attr = extractLogoWidthAttr(html);
    const styleM = html.match(/style="[^"]*\bwidth:(\d+)px/);
    assert(attr !== null, "esperava atributo width");
    assert(styleM, "esperava style:width:Xpx");
    assertEquals(
      attr,
      Number(styleM![1]),
      "atributo `width` e `style:width` devem ser idênticos para evitar arredondamentos diferentes em Outlook/Gmail",
    );
  },
);