// Kit de Revisão com IA — tipos, chamada à função de backend e exportação em PDF.
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { getPdfBranding, buildCompanyFooterLines } from "./pdfBranding";

export interface KitSection {
  titulo: string;
  conteudo: string;
}
export interface KitQuizQuestion {
  enunciado: string;
  alternativas: string[];
  resposta_correta: number;
  explicacao: string;
  subtopico?: string;
  dificuldade?: string;
}
export interface KitTopQuestion {
  enunciado: string;
  gabarito: string;
  subtopico?: string;
  dificuldade?: string;
}
export type AgeGroup =
  | "criancas_0_9"
  | "pre_adolescentes_10_13"
  | "adolescentes_14_17"
  | "jovens_18_25"
  | "adultos_26_45"
  | "adultos_46_mais";
export type BoardStepType = "texto" | "operacao" | "seta" | "linha" | "circulo" | "desenho";
export interface KitKeyword {
  termo: string;
  ancora: string;
}
export interface KitBoardStep {
  tipo: BoardStepType;
  conteudo: string;
  ancora: string;
  destaque?: string;
}
export interface KitSlide {
  titulo: string;
  bullets: string[];
  narracao: string;
  imagem_prompt?: string;
  frase_didatica?: string;
  palavras_chave?: KitKeyword[];
  modo_visual?: "conteudo" | "lousa" | "avatar";
  lousa_passos?: KitBoardStep[];
}
export interface RevisionKit {
  titulo: string;
  disciplina?: string;
  assunto: string;
  subtopicos?: string[];
  resumo: KitSection[];
  conceitos_chave: string[];
  exemplos?: string[];
  pontos_de_atencao?: string[];
  colinha: string[];
  simulado: KitQuizQuestion[];
  top_questoes: KitTopQuestion[];
  slides: KitSlide[];
  faixa_etaria?: AgeGroup;
  confianca_faixa_etaria?: number;
}

export interface KitResponse {
  source: "cache" | "generated";
  request_id?: string;
  canonical_id?: string | null;
  kit: RevisionKit;
  /** Áreas de curso vinculadas ao material (classificação automática/admin). */
  areas?: string[];
  balance?: number | null;
}

export interface KitStatus {
  authenticated: boolean;
  balance: number;
  anon_free_left: number;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-revision-kit`;
const ANON_KEY_STORAGE = "rf_ai_anon_id";

/** Identificador do dispositivo para o uso gratuito anônimo (validado no servidor). */
export function getAnonId(): string {
  let id = localStorage.getItem(ANON_KEY_STORAGE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY_STORAGE, id);
    // cookie de longa duração para o servidor reconhecer o mesmo navegador
    document.cookie = `rf_ai_anon=${id}; path=/; max-age=31536000; samesite=lax`;
  }
  return id;
}

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
    body: JSON.stringify({ ...body, anon_id: getAnonId() }),
  });
  const contentType = resp.headers.get("Content-Type") || "";
  if (!contentType.includes("ndjson") || !resp.body) {
    const payload = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, payload } as const;
  }

  // Resposta em linhas: "pings" mantêm a conexão viva até o resultado final.
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: { status: number; payload: any } | null = null;
  while (true) {
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
      } catch { /* linha parcial ou ping inválido */ }
    }
  }
  if (!final) return { ok: false, status: 500, payload: { error: "Conexão interrompida. Tente novamente." } } as const;
  return { ok: final.status >= 200 && final.status < 400, status: final.status, payload: final.payload } as const;
}


export async function fetchKitStatus(): Promise<KitStatus> {
  const { ok, payload } = await callFn({ action: "status" });
  if (!ok) return { authenticated: false, balance: 0, anon_free_left: 0 };
  return payload as KitStatus;
}

export async function fetchKitById(canonicalId: string): Promise<KitResponse | null> {
  const { data, error } = await supabase
    .from("ai_canonical_contents")
    .select("id, kit, areas")
    .eq("id", canonicalId)
    .eq("status", "ready")
    .eq("visibility", "public_canonical")
    .maybeSingle();
  if (error || !data) return null;
  return {
    source: "cache",
    canonical_id: data.id,
    areas: ((data as { areas?: string[] | null }).areas ?? []) as string[],
    kit: data.kit as unknown as RevisionKit,
  };
}

export type KitError = { kind: "signup_required" | "paywall" | "error"; message: string };

export async function requestKit(input: {
  assunto: string;
  disciplina?: string;
  curso?: string;
  instituicao?: string;
  exam_date?: string;
  nivel?: "rapido" | "aprofundado";
  idempotency_key: string;
}): Promise<{ data?: KitResponse; error?: KitError }> {
  const { ok, payload } = await callFn({ action: "generate", ...input });
  if (ok) return { data: payload as KitResponse };
  const err = (payload as any)?.error;
  if (err === "signup_required" || err === "paywall") {
    return { error: { kind: err, message: (payload as any).message } };
  }
  return {
    error: {
      kind: "error",
      message: (payload as any)?.message || (payload as any)?.error || "Não foi possível gerar o Kit de Revisão.",
    },
  };
}

/** Gera o PDF do Kit a partir do conteúdo já estruturado (sem nova chamada de IA). */
export async function buildKitPdf(kit: RevisionKit): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pageW - margin * 2;
  let y = margin;

  const branding = await getPdfBranding();
  const [r, g, b] = branding.primaryRgb;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 22) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string, size = 13) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(r, g, b);
    doc.text(text, margin, y);
    y += size * 0.45 + 3;
    doc.setTextColor(30, 30, 30);
  };

  const paragraph = (text: string, size = 10.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += size * 0.5;
    }
    y += 2;
  };

  const bullet = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(text, maxW - 5);
    lines.forEach((line: string, i: number) => {
      ensureSpace(6);
      if (i === 0) doc.text("•", margin, y);
      doc.text(line, margin + 5, y);
      y += 5.2;
    });
  };

  // Cabeçalho
  if (branding.logoDataUrl && branding.logoFormat && branding.logoWidth && branding.logoHeight) {
    const ratio = branding.logoWidth / branding.logoHeight;
    let h = 13;
    let w = h * ratio;
    if (w > 55) { w = 55; h = w / ratio; }
    try {
      doc.addImage(branding.logoDataUrl, branding.logoFormat, margin, y - 4, w, h);
    } catch { /* ignora logo inválida */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(branding.platformName, pageW - margin, y + 2, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(branding.commercialDomain, pageW - margin, y + 7, { align: "right" });
  y += 18;
  doc.setTextColor(30, 30, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.splitTextToSize(kit.titulo || kit.assunto, maxW).forEach((line: string) => {
    ensureSpace(10);
    doc.text(line, margin, y);
    y += 8;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  const meta = [kit.disciplina, kit.assunto, `Gerado em ${new Date().toLocaleDateString("pt-BR")}`]
    .filter(Boolean)
    .join("  •  ");
  doc.text(meta, margin, y);
  y += 8;
  doc.setTextColor(30, 30, 30);

  heading("Resumo");
  kit.resumo?.forEach((s) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(s.titulo, margin, y);
    y += 5.5;
    paragraph(s.conteudo);
  });

  if (kit.conceitos_chave?.length) {
    heading("Conceitos-chave");
    kit.conceitos_chave.forEach(bullet);
    y += 3;
  }
  if (kit.exemplos?.length) {
    heading("Exemplos");
    kit.exemplos.forEach(bullet);
    y += 3;
  }
  if (kit.pontos_de_atencao?.length) {
    heading("Pontos de atenção");
    kit.pontos_de_atencao.forEach(bullet);
    y += 3;
  }
  if (kit.colinha?.length) {
    heading("Colinha");
    kit.colinha.forEach(bullet);
    y += 3;
  }
  if (kit.top_questoes?.length) {
    heading("Top Questões com gabarito comentado");
    kit.top_questoes.forEach((q, i) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(`${i + 1}. ${q.enunciado}`, margin, y, { maxWidth: maxW });
      y += doc.splitTextToSize(`${i + 1}. ${q.enunciado}`, maxW).length * 5.2 + 1;
      paragraph(q.gabarito);
    });
  }

  // Rodapé em todas as páginas
  const footerLines = buildCompanyFooterLines(branding.company);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    const base = pageH - 14;
    doc.text(
      "Material produzido com apoio de inteligência artificial — confira com seu professor e material oficial.",
      margin,
      base,
      { maxWidth: maxW },
    );
    footerLines.forEach((line, i) => doc.text(line, margin, base + 4 + i * 3.5, { maxWidth: maxW }));
    doc.text(`${p}/${pages}`, pageW - margin, base, { align: "right" });
  }

  return doc;
}
