import { supabase } from "@/integrations/supabase/client";

export interface PdfCompany {
  razaoSocial: string;
  cnpj: string;
  address: string;
}

export interface PdfBranding {
  platformName: string;
  logoDataUrl: string | null;
  logoFormat: "PNG" | "JPEG" | null;
  logoWidth: number;
  logoHeight: number;
  company: PdfCompany;
}

const DEFAULT_NAME = "Revisão Fácil";

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
  let logoUrl = "";
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle();
    const branding = (data?.value ?? {}) as { platform_name?: string; logo_url?: string };
    if (branding.platform_name) platformName = branding.platform_name;
    if (branding.logo_url) logoUrl = branding.logo_url;
  } catch (e) {
    console.warn("[pdfBranding] failed to load branding", e);
  }

  if (!logoUrl) {
    return { platformName, logoDataUrl: null, logoFormat: null, logoWidth: 0, logoHeight: 0 };
  }
  const loaded = await urlToDataUrl(logoUrl);
  if (!loaded) {
    return { platformName, logoDataUrl: null, logoFormat: null, logoWidth: 0, logoHeight: 0 };
  }
  const { width, height } = await computeSize(loaded.dataUrl);
  return {
    platformName,
    logoDataUrl: loaded.dataUrl,
    logoFormat: loaded.format,
    logoWidth: width,
    logoHeight: height,
  };
}
