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
  /** Largura MÁXIMA da logo em px (default 320, igual ao site `max-w-[320px]`).
   *  A largura real renderizada segue a proporção natural da imagem (height fixo). */
  logoMaxWidth?: number;
  /** Altura fixa da logo em px (default 80, igual ao `h-20` do site). */
  logoHeight?: number;
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
  logoMaxWidth = 320,
  logoHeight = 80,
}: BuildEmailLogoParams): string {
  const cleanSlogan = (slogan || "").trim();
  // Mesma fórmula do Navbar/Footer: cap em 18px. Calculada sobre logoMaxWidth
  // (referência conservadora, mesma do site `max-w-[320px]`).
  const sloganFontSize =
    cleanSlogan.length > 0
      ? Math.max(8, Math.min(18, (logoMaxWidth / cleanSlogan.length) * 1.7))
      : 11;

  // Estratégia email-safe (sem JS, sem medir DOM):
  // Envolvemos logo + slogan numa <table> com `width:auto` (shrink-to-fit ao
  // conteúdo). A logo tem altura fixa (`height=logoHeight`) e largura
  // proporcional (`width:auto`), assim como no site (`h-20 object-contain`).
  // O slogan ocupa `width:100%` da mesma célula → fica EXATAMENTE da largura
  // da logo, igual ao comportamento do `Footer`/`Navbar`.

  const sloganRow = cleanSlogan
    ? `<tr><td style="padding:0;text-align:center;">` +
      `<div style="width:100%;margin-top:-12px;color:#6b7280;` +
      `font-size:${sloganFontSize.toFixed(1)}px;line-height:1;` +
      `white-space:nowrap;overflow:hidden;">` +
      `${escapeHtml(cleanSlogan)}</div></td></tr>`
    : "";

  const logoCell =
    useUploadedLogo && logoUrl
      ? // `height` em atributo HTML para máxima compatibilidade (Outlook).
        // `width:auto` mantém proporção natural; `max-width` evita overflow.
        `<img src="${escapeHtml(logoUrl)}" alt="Logo" height="${logoHeight}" ` +
        `style="height:${logoHeight}px;width:auto;max-width:${logoMaxWidth}px;` +
        `display:block;border:0;outline:none;" />`
      : `<div style="font-size:24px;font-weight:bold;color:${headingColor};` +
        `line-height:1;white-space:nowrap;">${escapeHtml(platformName)}</div>`;

  // `width:auto` + `display:inline-block` faz a tabela colapsar ao conteúdo
  // (largura da logo). Wrapper externo centraliza horizontalmente.
  return (
    `<div style="text-align:center;margin-bottom:16px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;display:inline-block;width:auto;">` +
    `<tr><td style="padding:0;text-align:center;">${logoCell}</td></tr>` +
    sloganRow +
    `</table></div>`
  );
}
