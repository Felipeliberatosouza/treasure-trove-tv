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

/** Gera e baixa o documento Word a partir do conteúdo já produzido (sem nova chamada de IA). */
export async function downloadWord(content: WorkContent, footer: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const children: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: content.titulo, bold: true, size: 40, font: "Arial" })],
    }),
  ];

  const para = (text: string) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200, line: 360 },
      children: [new TextRun({ text, size: 24, font: "Arial" })],
    });

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text, bold: true, size: 30, font: "Arial" })],
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
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
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
export async function downloadSlides(content: WorkContent, footer: string) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const capa = pptx.addSlide();
  capa.background = { color: "1E2761" };
  capa.addText(content.titulo, {
    x: 0.7, y: 1.9, w: 8.6, h: 1.6, fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Arial",
  });
  if (content.tema) {
    capa.addText(content.tema, { x: 0.7, y: 3.5, w: 8.6, h: 0.6, fontSize: 20, color: "CADCFC", fontFace: "Arial" });
  }
  capa.addText(footer, { x: 0.7, y: 4.8, w: 8.6, h: 0.4, fontSize: 11, color: "9AA8CF", fontFace: "Arial" });

  (content.slides ?? []).forEach((s) => {
    const slide = pptx.addSlide();
    slide.addText(s.titulo, { x: 0.6, y: 0.5, w: 8.8, h: 0.9, fontSize: 30, bold: true, color: "1E2761", fontFace: "Arial" });
    slide.addText(
      (s.bullets ?? []).map((b) => ({ text: b, options: { bullet: true, fontSize: 20, color: "333333", fontFace: "Arial", breakLine: true } })),
      { x: 0.8, y: 1.6, w: 8.4, h: 3.2 },
    );
    slide.addText(footer, { x: 0.6, y: 5.0, w: 8.8, h: 0.3, fontSize: 10, color: "999999", fontFace: "Arial" });
    if (s.nota_apresentador) slide.addNotes(s.nota_apresentador);
  });

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  download(blob, `${safeName(content.titulo)}.pptx`);
}
