import { useLocation } from "react-router-dom";
import { useContentProtection } from "@/hooks/useContentProtection";

/**
 * Ativa a proteção de conteúdo (anti-cópia, anti-print, anti-devtools,
 * marca d'água forense via CSS) globalmente em todo o projeto, em
 * qualquer dispositivo (mobile, tablet, notebook, desktop).
 *
 * O hook `useContentProtection` já preserva a usabilidade de inputs,
 * textareas e campos editáveis (login, cadastro, checkout, formulários),
 * bloqueando apenas a cópia/seleção/print do conteúdo da página.
 */
const GlobalContentProtection = () => {
  const location = useLocation();
  useContentProtection({ context: `route:${location.pathname}` });
  return null;
};

export default GlobalContentProtection;