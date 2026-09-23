/**
 * Aplica a identidade visual configurada pelo administrador diretamente nas
 * variáveis CSS do documento. É usada tanto no boot (com o cache local, antes
 * do React renderizar) quanto sempre que as configurações chegam do backend.
 */

export interface BrandingVars {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  button_text_color?: string;
  favicon_url?: string;
  primary_button_bg?: string;
  primary_button_text?: string;
  primary_button_hover_bg?: string;
  primary_button_hover_text?: string;
  secondary_button_bg?: string;
  secondary_button_text?: string;
  secondary_button_hover_bg?: string;
  secondary_button_hover_text?: string;
  selection_button_bg?: string;
  selection_button_text?: string;
  selection_button_selected_bg?: string;
  selection_button_selected_text?: string;
  input_bg?: string;
  input_text?: string;
  input_border?: string;
  textarea_bg?: string;
  textarea_text?: string;
  textarea_border?: string;
}

export function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Luminância relativa (0–1) de uma cor hexadecimal, conforme a WCAG. */
export function hexLuminance(hex: string): number | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(m[1], 16));
  const g = channel(parseInt(m[2], 16));
  const b = channel(parseInt(m[3], 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const l1 = hexLuminance(hex1);
  const l2 = hexLuminance(hex2);
  if (l1 == null || l2 == null) return null;
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Escolhe branco ou preto conforme o melhor contraste com o fundo. */
export function autoContrastText(bgHex: string): string {
  const lum = hexLuminance(bgHex);
  if (lum == null) return "#ffffff";
  return lum > 0.5 ? "#000000" : "#ffffff";
}

function ensureContrast(bgHex: string, fgHex: string): string {
  const ratio = contrastRatio(bgHex, fgHex);
  if (ratio != null && ratio >= 4.5) return fgHex;
  return autoContrastText(bgHex);
}

function ensureStyleTag(id: string): HTMLStyleElement {
  let tag = document.getElementById(id) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = id;
    document.head.appendChild(tag);
  }
  return tag;
}

export function applyBranding(branding: BrandingVars | null | undefined) {
  if (!branding) return;
  const root = document.documentElement;

  // Modo claro/escuro derivado da cor de fundo escolhida pelo administrador.
  const bgLum = branding.background_color ? hexLuminance(branding.background_color) : null;
  const themeMode: "light" | "dark" = bgLum != null && bgLum > 0.5 ? "light" : "dark";
  root.setAttribute("data-theme", themeMode);

  if (branding.background_color) {
    const autoFgHsl = hexToHSL(autoContrastText(branding.background_color));
    if (autoFgHsl) {
      root.style.setProperty("--foreground", autoFgHsl);
      root.style.setProperty("--card-foreground", autoFgHsl);
      root.style.setProperty("--popover-foreground", autoFgHsl);
      root.style.setProperty("--sidebar-foreground", autoFgHsl);
    }
    const hsl = hexToHSL(branding.background_color);
    if (hsl) {
      root.style.setProperty("--background", hsl);
      root.style.setProperty("--sidebar-background", hsl);
    }
  }

  if (branding.favicon_url) {
    const head = document.head;
    head
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((el) => el.parentNode?.removeChild(el));
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.href = branding.favicon_url;
    head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = branding.favicon_url;
    head.appendChild(apple);
  }

  const primaryBg = branding.primary_button_bg || branding.primary_color;
  if (primaryBg) {
    const hsl = hexToHSL(primaryBg);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
    }
  }

  const secondaryBg = branding.secondary_button_bg || branding.secondary_color;
  if (secondaryBg) {
    const hsl = hexToHSL(secondaryBg);
    if (hsl) {
      root.style.setProperty("--secondary", hsl);
      root.style.setProperty("--sidebar-accent", hsl);
    }
  }

  if (branding.accent_color) {
    const hsl = hexToHSL(branding.accent_color);
    if (hsl) root.style.setProperty("--accent", hsl);
  }

  const primaryFg = branding.primary_button_text || branding.button_text_color;
  if (primaryFg) {
    const hsl = hexToHSL(primaryFg);
    if (hsl) {
      root.style.setProperty("--primary-foreground", hsl);
      root.style.setProperty("--sidebar-primary-foreground", hsl);
    }
  }

  const secondaryFg = branding.secondary_button_text || branding.button_text_color;
  if (secondaryFg) {
    const hsl = hexToHSL(secondaryFg);
    if (hsl) {
      root.style.setProperty("--secondary-foreground", hsl);
      root.style.setProperty("--sidebar-accent-foreground", hsl);
    }
  }

  // Botões de seleção (chips).
  const selBg = branding.selection_button_bg || branding.secondary_button_bg || "#000000";
  const selFg = ensureContrast(
    selBg,
    branding.selection_button_text || branding.secondary_button_text || autoContrastText(selBg),
  );
  const selActiveBg =
    branding.selection_button_selected_bg || branding.primary_button_bg || branding.primary_color || "#3b82f6";
  const selActiveFg = ensureContrast(
    selActiveBg,
    branding.selection_button_selected_text ||
      branding.primary_button_text ||
      branding.button_text_color ||
      autoContrastText(selActiveBg),
  );
  root.style.setProperty("--selection-btn-bg", selBg);
  root.style.setProperty("--selection-btn-text", selFg);
  root.style.setProperty("--selection-btn-active-bg", selActiveBg);
  root.style.setProperty("--selection-btn-active-text", selActiveFg);

  // Campos de formulário e áreas de texto.
  const { input_bg: inputBg, input_text: inputText, input_border: inputBorder } = branding;
  const { textarea_bg: taBg, textarea_text: taText, textarea_border: taBorder } = branding;

  if (inputBg || inputText || inputBorder || taBg || taText || taBorder) {
    const rules: string[] = [];
    const inputSel = `input:not([type="color"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])`;
    const inputDecls: string[] = [];
    if (inputBg) inputDecls.push(`background-color: ${inputBg} !important;`);
    if (inputText) inputDecls.push(`color: ${inputText} !important;`);
    if (inputBorder) inputDecls.push(`border-color: ${inputBorder} !important;`);
    if (inputDecls.length) {
      rules.push(`${inputSel} { ${inputDecls.join(" ")} }`);
      if (inputText) rules.push(`${inputSel}::placeholder { color: ${inputText} !important; opacity: 0.55; }`);
    }
    const taDecls: string[] = [];
    if (taBg) taDecls.push(`background-color: ${taBg} !important;`);
    if (taText) taDecls.push(`color: ${taText} !important;`);
    if (taBorder) taDecls.push(`border-color: ${taBorder} !important;`);
    if (taDecls.length) {
      rules.push(`textarea { ${taDecls.join(" ")} }`);
      if (taText) rules.push(`textarea::placeholder { color: ${taText} !important; opacity: 0.55; }`);
    }
    ensureStyleTag("dynamic-field-branding").textContent = rules.join("\n");
  }

  // Cores de hover dos botões primários e secundários.
  const hoverRules: string[] = [];
  if (branding.primary_button_hover_bg || branding.primary_button_hover_text) {
    const decls: string[] = [];
    if (branding.primary_button_hover_bg) decls.push(`background-color: ${branding.primary_button_hover_bg} !important;`);
    if (branding.primary_button_hover_text) decls.push(`color: ${branding.primary_button_hover_text} !important;`);
    hoverRules.push(
      `button.bg-primary:hover, a.bg-primary:hover, [role="button"].bg-primary:hover, button[class*="hover:bg-primary"]:hover, a[class*="hover:bg-primary"]:hover, [role="button"][class*="hover:bg-primary"]:hover { ${decls.join(" ")} }`,
    );
  }
  if (branding.secondary_button_hover_bg || branding.secondary_button_hover_text) {
    const decls: string[] = [];
    if (branding.secondary_button_hover_bg) decls.push(`background-color: ${branding.secondary_button_hover_bg} !important;`);
    if (branding.secondary_button_hover_text) decls.push(`color: ${branding.secondary_button_hover_text} !important;`);
    hoverRules.push(
      `button.bg-secondary:hover, a.bg-secondary:hover, [role="button"].bg-secondary:hover, button[class*="hover:bg-secondary"]:hover, a[class*="hover:bg-secondary"]:hover, [role="button"][class*="hover:bg-secondary"]:hover { ${decls.join(" ")} }`,
    );
  }
  ensureStyleTag("dynamic-button-hover-branding").textContent = hoverRules.join("\n");
}
