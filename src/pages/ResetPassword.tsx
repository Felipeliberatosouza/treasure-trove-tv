import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import PasswordStrengthChecker, { validatePassword } from "@/components/PasswordStrengthChecker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/translateAuthError";
import { Link } from "react-router-dom";
import { useAllPlatformSettings, type BrandingSettings } from "@/hooks/usePlatformSettings";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { settings } = useAllPlatformSettings();
  const branding = settings?.branding as BrandingSettings | undefined;
  const showLogoImage = !!branding?.logo_url && !branding?.use_text_logo;
  const platformName = branding?.platform_name || "Revisão Fácil";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from the auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setSessionReady(!!session);
      }
    });

    // Also check URL hash for recovery type
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    // Detect link errors in the URL hash (expired/invalid recovery link)
    if (hash.includes("error") && (hash.includes("expired") || hash.includes("invalid"))) {
      setLinkExpired(true);
    }

    // Confirm a valid recovery session exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim() || !confirmPassword.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
      toast.error(pwdError);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);

    // Make sure we still have a valid recovery session before calling updateUser.
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      setLoading(false);
      setLinkExpired(true);
      toast.error(
        "Seu link de recuperação expirou. Solicite um novo e-mail de recuperação.",
      );
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const msg = error.message || "";
      const isSessionMissing = /session|jwt|token/i.test(msg) && /missing|expired|invalid|not found/i.test(msg);
      if (isSessionMissing) {
        setLinkExpired(true);
        toast.error(
          "Seu link de recuperação expirou. Solicite um novo e-mail de recuperação.",
        );
      } else {
        toast.error(translateAuthError(msg));
      }
    } else {
      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/login"), 3000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center space-y-4"
        >
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
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="font-display text-2xl font-bold">Senha Redefinida!</h1>
          <p className="text-sm text-muted-foreground">
            Você será redirecionado para o login em instantes...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
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
          <h1 className="font-display text-2xl font-bold">Redefinir Senha</h1>
          <p className="text-sm text-muted-foreground">
            Digite sua nova senha abaixo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Nova senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 bg-secondary border-border"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrengthChecker password={password} />
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Button className="w-full font-display font-semibold" size="lg" disabled={loading}>
            {loading ? "Redefinindo..." : "Redefinir Senha"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
