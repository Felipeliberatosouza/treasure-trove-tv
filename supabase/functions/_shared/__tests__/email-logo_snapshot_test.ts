/**
 * Snapshot tests do helper buildEmailLogoHtml.
 *
 * Garante que QUALQUER mudança no HTML gerado (estilos, espaçamento, escape)
 * é detectada explicitamente. Os snapshots cobrem casos com acentos, símbolos
 * tipográficos (—, …, “”), aspas, &, < > e cenários relevantes (com/sem logo,
 * com/sem slogan, slogan curto/longo, URL com query string).
 *
 * Para regenerar os snapshots após uma mudança INTENCIONAL, rode os testes
 * com a env UPDATE=1 (Deno: --update). O arquivo .snap é versionado.
 */
import { assertSnapshot } from "https://deno.land/std@0.224.0/testing/snapshot.ts";
import { buildEmailLogoHtml } from "../email-logo.ts";

const cases: Array<{ name: string; params: Parameters<typeof buildEmailLogoHtml>[0] }> = [
  {
    name: "logo + slogan com acentos PT-BR",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Revisão Fácil",
      slogan: "Educação séria, com você",
      headingColor: "#dc2626",
    },
  },
  {
    name: "logo + slogan com aspas, & e travessão",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: `Aprenda & Cresça — com "estilo" e 'paixão'`,
    },
  },
  {
    name: "fallback textual: platformName com acentos e símbolos tipográficos",
    params: {
      logoUrl: "",
      useUploadedLogo: false,
      platformName: "Cursos & Aulas — “Edição 2026”",
      slogan: "Slogan com até 3 palavras",
      headingColor: "#0891b2",
    },
  },
  {
    name: "fallback textual: tentativa de injeção via platformName",
    params: {
      logoUrl: "",
      useUploadedLogo: false,
      platformName: `<script>alert("xss")</script>`,
      slogan: "",
    },
  },
  {
    name: "URL da logo com query string e aspas (tentativa de escape de atributo)",
    params: {
      logoUrl: `https://x.test/logo.png?a=1&b=2"onerror="alert(1)`,
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: "Olá, tudo bem?",
    },
  },
  {
    name: "sem slogan: bloco de slogan não é renderizado",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: "",
    },
  },
  {
    name: "slogan curto (font-size atinge teto de 14px)",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "P",
      slogan: "Vai!",
    },
  },
  {
    name: "slogan longo (font-size atinge piso de 8px)",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "P",
      slogan: "a".repeat(120),
    },
  },
];

for (const c of cases) {
  Deno.test(`snapshot: ${c.name}`, async (t) => {
    await assertSnapshot(t, buildEmailLogoHtml(c.params));
  });
}
