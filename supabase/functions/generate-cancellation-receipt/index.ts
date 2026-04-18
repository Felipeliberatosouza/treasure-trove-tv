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

function buildPdf(data: ReceiptData): Uint8Array {
  const dailyRate = data.totalDays > 0 ? data.planPrice / data.totalDays : 0;
  const usedAmount = dailyRate * data.daysUsed;
  const minCharge = ((data.minUsageChargePct || 0) / 100) * data.planPrice;
  const chargeAmount = Math.max(usedAmount, minCharge);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Revisão Fácil", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text("Comprovante de cancelamento", pageW - margin, y, { align: "right" });
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setTextColor(20);
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
  doc.setTextColor(0, 80, 180);
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

    const pdfBytes = buildPdf(data);

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
