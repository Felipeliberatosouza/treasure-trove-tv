import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/translateAuthError";
import { useAllPlatformSettings, type BrandingSettings } from "@/hooks/usePlatformSettings";

const ForgotPassword = () => {
  const { settings } = useAllPlatformSettings();
  const branding = settings?.branding as BrandingSettings | undefined;
  const showLogoImage = !!branding?.logo_url && !branding?.use_text_logo;
  const platformName = branding?.platform_name || "Revisão Fácil";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);

  useEffect(() => {
    if (!sent) return;
    if (timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((p) => (p <= 1 ? 0 : p - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [sent, timeLeft]);

  const sendRecoveryEmail = async () => {
    if (!email.trim()) {
      toast.error("Informe seu e-mail");
      return;
    }

    setLoading(true);
    const { error } = await supabase.functions.invoke("send-password-recovery", {
      body: {
        email: email.trim().toLowerCase(),
        redirect_to: `${window.location.origin}/reset-password`,
      },
    });

    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      setSent(true);
      setTimeLeft(30 * 60);
      toast.success("E-mail de recuperação enviado!");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendRecoveryEmail();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>

        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            {showLogoImage ? (
              <div className="flex justify-center">
                <img
                  src={branding!.logo_url}
                  alt={platformName}
                  className="h-16 max-w-[280px] object-contain"
                />
              </div>
            ) : (
              <h1 className="font-display text-3xl font-bold text-gradient">{platformName}</h1>
            )}
          </Link>
          <h1 className="font-display text-2xl font-bold">Recuperar Senha</h1>
          <p className="text-sm text-muted-foreground">
            Informe seu e-mail para receber o link de redefinição
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-primary/40 bg-black p-6 text-center space-y-3 shadow-lg">
            <p className="text-sm font-medium text-white">
              Enviamos um link de redefinição para <strong>{email}</strong>
            </p>
            <p className="text-xs font-medium text-white">
              Verifique sua caixa de entrada e spam.
            </p>
            <p className="text-xs font-semibold text-amber-400">
              {timeLeft > 0
                ? `O link expira em: ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
                : "O link expirou. Envie novamente."}
            </p>
            <Button
              variant="outline"
              onClick={sendRecoveryEmail}
              disabled={loading}
              className="mt-2 border-white bg-black text-white hover:bg-white hover:text-black"
            >
              {loading ? "Enviando..." : "Enviar novamente"}
            </Button>
            <div>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setTimeLeft(30 * 60);
                }}
                className="text-xs font-medium text-white underline underline-offset-4 hover:text-primary"
              >
                Alterar e-mail
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>
            <Button className="w-full font-display font-semibold" size="lg" disabled={loading}>
              {loading ? "Enviando..." : "Enviar Link de Recuperação"}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
