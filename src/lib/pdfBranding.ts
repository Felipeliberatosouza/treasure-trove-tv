import { supabase } from "@/integrations/supabase/client";

export interface PdfCompany {
  razaoSocial: string;
  cnpj: string;
  address: string;
}

export interface PdfBranding {
  platformName: string;
  /** Domínio comercial configurado pelo administrador. */
  commercialDomain: string;
  logoDataUrl: string | null;
  logoFormat: "PNG" | "JPEG" | null;
  logoWidth: number;
  logoHeight: number;
  company: PdfCompany;
  primaryRgb: [number, number, number];
}

const DEFAULT_NAME = "Revisão Fácil";
const DEFAULT_DOMAIN = "revisaofacil.com";
const DEFAULT_PRIMARY: [number, number, number] = [0, 80, 180];

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

async function urlToDataUrl(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const isPng = (blob.type || "").includes("png") || /\.png(\?|$)/i.test(url);
    const format: "PNG" | "JPEG" = isPng ? "PNG" : "JPEG";
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch (e) {
    console.warn("[pdfBranding] failed to load logo", e);
    return null;
  }
}

function computeSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

export async function getPdfBranding(): Promise<PdfBranding> {
  let platformName = DEFAULT_NAME;
  let commercialDomain = DEFAULT_DOMAIN;
  let logoUrl = "";
  let primaryRgb: [number, number, number] = DEFAULT_PRIMARY;
  const company: PdfCompany = { razaoSocial: "", cnpj: "", address: "" };
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", ["branding", "contact"]);
    for (const row of data ?? []) {
      const value = (row.value ?? {}) as Record<string, string>;
      if (row.key === "branding") {
        if (value.platform_name) platformName = value.platform_name;
        if (value.commercial_domain) commercialDomain = value.commercial_domain;
        // Respeita o seletor de logomarca padrão (Configurações → Identidade
        // Visual → Gestão de Logomarca). Cai para `logo_url` legado quando a
        // variante selecionada não estiver definida.
        const v = value as Record<string, string | undefined>;
        const variant = v.default_logo_variant === "light_bg"
          ? v.logo_url_light_bg
          : v.logo_url_dark_bg;
        const chosen = variant || v.logo_url;
        if (chosen) logoUrl = chosen;
        const rgb = hexToRgb(value.primary_color || "");
        if (rgb) primaryRgb = rgb;
      } else if (row.key === "contact") {
        company.razaoSocial = value.razao_social || value.nome_fantasia || "";
        company.cnpj = formatCnpj(value.cnpj || "");
        company.address = value.platform_address || value.address || "";
      }
    }
  } catch (e) {
    console.warn("[pdfBranding] failed to load branding", e);
  }

  if (!logoUrl) {
    return { platformName, commercialDomain, logoDataUrl: null, logoFormat: null, logoWidth: 0, logoHeight: 0, company, primaryRgb };
  }
  const loaded = await urlToDataUrl(logoUrl);
  if (!loaded) {
    return { platformName, commercialDomain, logoDataUrl: null, logoFormat: null, logoWidth: 0, logoHeight: 0, company, primaryRgb };
  }
  const { width, height } = await computeSize(loaded.dataUrl);
  return {
    platformName,
    commercialDomain,
    logoDataUrl: loaded.dataUrl,
    logoFormat: loaded.format,
    logoWidth: width,
    logoHeight: height,
    company,
    primaryRgb,
  };
}

/** Builds the legal footer lines (CNPJ/Razão Social/Endereço) for PDFs. */
export function buildCompanyFooterLines(company: PdfCompany): string[] {
  const parts: string[] = [];
  if (company.razaoSocial && company.cnpj) {
    parts.push(`${company.razaoSocial} — CNPJ ${company.cnpj}`);
  } else if (company.razaoSocial) {
    parts.push(company.razaoSocial);
  } else if (company.cnpj) {
    parts.push(`CNPJ ${company.cnpj}`);
  }
  if (company.address) parts.push(company.address);
  return parts;
}
