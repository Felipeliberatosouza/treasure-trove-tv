import { usePlatformSettings, resolveLogoForBackground } from "@/hooks/usePlatformSettings";
import logoRevisaoFacil from "@/assets/logo-revisao-facil.png";

/** Domínio comercial padrão, usado quando o administrador ainda não configurou um. */
export const DEFAULT_COMMERCIAL_DOMAIN = "revisaofacil.com";

/** Domínio comercial configurado em Configurações → Identidade Visual. */
export function useCommercialDomain(): string {
  const { data } = usePlatformSettings("branding");
  return (data?.commercial_domain || "").trim() || DEFAULT_COMMERCIAL_DOMAIN;
}

/** Logomarca configurada (com fallback para a logo embarcada). */
export function useBrandLogo(): string {
  const { data } = usePlatformSettings("branding");
  return resolveLogoForBackground(data as any) || logoRevisaoFacil;
}

interface StampProps {
  /** Sobreposto a mídia (usa cores claras) ou em conteúdo comum. */
  overlay?: boolean;
  className?: string;
}

/** Logomarca para o canto superior direito de vídeos e slides. */
export const BrandLogoCorner = ({ className = "" }: { className?: string }) => {
  const logo = useBrandLogo();
  return (
    <div className={`pointer-events-none absolute right-2 top-2 z-20 sm:right-3 sm:top-3 ${className}`}>
      <img src={logo} alt="Logomarca" className="h-5 w-auto opacity-90 drop-shadow sm:h-7" />
    </div>
  );
};

/** Domínio comercial para o canto inferior direito de vídeos e slides. */
export const BrandDomainCorner = ({ overlay = false, className = "" }: StampProps) => {
  const domain = useCommercialDomain();
  return (
    <span
      className={`pointer-events-none absolute bottom-2 right-2 z-20 select-none text-[9px] sm:bottom-3 sm:right-3 sm:text-[11px] ${
        overlay ? "text-white/80 drop-shadow" : "text-muted-foreground"
      } ${className}`}
    >
      {domain}
    </span>
  );
};

/** Logomarca com o domínio comercial logo abaixo — usada nos demais conteúdos gerados. */
export const BrandStamp = ({ className = "" }: { className?: string }) => {
  const logo = useBrandLogo();
  const domain = useCommercialDomain();
  return (
    <div className={`flex flex-col items-end gap-0.5 ${className}`}>
      <img src={logo} alt="Logomarca" className="h-6 w-auto opacity-90 sm:h-8" />
      <span className="text-[10px] text-muted-foreground sm:text-xs">{domain}</span>
    </div>
  );
};

export default BrandStamp;
