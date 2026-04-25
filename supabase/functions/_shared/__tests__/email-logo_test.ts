/**
 * Unit tests for the shared email logo helper.
 *
 * Garante que slogan, nome da plataforma e URL da logo são SEMPRE escapados
 * (incluindo &, <, >, ", ') ao montar o HTML usado nos e-mails — evitando
 * quebra de markup e injeção de atributos/scripts via dados do branding.
 */
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildEmailLogoHtml,
  escapeHtml,
} from "../email-logo.ts";

// ---------- escapeHtml ----------

Deno.test("escapeHtml escapa todos os 5 caracteres reservados", () => {
  const input = `Tom & Jerry <"O 'Show'">`;
  const out = escapeHtml(input);
  assertEquals(
    out,
    "Tom &amp; Jerry &lt;&quot;O &#39;Show&#39;&quot;&gt;",
  );
  // E o resultado não deve mais conter NENHUM dos caracteres crus.
  for (const ch of ["&", "<", ">", '"', "'"]) {
    // & só pode aparecer como início de entidade
    if (ch === "&") continue;
    assert(!out.includes(ch), `caractere ${ch} não deveria aparecer cru`);
  }
});

Deno.test("escapeHtml é idempotente em strings seguras", () => {
  const safe = "Plataforma Educacional 123";
  assertEquals(escapeHtml(safe), safe);
});

Deno.test("escapeHtml lida com null/undefined/number sem explodir", () => {
  assertEquals(escapeHtml(null), "");
  assertEquals(escapeHtml(undefined), "");
  assertEquals(escapeHtml(42), "42");
});

// ---------- buildEmailLogoHtml: slogan ----------

Deno.test("slogan com aspas e & é escapado no HTML final", () => {
  const html = buildEmailLogoHtml({
    logoUrl: "https://cdn.example.com/logo.png",
    useUploadedLogo: true,
    platformName: "Plataforma",
    slogan: `Aprenda & Cresça com "estilo" — it's bom!`,
  });

  assertStringIncludes(
    html,
    "Aprenda &amp; Cresça com &quot;estilo&quot; — it&#39;s bom!",
  );
  // Não pode haver versão crua que quebraria o atributo style/span
  assert(!html.includes(`"estilo"`), "aspas duplas cruas no slogan");
  assert(!html.includes(`it's`), "aspas simples cruas no slogan");
  assert(
    !html.includes("Aprenda & Cresça"),
    "& cru no slogan poderia quebrar o HTML",
  );
});

Deno.test("slogan vazio/whitespace não gera bloco de slogan", () => {
  const htmlEmpty = buildEmailLogoHtml({
    logoUrl: "https://cdn.example.com/logo.png",
    useUploadedLogo: true,
    platformName: "Plataforma",
    slogan: "   ",
  });
  assert(!htmlEmpty.includes("margin-top:-6px"), "não deveria ter slogan");

  const htmlMissing = buildEmailLogoHtml({
    logoUrl: "https://cdn.example.com/logo.png",
    useUploadedLogo: true,
    platformName: "Plataforma",
  });
  assert(!htmlMissing.includes("margin-top:-6px"));
});

// ---------- buildEmailLogoHtml: platformName ----------

Deno.test("platformName com tags/aspas é escapado no fallback textual", () => {
  const html = buildEmailLogoHtml({
    logoUrl: "",
    useUploadedLogo: false,
    platformName: `<script>alert("x")</script> & "Aulas"`,
    slogan: "Slogan ok",
  });
  assertStringIncludes(
    html,
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;Aulas&quot;",
  );
  assert(
    !html.toLowerCase().includes("<script>"),
    "tag <script> não pode aparecer crua no HTML do e-mail",
  );
});

Deno.test("platformName é escapado mesmo quando há logo de imagem (não usado, mas seguro)", () => {
  const html = buildEmailLogoHtml({
    logoUrl: "https://cdn.example.com/logo.png",
    useUploadedLogo: true,
    platformName: `A & B`,
    slogan: "",
  });
  // Quando usa imagem, o nome não aparece — mas a função não pode quebrar.
  assert(!html.includes("A & B"));
});

// ---------- buildEmailLogoHtml: logoUrl ----------

Deno.test("URL da logo com aspas/& é escapada para não quebrar o atributo src", () => {
  const malicious = `https://x.test/logo.png?a=1&b=2"onerror="alert(1)`;
  const html = buildEmailLogoHtml({
    logoUrl: malicious,
    useUploadedLogo: true,
    platformName: "P",
    slogan: "",
  });
  // Aspas duplas crus dentro do valor de src quebrariam o atributo.
  assertStringIncludes(html, "&quot;onerror=&quot;alert(1)");
  assertStringIncludes(html, "a=1&amp;b=2");
  assert(
    !html.includes(`"onerror="alert(1)`),
    "aspas cruas escapariam do atributo src",
  );
  // Verifica que o src ainda está bem-formado (apenas 2 aspas duplas no atributo)
  const srcMatch = html.match(/<img\s+src="([^"]*)"/);
  assert(srcMatch, "tag <img> com src bem-formado é obrigatória");
});

Deno.test("logoUrl vazio com useUploadedLogo cai no fallback textual", () => {
  const html = buildEmailLogoHtml({
    logoUrl: "",
    useUploadedLogo: true,
    platformName: "Plataforma X",
    slogan: "",
  });
  assert(!html.includes("<img"), "sem URL não deve renderizar <img>");
  assertStringIncludes(html, "Plataforma X");
});

// ---------- font-size e largura ----------

Deno.test("font-size do slogan respeita limites [8, 14]px", () => {
  const longSlogan = "a".repeat(200);
  const htmlLong = buildEmailLogoHtml({
    logoUrl: "https://x/logo.png",
    useUploadedLogo: true,
    platformName: "P",
    slogan: longSlogan,
  });
  assertStringIncludes(htmlLong, "font-size:8.0px");

  const shortSlogan = "ab";
  const htmlShort = buildEmailLogoHtml({
    logoUrl: "https://x/logo.png",
    useUploadedLogo: true,
    platformName: "P",
    slogan: shortSlogan,
  });
  assertStringIncludes(htmlShort, "font-size:14.0px");
});
