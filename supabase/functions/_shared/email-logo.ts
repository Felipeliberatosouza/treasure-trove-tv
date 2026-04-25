// Helper compartilhado entre o admin (preview no client) e as edge functions
// para montar o bloco de logomarca + slogan dos e-mails com o MESMO cálculo
// e estilos. Mantém TS puro, sem deps de Deno ou DOM.

export interface BuildEmailLogoParams {
  /** URL da logo (já priorizada: template > branding global). Pode ser vazio. */
  logoUrl?: string | null;
  /** Se true e houver logoUrl, usa a imagem; senão usa o platformName em texto. */
  useUploadedLogo?: boolean;
  /** Nome da plataforma usado como fallback textual. */
  platformName: string;
  /** Slogan (já trim/normalizado ou cru — o helper faz trim). */
  slogan?: string | null;
  /** Cor do texto do nome da plataforma quando usado como fallback. */
  headingColor?: string;
  /** Largura EXATA renderizada da logo em px (default 240). O slogan ocupa
   *  exatamente esta mesma largura, garantindo paridade visual. */
  logoMaxWidth?: number;
}

/** Escape HTML completo (cobre &, <, >, ", '). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Monta o HTML inline (compatível com clients de e-mail) da logomarca com
 * slogan opcional logo abaixo, seguindo o mesmo padrão visual do site:
 * - slogan centralizado, levemente sobreposto à logo (margin-top negativa)
 * - font-size do slogan calculada para preencher a largura da logo
 *   sem ultrapassar [8px, 14px]
 */
export function buildEmailLogoHtml({
  logoUrl,
  useUploadedLogo,
  platformName,
  slogan,
  headingColor = "#dc2626",
  logoMaxWidth = 240,
}: BuildEmailLogoParams): string {
  // Largura compartilhada por logo e slogan — garante "comprimento" idêntico.
  const w = logoMaxWidth;
  const cleanSlogan = (slogan || "").trim();
  // Mesma fórmula do Navbar/Footer: cap em 18px para manter proporcionalidade
  // visual idêntica ao site, calculada sobre a largura real (w).
  const sloganFontSize =
    cleanSlogan.length > 0
      ? Math.max(8, Math.min(18, (w / cleanSlogan.length) * 1.7))
      : 11;

  // Slogan: bloco de largura fixa `w` (mesma da logo). margin auto centraliza.
  // margem-top negativa aproxima do logo (espelha `-mt-6` do site).
  const sloganHtml = cleanSlogan
    ? `<div style="width:${w}px;margin:-12px auto 16px;text-align:center;` +
      `color:#6b7280;font-size:${sloganFontSize.toFixed(1)}px;line-height:1;` +
      `white-space:nowrap;overflow:hidden;">` +
      `${escapeHtml(cleanSlogan)}</div>`
    : "";

  const bottomMargin = cleanSlogan ? "0" : "16px";
  // Logo: renderizada com largura EXATA = w (mesma do slogan), altura
  // proporcional (height:auto). Centralizada via margin auto.
  const inner =
    useUploadedLogo && logoUrl
      ? `<div style="text-align:center;margin-bottom:${bottomMargin};">` +
        `<img src="${escapeHtml(logoUrl)}" alt="Logo" ` +
        `style="width:${w}px;max-width:${w}px;height:auto;display:block;margin:0 auto;" /></div>`
      : `<div style="width:${w}px;margin:0 auto ${bottomMargin};text-align:center;` +
        `font-size:24px;font-weight:bold;color:${headingColor};">` +
        `${escapeHtml(platformName)}</div>`;

  return `${inner}${sloganHtml}`;
}
