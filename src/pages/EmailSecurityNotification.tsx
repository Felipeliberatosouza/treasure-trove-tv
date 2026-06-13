import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import type { BrandingSettings } from "@/hooks/usePlatformSettings";

const EmailSecurityNotification = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const { settings, loading: settingsLoading } = useAllPlatformSettings();

  const branding = settings.branding as BrandingSettings | undefined;
  const logoUrl = branding?.logo_url;
  const platformName = branding?.platform_name || "Revisão Fácil";

  useEffect(() => {
    const report = async () => {
      const email = searchParams.get("email") || "";
      const templateKey = searchParams.get("template") || "";
      const subject = searchParams.get("subject") || "";

      if (!email && !templateKey) {
        setStatus("error");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "report-security-notification",
        {
          body: {
            email,
            template_key: templateKey,
            subject,
            user_agent: navigator.userAgent,
          },
        },
      );

      const ok = !error && (data as { ok?: boolean } | null)?.ok === true;
      setStatus(ok ? "success" : "error");
    };

    report();
  }, [searchParams]);

  if (settingsLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        {logoUrl ? (
          <img src={logoUrl} alt={platformName} className="h-16 mx-auto object-contain" />
        ) : (
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {platformName}
          </h1>
        )}

        {status === "success" ? (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-semibold text-foreground">
              Notificação de Segurança Registrada
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos verificando os motivos de você ter recebido este e-mail sem solicitar.
              Pedimos que considere trocar sua senha de acesso na plataforma{" "}
              <a href="https://revisaofacil.com.br" className="text-primary font-medium hover:underline">
                {platformName}
              </a>
              , por motivos de segurança.
            </p>
            <a
              href="https://revisaofacil.com.br/reset-password"
              className="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Trocar minha senha
            </a>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-semibold text-foreground">
              Erro ao registrar notificação
            </h2>
            <p className="text-sm text-muted-foreground">
              Não foi possível processar sua solicitação. Por favor, entre em contato conosco.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSecurityNotification;
