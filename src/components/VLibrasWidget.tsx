import { useEffect, useState } from "react";
import { Hand, X } from "lucide-react";

interface VLibrasWidgetProps {
  /** When false, the widget never renders. Controlled by the admin in
   *  Configurações de Produtos → "Linguagem de Sinais — Libras". */
  enabled?: boolean;
}

/**
 * Acessibilidade em Libras (VLibras) — opt-in.
 *
 * - Só aparece quando o admin ativa em "Linguagem de Sinais — Libras".
 * - Inicia como um botão flutuante discreto. O usuário precisa clicar para
 *   ativar o avatar (aí o script oficial do VLibras é carregado).
 * - Uma vez ativo, o usuário pode fechá-lo (botão X), o que remove o avatar
 *   da tela e volta para o botão flutuante de ativação.
 */
const VLibrasWidget = ({ enabled = true }: VLibrasWidgetProps) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || !active) return;

    const container = document.createElement("div");
    container.setAttribute("vw", "");
    container.className = "enabled";
    container.innerHTML = `
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper>
        <div class="vw-plugin-top-wrapper"></div>
      </div>
    `;
    document.body.appendChild(container);

    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = () => {
      if ((window as any).VLibras) {
        new (window as any).VLibras.Widget("https://vlibras.gov.br/app");
      }
    };
    document.body.appendChild(script);

    return () => {
      container.remove();
      script.remove();
      document.querySelectorAll("[vw]").forEach((el) => el.remove());
    };
  }, [enabled, active]);

  if (!enabled) return null;

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        aria-label="Ativar tradução em Libras (Linguagem Brasileira de Sinais)"
        title="Ativar Libras"
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background hover:scale-105 transition-transform focus:outline-none focus:ring-4 focus:ring-primary/40"
      >
        <Hand className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(false)}
      aria-label="Fechar tradução em Libras"
      title="Fechar Libras"
      className="fixed bottom-24 right-4 z-[2147483647] flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground shadow-md ring-2 ring-border hover:bg-secondary focus:outline-none focus:ring-4 focus:ring-primary/40"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
};

export default VLibrasWidget;
