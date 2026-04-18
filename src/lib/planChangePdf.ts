import jsPDF from "jspdf";
import { getPdfBranding, buildCompanyFooterLines } from "./pdfBranding";

export interface PlanChangePdfData {
  studentName?: string;
  studentEmail?: string;
  previousPlan: string;
  previousPlanPrice: number;
  newPlan: string;
  newPlanPrice: number;
  changeType: "upgrade" | "downgrade" | "change";
  totalDays: number;
  daysUsed: number;
  daysRemaining: number;
  dailyOld: number;
  dailyNew: number;
  credit: number;
  newProRata: number;
  balance: number; // >0 charge, <0 credit
  effectiveDate: string; // already formatted dd/mm/yyyy
}

const fmt = (n: number) =>
  `R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Generates a PDF receipt for a plan change with the same calculation
 * shown in the UI (statement + checkout modal). Returns the jsPDF instance
 * so the caller can save or get it as a blob.
 */
export async function buildPlanChangePdf(data: PlanChangePdfData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // Header with logo
  const branding = await getPdfBranding();
  const headerTopY = y;
  let headerLeftBottom = y;
  if (branding.logoDataUrl && branding.logoFormat && branding.logoWidth && branding.logoHeight) {
    const maxH = 14;
    const maxW = 60;
    const ratio = branding.logoWidth / branding.logoHeight;
    let h = maxH;
    let w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    try {
      doc.addImage(branding.logoDataUrl, branding.logoFormat, margin, headerTopY - 3, w, h);
      headerLeftBottom = headerTopY - 3 + h;
    } catch {
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
  doc.text("Comprovante de mudança de plano", pageW - margin, headerTopY + 4, { align: "right" });
  y = Math.max(headerLeftBottom, headerTopY + 8) + 2;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Title
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleMap = { upgrade: "Upgrade de plano", downgrade: "Downgrade de plano", change: "Mudança de plano" };
  doc.text(titleMap[data.changeType], margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Data efetiva: ${data.effectiveDate}`, margin, y);
  y += 8;

  // Student block
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

  // Plans
  doc.setFont("helvetica", "bold");
  doc.text("Planos", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Plano anterior: ${data.previousPlan} — ${fmt(data.previousPlanPrice)}/mês`, margin, y);
  y += 5;
  doc.text(`Novo plano: ${data.newPlan} — ${fmt(data.newPlanPrice)}/mês`, margin, y);
  y += 8;

  // Calculation table
  doc.setFont("helvetica", "bold");
  doc.text("Cálculo proporcional", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const rows: [string, string][] = [
    ["Ciclo total considerado", `${data.totalDays} dias`],
    ["Dias usados no plano anterior", `${data.daysUsed} dias`],
    ["Dias restantes no ciclo", `${data.daysRemaining} dias`],
    ["Valor diário do plano anterior", `${fmt(data.dailyOld)} (${fmt(data.previousPlanPrice)} ÷ ${data.totalDays})`],
    ["Valor diário do novo plano", `${fmt(data.dailyNew)} (${fmt(data.newPlanPrice)} ÷ ${data.totalDays})`],
    ["Crédito (dias restantes × diário antigo)", `- ${fmt(data.credit)}`],
    ["Custo proporcional no novo plano", `${fmt(data.newProRata)}`],
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

  // Balance
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  if (data.balance > 0.005) {
    doc.setTextColor(0, 80, 180);
    doc.text(`Saldo a pagar: ${fmt(data.balance)}`, margin, y);
  } else if (data.balance < -0.005) {
    doc.setTextColor(0, 130, 60);
    doc.text(`Saldo de crédito: ${fmt(data.balance)} (próxima fatura)`, margin, y);
  } else {
    doc.setTextColor(80);
    doc.text("Sem saldo a ajustar", margin, y);
  }
  y += 8;

  // Plain-language explanation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const explanation =
    `Você usou ${data.daysUsed} de ${data.totalDays} dias do ${data.previousPlan} ` +
    `(crédito de ${fmt(data.credit)}). Esses ${data.daysRemaining} dias no novo plano ` +
    `custariam ${fmt(data.newProRata)}. ` +
    (data.balance > 0
      ? `Diferença a pagar: ${fmt(data.balance)}.`
      : data.balance < 0
        ? `Crédito de ${fmt(data.balance)} será aplicado na próxima fatura.`
        : `Sem ajuste financeiro nesta troca.`);
  const wrapped = doc.splitTextToSize(explanation, pageW - margin * 2);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 5 + 6;

  // Footer
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    "Este comprovante reflete o cálculo apresentado no momento da troca de plano. Em caso de dúvidas, contate o suporte.",
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  );

  return doc;
}

export async function downloadPlanChangePdf(data: PlanChangePdfData, filename?: string) {
  const doc = await buildPlanChangePdf(data);
  const safeDate = data.effectiveDate.replace(/\//g, "-");
  doc.save(filename || `troca-plano-${safeDate}.pdf`);
}
