/**
 * Teste de paridade cliente ↔ snapshot Deno.
 *
 * Garante que o HTML do helper compartilhado (`buildEmailLogoHtml`) gerado no
 * contexto do client (importado pelo `SettingsEmailTemplates` e injetado via
 * `dangerouslySetInnerHTML`) é byte-a-byte idêntico ao snapshot armazenado em
 * `supabase/functions/_shared/__tests__/__snapshots__/email-logo_snapshot_test.ts.snap`,
 * que é validado pelos testes Deno das edge functions.
 *
 * Se este teste quebra junto com o snapshot Deno → mudança intencional, regere
 * ambos. Se quebra sozinho → o preview do admin divergiu da edge function.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildEmailLogoHtml,
  type BuildEmailLogoParams,
} from "../../../../../supabase/functions/_shared/email-logo";

const SNAP_PATH = path.resolve(
  __dirname,
  "../../../../../supabase/functions/_shared/__tests__/__snapshots__/email-logo_snapshot_test.ts.snap",
);

const cases: Array<{ key: string; params: BuildEmailLogoParams }> = [
  {
    key: "logo + slogan com acentos PT-BR",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Revisão Fácil",
      slogan: "Educação séria, com você",
      headingColor: "#dc2626",
    },
  },
  {
    key: "logo + slogan com aspas, & e travessão",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: `Aprenda & Cresça — com "estilo" e 'paixão'`,
    },
  },
  {
    key: "fallback textual: platformName com acentos e símbolos tipográficos",
    params: {
      logoUrl: "",
      useUploadedLogo: false,
      platformName: "Cursos & Aulas — “Edição 2026”",
      slogan: "Slogan com até 3 palavras",
      headingColor: "#0891b2",
    },
  },
  {
    key: "fallback textual: tentativa de injeção via platformName",
    params: {
      logoUrl: "",
      useUploadedLogo: false,
      platformName: `<script>alert("xss")</script>`,
      slogan: "",
    },
  },
  {
    key: "URL da logo com query string e aspas (tentativa de escape de atributo)",
    params: {
      logoUrl: `https://x.test/logo.png?a=1&b=2"onerror="alert(1)`,
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: "Olá, tudo bem?",
    },
  },
  {
    key: "sem slogan: bloco de slogan não é renderizado",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "Plataforma",
      slogan: "",
    },
  },
  {
    key: "slogan curto (font-size atinge teto de 18px)",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "P",
      slogan: "Vai!",
    },
  },
  {
    key: "slogan longo (font-size atinge piso de 8px)",
    params: {
      logoUrl: "https://cdn.example.com/logo.png",
      useUploadedLogo: true,
      platformName: "P",
      slogan: "a".repeat(120),
    },
  },
];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readStoredSnapshot(snapFile: string, key: string): string {
  const re = new RegExp(
    "snapshot\\[`snapshot: " + escapeRe(key) + " 1`\\] = `'([\\s\\S]*?)'`;",
  );
  const m = snapFile.match(re);
  if (!m) throw new Error(`Snapshot ausente para: ${key}`);
  return m[1];
}

describe("paridade preview admin ↔ snapshot Deno (buildEmailLogoHtml)", () => {
  const snapFile = readFileSync(SNAP_PATH, "utf8");

  for (const c of cases) {
    it(`HTML do client é idêntico ao snapshot Deno: ${c.key}`, () => {
      const actual = buildEmailLogoHtml(c.params);
      const stored = readStoredSnapshot(snapFile, c.key);
      // Comparação byte-a-byte: mesmo helper, mesma string esperada nas
      // edge functions e no preview do SettingsEmailTemplates.
      expect(actual).toBe(stored);
    });
  }
});