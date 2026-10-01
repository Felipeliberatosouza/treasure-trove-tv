// Trabalhos com IA — chamada ao backend e geração dos arquivos Word (.docx) e slides (.pptx).
import { supabase } from "@/integrations/supabase/client";

export interface WorkSection {
  titulo: string;
  paragrafos: string[];
  imagem_sugerida?: string;
}
export interface WorkSlide {
  titulo: string;
  bullets: string[];
  nota_apresentador?: string;
}
export interface WorkContent {
  titulo: string;
  tema?: string;
  resumo_executivo?: string;
  introducao?: string;
  secoes: WorkSection[];
  conclusao?: string;
  referencias?: string[];
  slides: WorkSlide[];
}

export type WorkError = { kind: "signup_required" | "paywall" | "error"; message: string };

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/work-document`;

async function callFn(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const contentType = resp.headers.get("Content-Type") || "";
  if (!contentType.includes("ndjson") || !resp.body) {
    const payload = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, payload } as const;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: { status: number; payload: any } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg?.type === "result") final = { status: msg.status ?? 200, payload: msg.payload ?? {} };
      } catch { /* linha parcial */ }
    }
  }
  if (!final) return { ok: false, status: 500, payload: { error: "Conexão interrompida. Tente novamente." } } as const;
  return { ok: final.status >= 200 && final.status < 400, status: final.status, payload: final.payload } as const;
}

function toError(payload: any): WorkError {
  const err = payload?.error;
  if (err === "signup_required" || err === "paywall") {
    return { kind: err, message: payload?.message || "" };
  }
  return { kind: "error", message: payload?.message || err || "Não foi possível gerar o trabalho." };
}

export async function requestWork(input: {
  tema: string;
  disciplina?: string;
  curso?: string;
  instituicao?: string;
  tipo?: "word" | "slides" | "ambos";
}): Promise<{ data?: { id: string; content: WorkContent }; error?: WorkError }> {
  const { ok, payload } = await callFn({ action: "generate", ...input });
  if (ok) return { data: payload as { id: string; content: WorkContent } };
  return { error: toError(payload) };
}

export async function reviseWork(
  documentId: string,
  instrucao: string,
): Promise<{ data?: { content: WorkContent }; error?: WorkError }> {
  const { ok, payload } = await callFn({ action: "revise", document_id: documentId, instrucao });
  if (ok) return { data: payload as { content: WorkContent } };
  return { error: toError(payload) };
}

function safeName(title: string) {
  return (title || "trabalho").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "trabalho";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Theme = { primary: string; accent: string; light: string; font: string; titleFont: string; variant: number };
export const WORK_THEMES: Record<string, Theme> = {
  oceano: { primary: "1E2761", accent: "4A90C2", light: "E6EEF8", font: "Calibri", titleFont: "Georgia", variant: 0 },
  terracota: { primary: "8A3B12", accent: "D9822B", light: "FBEFE3", font: "Garamond", titleFont: "Garamond", variant: 1 },
  floresta: { primary: "1F4D2B", accent: "6BA368", light: "EAF4E8", font: "Verdana", titleFont: "Trebuchet MS", variant: 2 },
  grafite: { primary: "2B2B2B", accent: "E63946", light: "F1F1F1", font: "Arial", titleFont: "Arial Black", variant: 3 },
  vinho: { primary: "5B1A32", accent: "C27C8E", light: "F7E9EE", font: "Cambria", titleFont: "Cambria", variant: 0 },
  solar: { primary: "7A5200", accent: "F2B705", light: "FFF7DB", font: "Tahoma", titleFont: "Tahoma", variant: 1 },
  lavanda: { primary: "3E2F6B", accent: "9C88D9", light: "F0ECFA", font: "Segoe UI", titleFont: "Georgia", variant: 2 },
  petroleo: { primary: "0B4F5C", accent: "2BA3A8", light: "E3F4F5", font: "Calibri", titleFont: "Century Gothic", variant: 3 },
  areia: { primary: "5C4A32", accent: "B89B72", light: "F6F0E6", font: "Book Antiqua", titleFont: "Book Antiqua", variant: 0 },
  coral: { primary: "8C2F39", accent: "FF7F6B", light: "FFEDEA", font: "Verdana", titleFont: "Verdana", variant: 1 },
  noturno: { primary: "0D1B2A", accent: "48CAE4", light: "E0F4FA", font: "Arial", titleFont: "Impact", variant: 2 },
  menta: { primary: "155E55", accent: "3DD6B5", light: "E5FAF5", font: "Trebuchet MS", titleFont: "Trebuchet MS", variant: 3 },
};
const pickTheme = (t?: string | null) => WORK_THEMES[t || ""] || WORK_THEMES.oceano;

/** Gera e baixa o documento Word a partir do conteúdo já produzido (sem nova chamada de IA). */
export async function downloadWord(content: WorkContent, footer: string, themeKey?: string | null) {
  const th = pickTheme(themeKey);
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const children: any[] = [
    new Paragraph({
      alignment: th.variant % 2 ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { after: 400 },
      border: th.variant >= 2 ? { bottom: { style: "single" as any, size: 12, color: th.accent, space: 6 } } : undefined,
      children: [new TextRun({ text: content.titulo, bold: true, size: 40 + th.variant * 2, font: th.titleFont, color: th.primary })],
    }),
  ];

  const para = (text: string) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200, line: 360 },
      children: [new TextRun({ text, size: 24, font: th.font })],
    });

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
      shading: th.variant === 1 || th.variant === 3 ? { fill: th.light, type: "clear" as any, color: "auto" } : undefined,
      children: [new TextRun({ text, bold: true, size: 30, font: th.titleFont, color: th.variant === 3 ? th.accent : th.primary })],
    });

  if (content.resumo_executivo) {
    children.push(heading("Resumo"), para(content.resumo_executivo));
  }
  if (content.introducao) {
    children.push(heading("Introdução"), para(content.introducao));
  }
  (content.secoes ?? []).forEach((s) => {
    children.push(heading(s.titulo));
    (s.paragrafos ?? []).forEach((p) => children.push(para(p)));
  });
  if (content.conclusao) children.push(heading("Conclusão"), para(content.conclusao));
  if (content.referencias?.length) {
    children.push(heading("Referências"));
    content.referencias.forEach((r) => children.push(para(r)));
  }
  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [new TextRun({ text: footer, size: 18, color: "808080", font: "Arial" })],
    }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: th.font, size: 24 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  download(blob, `${safeName(content.titulo)}.docx`);
}

/** Gera e baixa a apresentação de slides a partir do conteúdo já produzido. */
export async function downloadSlides(content: WorkContent, footer: string, themeKey?: string | null) {
  const th = pickTheme(themeKey);
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const capa = pptx.addSlide();
  capa.background = { color: th.variant === 1 ? th.light : th.primary };
  if (th.variant === 2) capa.addShape("rect" as any, { x: 0, y: 0, w: 0.35, h: 5.63, fill: { color: th.accent } });
  if (th.variant === 3) capa.addShape("rect" as any, { x: 0, y: 4.3, w: 10, h: 0.12, fill: { color: th.accent } });
  const capaText = th.variant === 1 ? th.primary : "FFFFFF";
  capa.addText(content.titulo, {
    x: 0.7, y: 1.9, w: 8.6, h: 1.6, fontSize: 40, bold: true, color: capaText, fontFace: th.titleFont, align: th.variant === 0 ? "center" : "left",
  });
  if (content.tema) {
    capa.addText(content.tema, { x: 0.7, y: 3.5, w: 8.6, h: 0.6, fontSize: 20, color: th.accent, fontFace: th.font });
  }
  capa.addText(footer, { x: 0.7, y: 4.8, w: 8.6, h: 0.4, fontSize: 11, color: th.accent, fontFace: th.font });

  (content.slides ?? []).forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: th.variant === 2 ? th.light : "FFFFFF" };
    if (th.variant === 0) slide.addShape("rect" as any, { x: 0, y: 0, w: 10, h: 0.18, fill: { color: th.accent } });
    if (th.variant === 1) slide.addShape("rect" as any, { x: 0, y: 0, w: 10, h: 1.3, fill: { color: th.primary } });
    if (th.variant === 3) slide.addShape("rect" as any, { x: 9.3, y: 0, w: 0.7, h: 5.63, fill: { color: i % 2 ? th.accent : th.primary } });
    slide.addText(s.titulo, { x: 0.6, y: 0.3, w: 8.6, h: 0.9, fontSize: 28, bold: true, color: th.variant === 1 ? "FFFFFF" : th.primary, fontFace: th.titleFont });
    slide.addText(
      (s.bullets ?? []).map((b) => ({ text: b, options: { bullet: th.variant === 3 ? { code: "25A0" } : true, fontSize: 20, color: "333333", fontFace: th.font, breakLine: true } })),
      { x: 0.8, y: 1.6, w: 8.4, h: 3.2 },
    );
    slide.addText(footer, { x: 0.6, y: 5.0, w: 8.8, h: 0.3, fontSize: 10, color: "999999", fontFace: th.font });
    if (s.nota_apresentador) slide.addNotes(s.nota_apresentador);
  });

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  download(blob, `${safeName(content.titulo)}.pptx`);
}

export type WorkExtras = {
  dicas_gerais?: string[];
  dicas?: { slide: string; dica: string; tempo?: string }[];
  perguntas?: { pergunta: string; resposta: string }[];
};

/** Gera (uma vez) as dicas de apresentação e as perguntas prováveis exclusivas deste trabalho. */
export async function getWorkExtras(documentId: string, refresh = false): Promise<{ data?: WorkExtras; error?: string }> {
  const { ok, payload } = await callFn({ action: "extras", document_id: documentId, refresh });
  if (ok) return { data: (payload as any).extras as WorkExtras };
  return { error: (payload as any)?.error || "Não foi possível gerar agora." };
}
