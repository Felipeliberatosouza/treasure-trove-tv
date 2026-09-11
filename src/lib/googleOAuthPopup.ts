import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

type OAuthResult = {
  error: Error | null;
  redirected?: boolean;
  tokens?: { access_token: string; refresh_token: string };
};

const BROKER_URL = "/~oauth/initiate";
const SUPPORTED_ORIGINS = ["https://oauth.lovable.app", "https://lovable.dev"];
const MESSAGE_TYPE = "authorization_response";

function generateState(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Entra/cadastra com Google em um POPUP, sem sair da tela atual.
 *
 * No preview do editor (iframe), delega para o helper oficial, que já
 * abre popup. Fora do iframe (site publicado), abre o fluxo OAuth do
 * broker em uma janela popup e recebe os tokens via postMessage
 * (response_mode=web_message), depois grava a sessão no cliente Supabase.
 *
 * Se o navegador bloquear o popup, faz fallback para o redirecionamento
 * de página inteira (comportamento anterior).
 */
export async function signInWithGooglePopup(redirectPath: string = "/"): Promise<OAuthResult> {
  if (isInIframe()) {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectPath}`,
    });
    return result as OAuthResult;
  }

  const state = generateState();
  const redirectUri = `${window.location.origin}${redirectPath}`;
  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: redirectUri,
    state,
    response_mode: "web_message",
  });
  const url = `${BROKER_URL}?${params.toString()}`;

  const width = Math.min(500, window.outerWidth * 0.9);
  const height = Math.min(640, window.outerHeight * 0.9);
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    url,
    "revisaofacil-google-oauth",
    `width=${width},height=${height},left=${left},top=${top}`,
  );

  if (!popup) {
    // Popup bloqueado — cai para o fluxo de redirecionamento completo.
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
    });
    return result as OAuthResult;
  }

  const response = await new Promise<any>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (!SUPPORTED_ORIGINS.includes(e.origin)) return;
      const data = e.data;
      if (!data || typeof data !== "object" || data.type !== MESSAGE_TYPE) return;
      window.removeEventListener("message", onMessage);
      clearInterval(closedTimer);
      resolve(data.response);
    };
    window.addEventListener("message", onMessage);
    const closedTimer = window.setInterval(() => {
      if (popup.closed) {
        clearInterval(closedTimer);
        window.removeEventListener("message", onMessage);
        resolve(null);
      }
    }, 500);
  });

  try {
    popup.close();
  } catch {
    // ignore
  }

  if (!response) {
    return { error: new Error("popup_closed") };
  }
  if (response.state !== state) {
    return { error: new Error("State is invalid") };
  }
  if (response.error) {
    return { error: new Error(response.error_description ?? "Sign in failed") };
  }
  if (!response.access_token || !response.refresh_token) {
    return { error: new Error("No tokens received") };
  }

  try {
    await supabase.auth.setSession({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    });
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }

  return {
    error: null,
    tokens: {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    },
  };
}
