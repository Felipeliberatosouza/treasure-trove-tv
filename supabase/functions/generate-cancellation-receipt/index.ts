import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import jsPDF from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReceiptData {
  userId: string;
  studentName?: string;
  studentEmail?: string;
  planName: string;
  planPrice: number;
  totalDays: number;
  daysUsed: number;
  minUsageChargePct: number;
  effectiveDate: string; // dd/mm/yyyy
}

const fmt = (n: number) =>
  `R$ ${Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface BrandingForPdf {
  platformName: string;
  logoDataUrl: string | null;
  logoFormat: "PNG" | "JPEG" | null;
  logoWidth: number;
  logoHeight: number;
  company: { razaoSocial: string; cnpj: string; address: string };
  primaryRgb: [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = (hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function formatCnpj(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length !== 14) return raw || "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function buildCompanyFooterLines(c: BrandingForPdf["company"]): string[] {
  const parts: string[] = [];
  if (c.razaoSocial && c.cnpj) parts.push(`${c.razaoSocial} — CNPJ ${c.cnpj}`);
  else if (c.razaoSocial) parts.push(c.razaoSocial);
  else if (c.cnpj) parts.push(`CNPJ ${c.cnpj}`);
  if (c.address) parts.push(c.address);
  return parts;
}

async function fetchBranding(supabase: ReturnType<typeof createClient>): Promise<BrandingForPdf> {
  const fallback: BrandingForPdf = {
    platformName: "Revisão Fácil",
    logoDataUrl: null,
    logoFormat: null,
    logoWidth: 0,
    logoHeight: 0,
    company: { razaoSocial: "", cnpj: "", address: "" },
    primaryRgb: [0, 80, 180],
  };
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", ["branding", "contact"]);
    let logoUrl = "";
    for (const row of (data ?? []) as Array<{ key: string; value: Record<string, string> }>) {
      const v = row.value ?? {};
      if (row.key === "branding") {
        if (v.platform_name) fallback.platformName = v.platform_name;
        if (v.logo_url) logoUrl = v.logo_url;
        const rgb = hexToRgb(v.primary_color || "");
        if (rgb) fallback.primaryRgb = rgb;
      } else if (row.key === "contact") {
        fallback.company.razaoSocial = v.razao_social || v.nome_fantasia || "";
        fallback.company.cnpj = formatCnpj(v.cnpj || "");
        fallback.company.address = v.platform_address || v.address || "";
      }
    }
    if (!logoUrl) return fallback;
    const res = await fetch(logoUrl);
    if (!res.ok) return fallback;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isPng = ct.includes("png") || /\.png(\?|$)/i.test(logoUrl);
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    fallback.logoDataUrl = `data:${isPng ? "image/png" : "image/jpeg"};base64,${b64}`;
    fallback.logoFormat = isPng ? "PNG" : "JPEG";
    fallback.logoWidth = 200;
    fallback.logoHeight = 60;
    return fallback;
  } catch (e) {
    console.warn("[gen-receipt] branding fetch failed", e);
    return fallback;
  }
}

async function buildPdf(data: ReceiptData, branding: BrandingForPdf): Promise<Uint8Array> {
  const dailyRate = data.totalDays > 0 ? data.planPrice / data.totalDays : 0;
  const usedAmount = dailyRate * data.daysUsed;
  const minCharge = ((data.minUsageChargePct || 0) / 100) * data.planPrice;
  const chargeAmount = Math.max(usedAmount, minCharge);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const headerTopY = y;
  let headerLeftBottom = y;
  if (branding.logoDataUrl && branding.logoFormat) {
    const ratio = branding.logoWidth / branding.logoHeight || 3.3;
    const maxH = 14;
    const maxW = 60;
    let h = maxH;
    let w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    try {
      doc.addImage(branding.logoDataUrl, branding.logoFormat, margin, headerTopY - 3, w, h);
      headerLeftBottom = headerTopY - 3 + h;
    } catch (e) {
      console.warn("[gen-receipt] addImage failed, falling back to text", e);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(branding.platformName, margin, y);
      headerLeftBottom = y + 2;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(branding.platformName, margin, y);
    headerLeftBottom = y + 2;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text("Comprovante de cancelamento", pageW - margin, headerTopY + 4, { align: "right" });
  y = Math.max(headerLeftBottom, headerTopY + 8) + 2;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  const [pr, pg, pb] = branding.primaryRgb;
  doc.setTextColor(pr, pg, pb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Cancelamento — ${data.planName}`, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Data efetiva: ${data.effectiveDate}`, margin, y);
  y += 8;

  if (data.studentName || data.studentEmail) {
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text("Aluno", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    if (data.studentName) { doc.text(data.studentName, margin, y); y += 5; }
    if (data.studentEmail) { doc.text(data.studentEmail, margin, y); y += 5; }
    y += 3;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Plano", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`${data.planName} — ${fmt(data.planPrice)}/mês`, margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Cálculo do cancelamento", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const rows: [string, string][] = [
    ["Ciclo total considerado", `${data.totalDays} dias`],
    ["Dias usados no ciclo", `${data.daysUsed} dias`],
    ["Valor diário do plano", `${fmt(dailyRate)} (${fmt(data.planPrice)} ÷ ${data.totalDays})`],
    ["Uso proporcional", `${fmt(usedAmount)} (${fmt(dailyRate)} × ${data.daysUsed})`],
    [`Cobrança mínima (${data.minUsageChargePct}%)`, `${fmt(minCharge)}`],
    ["Critério aplicado", minCharge > usedAmount ? "Mínimo do plano" : "Uso proporcional"],
  ];
  doc.setDrawColor(230);
  rows.forEach(([label, value]) => {
    doc.setTextColor(70);
    doc.text(label, margin, y);
    doc.setTextColor(20);
    doc.text(value, pageW - margin, y, { align: "right" });
    y += 5;
    doc.line(margin, y - 1, pageW - margin, y - 1);
  });
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(pr, pg, pb);
  doc.text(`Total cobrado: ${fmt(chargeAmount)}`, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const explanation =
    `Você usou ${data.daysUsed} de ${data.totalDays} dias do ciclo no plano ${data.planName}. ` +
    `O valor proporcional pelos dias usados é ${fmt(usedAmount)}. ` +
    (minCharge > usedAmount && data.minUsageChargePct > 0
      ? `Como o plano possui cobrança mínima de ${data.minUsageChargePct}% (${fmt(minCharge)}), esse foi o valor aplicado. `
      : `Esse foi o valor aplicado, pois é maior que a cobrança mínima do plano. `) +
    `Total cobrado no cancelamento: ${fmt(chargeAmount)}.`;
  const wrapped = doc.splitTextToSize(explanation, pageW - margin * 2);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 5 + 6;

  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(110);
  const companyLines = buildCompanyFooterLines(branding.company);
  for (const line of companyLines) {
    const wrappedLine = doc.splitTextToSize(line, pageW - margin * 2);
    doc.text(wrappedLine, margin, y);
    y += wrappedLine.length * 4;
  }
  if (companyLines.length > 0) y += 2;
  doc.setTextColor(140);
  doc.text(
    "Este comprovante reflete o cálculo apresentado no momento do cancelamento. Em caso de dúvidas, contate o suporte.",
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  );

  // Return as Uint8Array
  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const data = (await req.json()) as ReceiptData;

    if (!data?.userId || !data?.planName || !data?.effectiveDate) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const branding = await fetchBranding(supabase);
    const pdfBytes = await buildPdf(data, branding);

    const safeDate = data.effectiveDate.replace(/\//g, "-");
    const fileName = `cancelamento-${safeDate}-${crypto.randomUUID().slice(0, 8)}.pdf`;
    const path = `${data.userId}/${fileName}`;

    const { error: upErr } = await supabase.storage
      .from("cancellation-receipts")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (upErr) {
      console.error("[gen-receipt] upload error", upErr);
      return new Response(
        JSON.stringify({ error: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Signed URL valid for 30 days
    const { data: signed, error: signErr } = await supabase.storage
      .from("cancellation-receipts")
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    if (signErr || !signed) {
      return new Response(
        JSON.stringify({ error: signErr?.message || "Failed to sign URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ url: signed.signedUrl, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gen-receipt] ERROR", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
