import jsPDF from "jspdf";
import { getPdfBranding, buildCompanyFooterLines } from "./pdfBranding";

export interface CancellationPdfData {
  studentName?: string;
  studentEmail?: string;
  planName: string;
  planPrice: number;
  totalDays: number;
  daysUsed: number;
  dailyRate: number;
  usedAmount: number;
  minUsageChargePct: number;
  minCharge: number;
  /** Subtotal proporcional (max(usedAmount, minCharge)) */
  proRataAmount?: number;
  /** Configuração de permanência mínima */
  allowFreeCancel?: boolean;
  minCommitmentDays?: number;
  totalSubscriptionDays?: number;
  commitmentDaysRemaining?: number;
  commitmentPenalty?: number;
  /** Total final = proRata + commitmentPenalty */
  chargeAmount: number;
  effectiveDate: string; // dd/mm/yyyy
}

const fmt = (n: number) =>
  `R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildCancellationPdf(data: CancellationPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // Derived (with safe fallbacks for older callers)
  const proRataAmount = data.proRataAmount ?? Math.max(data.usedAmount, data.minCharge);
  const commitmentPenalty = data.commitmentPenalty ?? 0;
  const commitmentDaysRemaining = data.commitmentDaysRemaining ?? 0;
  const isInCommitment = commitmentPenalty > 0 && commitmentDaysRemaining > 0;

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
  doc.text("Comprovante de cancelamento", pageW - margin, headerTopY + 4, { align: "right" });
  y = Math.max(headerLeftBottom, headerTopY + 8) + 2;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Title
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

  // Plan
  doc.setFont("helvetica", "bold");
  doc.text("Plano", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`${data.planName} — ${fmt(data.planPrice)}/mês`, margin, y);
  y += 8;

  // Calculation table
  doc.setFont("helvetica", "bold");
  doc.text("Cálculo do cancelamento", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const rows: [string, string][] = [
    ["Ciclo total considerado", `${data.totalDays} dias`],
    ["Dias usados no ciclo", `${data.daysUsed} dias`],
    ["Valor diário do plano", `${fmt(data.dailyRate)} (${fmt(data.planPrice)} ÷ ${data.totalDays})`],
    ["Uso proporcional", `${fmt(data.usedAmount)} (${fmt(data.dailyRate)} × ${data.daysUsed})`],
    [
      `Cobrança mínima do ciclo (${data.minUsageChargePct}%)`,
      `${fmt(data.minCharge)}`,
    ],
    [
      "Critério proporcional aplicado",
      data.minCharge > data.usedAmount ? "Mínimo do plano" : "Uso proporcional",
    ],
    ["Subtotal proporcional", fmt(proRataAmount)],
  ];
  if (isInCommitment) {
    rows.push([
      `Multa de permanência (${commitmentDaysRemaining} dias restantes de ${data.minCommitmentDays ?? 0})`,
      `${fmt(commitmentPenalty)} (${fmt(data.dailyRate)} × ${commitmentDaysRemaining})`,
    ]);
  }
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

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(pr, pg, pb);
  doc.text(`Total cobrado: ${fmt(data.chargeAmount)}`, margin, y);
  y += 8;

  // Plain-language explanation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  let usedExplanation =
    `Você usou ${data.daysUsed} de ${data.totalDays} dias do ciclo no plano ${data.planName}. ` +
    `O valor proporcional pelos dias usados é ${fmt(data.usedAmount)}. ` +
    (data.minCharge > data.usedAmount && data.minUsageChargePct > 0
      ? `Como o plano possui cobrança mínima de ${data.minUsageChargePct}% (${fmt(data.minCharge)}), o subtotal proporcional aplicado foi ${fmt(proRataAmount)}. `
      : `Esse foi o subtotal proporcional aplicado, pois é maior ou igual à cobrança mínima do plano (${fmt(proRataAmount)}). `);
  if (isInCommitment) {
    usedExplanation +=
      `O plano possui permanência mínima de ${data.minCommitmentDays} dias e você está no dia ${data.totalSubscriptionDays}. ` +
      `Por isso, foi adicionada uma multa de permanência de ${fmt(commitmentPenalty)} referente aos ${commitmentDaysRemaining} dias restantes de compromisso. `;
  }
  usedExplanation += `Total cobrado no cancelamento: ${fmt(data.chargeAmount)}.`;
  const wrapped = doc.splitTextToSize(usedExplanation, pageW - margin * 2);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 5 + 6;

  // Footer
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

  return doc;
}

export async function downloadCancellationPdf(data: CancellationPdfData, filename?: string) {
  const doc = await buildCancellationPdf(data);
  const safeDate = data.effectiveDate.replace(/\//g, "-");
  doc.save(filename || `cancelamento-${safeDate}.pdf`);
}
