/**
 * Marca d'água — sobreposta ao conteúdo protegido. Função DISSUASIVA.
 *
 * Renderizada em grade repetida com baixa opacidade. Não-interativa
 * (`pointer-events-none`) e marcada com `select-none`.
 */
interface Props {
  /** Variante visual: por cima de vídeo (claro) ou de texto (escuro). */
  variant?: "video" | "document";
  /** Densidade da grade. Default 3 colunas x 4 linhas. */
  cols?: number;
  rows?: number;
}

const ForensicWatermark = ({ variant = "video", cols = 3, rows = 4 }: Props) => {
  const label = "Revisão Fácil. Todos os direitos reservados. revisaofacil.com";

  const cells = Array.from({ length: cols * rows }, (_, i) => i);
  const colorClass = variant === "video" ? "text-white/15" : "text-foreground/10";

  return (
    <div
      aria-hidden="true"
      data-testid="forensic-watermark"
      className="pointer-events-none absolute inset-0 z-30 select-none overflow-hidden"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {cells.map((i) => (
        <div key={i} className="flex items-center justify-center">
          <span
            className={`whitespace-nowrap text-[10px] sm:text-xs font-mono tracking-tight ${colorClass}`}
            style={{ transform: "rotate(-30deg)" }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ForensicWatermark;
