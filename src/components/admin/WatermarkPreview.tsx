import React from "react";

/**
 * Configuração visual da marca d'água renderizada na prévia de aprovação.
 * Mantida como constantes para que possa ser auditada por testes e
 * permanecer sincronizada com o compositor de vídeo (`drawWatermark`).
 */
export const WATERMARK_GEOMETRY = {
  /** Padding em relação ao container 16:9 (cqh ≈ menor lado em 16:9). */
  paddingCqh: 2,
  /** Altura da faixa da marca d'água em % da altura do container. */
  heightCqh: 6,
  /** Tamanho da fonte do texto em % da altura do container. */
  fontSizeCqh: 2.7,
  /** Espaçamento entre logo e texto em cqw. */
  gapCqw: 1.2,
} as const;

export interface WatermarkPreviewConfig {
  enabled: boolean;
  text: string;
  logoUrl: string;
}

/**
 * Overlay da marca d'água renderizado sobre uma "tela" de proporção fixa (16:9)
 * usando unidades relativas ao container (cqw/cqh). Isso garante que posição
 * e tamanho sejam idênticos independentemente da resolução da imagem original.
 */
export const WatermarkOverlay = ({ text, logoUrl }: { text: string; logoUrl: string }) => {
  if (!text && !logoUrl) return null;
  const g = WATERMARK_GEOMETRY;
  return (
    <div
      data-testid="watermark-overlay"
      className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 via-transparent to-transparent"
      style={{ containerType: "size" } as React.CSSProperties}
    >
      <div
        data-testid="watermark-inner"
        className="flex items-center"
        style={{
          paddingRight: `${g.paddingCqh}cqh`,
          paddingBottom: `${g.paddingCqh}cqh`,
          height: `${g.heightCqh}cqh`,
          gap: `${g.gapCqw}cqw`,
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo da plataforma"
            data-testid="watermark-logo"
            className="h-full w-auto opacity-90 drop-shadow object-contain"
            onError={(e) => {
              (e.currentTarget.style.display = "none");
            }}
          />
        )}
        {text && (
          <span
            data-testid="watermark-text"
            className="font-semibold text-white whitespace-nowrap leading-none [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]"
            style={{ fontSize: `${g.fontSizeCqh}cqh` }}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Wrapper de capa com overlay padronizado. A imagem é exibida em um quadro
 * 16:9 fixo com object-cover, o que garante que o overlay (também 16:9) ocupe
 * exatamente a mesma região visual em ambas as capas — mesmo se a imagem
 * original for vertical, quadrada ou ultrawide.
 */
export const CoverWithWatermark = ({
  src,
  alt,
  watermark,
  testId,
}: {
  src: string;
  alt: string;
  watermark: WatermarkPreviewConfig;
  testId?: string;
}) => {
  const showWatermark = watermark.enabled && (!!watermark.text || !!watermark.logoUrl);
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      data-testid={testId ?? "cover-with-watermark"}
      className="relative block rounded-md overflow-hidden border border-border bg-muted hover:opacity-90 aspect-video w-full"
    >
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {showWatermark && <WatermarkOverlay text={watermark.text} logoUrl={watermark.logoUrl} />}
    </a>
  );
};