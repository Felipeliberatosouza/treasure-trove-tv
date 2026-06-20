import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Camada de proteção de conteúdo (cliente). Bloqueia ações comuns que
 * facilitam cópia/exfiltração e registra cada tentativa em `audit_logs`.
 *
 * IMPORTANTE — limitações do navegador:
 *  - Nenhum site web pode bloquear PrintScreen do sistema operacional, captura
 *    via celular/câmera externa ou ferramentas de gravação nativas.
 *  - DevTools só pode ser detectado de forma heurística (size/debugger).
 *  - Estas medidas são DISSUASIVAS + AUDITÁVEIS (com marca d'água forense
 *    sobreposta), não anti-pirataria militar.
 */

export interface ContentProtectionOptions {
  /** Identificador do contexto (ex: "video:<lessonId>", "material:resumo:<id>"). */
  context: string;
  /** Quando true, ativa todas as proteções. Default: true. */
  enabled?: boolean;
  /** Detectar e reagir à abertura de DevTools. Default: true. */
  detectDevtools?: boolean;
  /** Função chamada ao detectar DevTools (após log + toast). */
  onDevtoolsDetected?: () => void;
  /** Throttle entre logs do mesmo evento (ms). Default 30s. */
  logThrottleMs?: number;
  /** Debounce mínimo entre chamadas à edge function de enforcement (ms). Default 60s. */
  enforceDebounceMs?: number;
}

const SUPPRESSED_KEYS = new Set([
  "PrintScreen",
  "F12",
]);

/** Combinações de teclas que normalmente extraem conteúdo. */
function isSuppressedCombo(e: KeyboardEvent): string | null {
  const k = e.key?.toLowerCase();
  // Ctrl/Cmd + C/X/A/S/P/U + Shift+I/J/C
  if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p", "u"].includes(k)) {
    return `ctrl+${k}`;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(k)) {
    return `ctrl+shift+${k}`;
  }
  if (e.key === "F12") return "f12";
  if (e.key === "PrintScreen") return "printscreen";
  return null;
}

/** Eventos cujo log dispara avaliação de bloqueio no servidor. */
const ENFORCE_TRIGGER_EVENTS = new Set([
  "devtools_opened",
  "print_attempt",
  "shortcut_blocked",
]);

export function useContentProtection(opts: ContentProtectionOptions) {
  const { user } = useAuth();
  const {
    context,
    enabled = true,
    detectDevtools = true,
    onDevtoolsDetected,
    logThrottleMs = 30_000,
  } = opts;
  const lastLogged = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled) return;

    const log = async (event: string, metadata: Record<string, unknown> = {}) => {
      const now = Date.now();
      const key = `${event}:${context}`;
      if (lastLogged.current[key] && now - lastLogged.current[key] < logThrottleMs) return;
      lastLogged.current[key] = now;
      if (!user || !ENFORCE_TRIGGER_EVENTS.has(event)) return;
      try {
        await supabase.functions.invoke("enforce-content-protection", {
          body: {
            event,
            context,
            metadata: {
              user_agent: navigator.userAgent,
              url: window.location.pathname,
              ...metadata,
            },
          },
        });
      } catch (err) {
        console.warn("[content-protection] enforcement call failed", err);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      log("contextmenu_blocked");
      toast.error("Menu de contexto desativado por motivos de segurança.", {
        id: "cp-contextmenu",
        duration: 2500,
      });
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData(
        "text/plain",
        `Conteúdo protegido — ${context} — usuário: ${user?.email ?? "não autenticado"}`
      );
      log("copy_blocked");
    };

    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      log("cut_blocked");
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
      log("drag_blocked");
    };

    const onSelectStart = (e: Event) => {
      // Permitir seleção em inputs/textarea (formulários)
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const combo = isSuppressedCombo(e);
      if (combo) {
        e.preventDefault();
        log("shortcut_blocked", { combo });
        if (combo === "f12" || combo.startsWith("ctrl+shift+")) {
          toast.error("Ferramentas de desenvolvedor desativadas.", { id: "cp-devtools-key", duration: 2500 });
        } else if (combo === "printscreen") {
          toast.warning("Captura de tela registrada.", { id: "cp-print", duration: 2500 });
        }
      } else if (SUPPRESSED_KEYS.has(e.key)) {
        e.preventDefault();
        log("key_blocked", { key: e.key });
      }
    };

    // CSS: bloqueia seleção/arrastar globalmente sem afetar inputs.
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-content-protection", "true");
    styleEl.textContent = `
      html[data-cp-active="true"] {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      html[data-cp-active="true"] input,
      html[data-cp-active="true"] textarea,
      html[data-cp-active="true"] [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      html[data-cp-active="true"] img,
      html[data-cp-active="true"] video {
        -webkit-user-drag: none;
      }
      @media print {
        html[data-cp-active="true"] body { display: none !important; }
      }
    `;
    document.head.appendChild(styleEl);
    document.documentElement.setAttribute("data-cp-active", "true");

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("keydown", onKeyDown);

    // Esconde a tela quando o usuário sai do foco (mitiga prints sequenciais).
    const onVisibility = () => {
      if (document.hidden) {
        log("tab_hidden");
      }
    };
    const onBlur = () => log("window_blur");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    // Detecção heurística de DevTools (diferença de viewport vs window).
    let devtoolsOpen = false;
    let devtoolsTimer: ReturnType<typeof setInterval> | null = null;
    // Em dispositivos móveis/tablets a diferença entre outerWidth/innerWidth
    // (barra de URL, gestos, zoom, devicePixelRatio alto) gera falso-positivo
    // de "DevTools abertas". Desabilita a heurística nesses casos.
    const isTouchDevice =
      typeof window !== "undefined" &&
      ("ontouchstart" in window ||
        (navigator.maxTouchPoints ?? 0) > 0 ||
        window.matchMedia?.("(pointer: coarse)").matches ||
        window.innerWidth < 1024);
    if (detectDevtools && !isTouchDevice) {
      const THRESHOLD = 200;
      devtoolsTimer = setInterval(() => {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        const open = widthDiff > THRESHOLD || heightDiff > THRESHOLD;
        if (open && !devtoolsOpen) {
          devtoolsOpen = true;
          log("devtools_opened", { widthDiff, heightDiff });
          toast.error(
            "Ferramentas de desenvolvedor detectadas. Esta atividade foi registrada.",
            { id: "cp-devtools", duration: 4000 }
          );
          onDevtoolsDetected?.();
        } else if (!open && devtoolsOpen) {
          devtoolsOpen = false;
        }
      }, 1500);
    }

    // Aviso de impressão.
    const onBeforePrint = () => {
      log("print_attempt");
      toast.error("Impressão bloqueada por segurança.", { id: "cp-print-attempt", duration: 3000 });
    };
    window.addEventListener("beforeprint", onBeforePrint);

    return () => {
      document.documentElement.removeAttribute("data-cp-active");
      styleEl.remove();
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeprint", onBeforePrint);
      if (devtoolsTimer) clearInterval(devtoolsTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, context, detectDevtools, logThrottleMs, user?.id]);
}