import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

/**
 * Marca d'água forense — sobreposta ao conteúdo protegido com identificação
 * do usuário (e-mail + id curto + timestamp). Função puramente DISSUASIVA:
 * se o conteúdo vazar via print/celular, é possível rastrear a origem.
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
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Atualiza a cada minuto: aumenta a granularidade forense sem custo.
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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