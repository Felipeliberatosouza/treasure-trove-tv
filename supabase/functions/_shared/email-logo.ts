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
  /** Largura de referência da logo em px (default 200). */
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
  logoMaxWidth = 200,
}: BuildEmailLogoParams): string {
  const cleanSlogan = (slogan || "").trim();
  const sloganFontSize =
    cleanSlogan.length > 0
      ? Math.max(8, Math.min(14, (logoMaxWidth / cleanSlogan.length) * 1.7))
      : 11;

  const sloganHtml = cleanSlogan
    ? `<div style="text-align:center;margin-top:-6px;margin-bottom:16px;">` +
      `<span style="display:inline-block;max-width:${logoMaxWidth}px;color:#6b7280;` +
      `font-size:${sloganFontSize.toFixed(1)}px;line-height:1;white-space:nowrap;overflow:hidden;">` +
      `${escapeHtml(cleanSlogan)}</span></div>`
    : "";

  const bottomMargin = cleanSlogan ? "0" : "16px";
  const inner =
    useUploadedLogo && logoUrl
      ? `<div style="text-align:center;margin-bottom:${bottomMargin};">` +
        `<img src="${escapeHtml(logoUrl)}" alt="Logo" ` +
        `style="max-height:60px;max-width:${logoMaxWidth}px;display:inline-block;" /></div>`
      : `<div style="text-align:center;margin-bottom:${bottomMargin};` +
        `font-size:24px;font-weight:bold;color:${headingColor};">` +
        `${escapeHtml(platformName)}</div>`;

  return `${inner}${sloganHtml}`;
}
