import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detecta o retorno do link de confirmação de e-mail (Supabase coloca
 * `type=signup` no hash da URL após validar o token). Quando detectado:
 *  - exibe uma mensagem de sucesso clara para o usuário;
 *  - dispara o e-mail de boas-vindas (com idempotência server-side);
 *  - limpa o hash da URL.
 *
 * Mantemos também o disparo redundante em AuthContext; o servidor faz dedupe.
 */
const STORAGE_KEY = "rf:email-confirmed-pending";

const EmailConfirmationHandler = () => {
  const { user, allRoles } = useAuth();
  const shownRef = useRef(false);

  // 1) Detect Supabase signup confirmation in URL hash on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (!hash.includes("type=signup")) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {}
    // Remove o hash sem recarregar a página.
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", cleanUrl);
  }, []);

  // 2) Quando a sessão estiver carregada após a confirmação, mostra o toast
  //    e envia o e-mail de boas-vindas.
  useEffect(() => {
    if (shownRef.current) return;
    if (!user?.email) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {}
    if (!pending) return;
    shownRef.current = true;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    toast.success(
      "E-mail confirmado com sucesso! Sua conta foi ativada — bem-vindo(a) à Revisão Fácil.",
      { duration: 6000 }
    );

    (async () => {
      try {
        const isTeacher = allRoles.includes("teacher");
        const templateName = isTeacher ? "welcome-teacher" : "welcome-student";
        const { data: prof } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle();
        await supabase.functions.invoke("send-app-email", {
          body: {
            templateName,
            recipientEmail: user.email,
            idempotencyKey: `${templateName}-${user.id}`,
            templateData: { name: (prof?.name || "").trim() },
          },
        });
      } catch (_e) {
        // Silencioso — dedupe server-side garante consistência.
      }
    })();
  }, [user, allRoles]);

  return null;
};

export default EmailConfirmationHandler;