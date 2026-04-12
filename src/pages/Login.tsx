import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/translateAuthError";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deactivatedMsg, setDeactivatedMsg] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setDeactivatedMsg(false);
    setBlockedMsg(false);

    // Check if login is blocked (brute-force protection)
    try {
      const { data: blocked } = await supabase.rpc("is_login_blocked", {
        check_email: email.toLowerCase(),
      });
      if (blocked) {
        setBlockedMsg(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      // If function doesn't exist yet, skip check
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    // Record login attempt
    try {
      await supabase.from("login_attempts").insert([{
        email: email.toLowerCase(),
        success: !error,
      }] as any);

      // Notify admins on suspicious activity (5+ failed attempts = blocked)
      if (error) {
        const { count } = await supabase
          .from("login_attempts" as any)
          .select("*", { count: "exact", head: true })
          .eq("email", email.toLowerCase())
          .eq("success", false)
          .gte("attempted_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

        if (count && count >= 5) {
          supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "suspicious-login-admin-notify",
              recipientEmail: "admin",
              idempotencyKey: `suspicious-login-${email.toLowerCase()}-${new Date().toISOString().slice(0, 13)}`,
              templateData: {
                suspectEmail: email.toLowerCase(),
                failedCount: count,
                isBlocked: true,
              },
            },
          }).catch(() => {});
        }
      }
    } catch {
      // Non-critical
    }

    if (error) {
      toast.error(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    // Check if user is active
    if (signInData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active")
        .eq("user_id", signInData.user.id)
        .single();

      if (profile && profile.active === false) {
        await supabase.auth.signOut();
        setDeactivatedMsg(true);
        setLoading(false);
        return;
      }

      // Log successful login to audit
      try {
        await supabase.from("audit_logs").insert([{
          user_id: signInData.user.id,
          action: "login",
          metadata: { method: "password" },
        }] as any);
      } catch {
        // Non-critical
      }
    }

    toast.success("Login realizado com sucesso!");
    navigate("/");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-gradient">Revisão Fácil</h1>
          <p className="text-sm text-muted-foreground">Entre para continuar aprendendo</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full font-display font-semibold gap-2"
          onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.origin,
            });
            if (result.error) {
              toast.error("Erro ao entrar com Google");
            }
          }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        {blockedMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive space-y-1">
            <p className="font-semibold">Login bloqueado temporariamente</p>
            <p>Muitas tentativas de login falharam. Aguarde 15 minutos antes de tentar novamente, ou use a opção "Esqueci minha senha" para redefinir sua senha.</p>
          </div>
        )}

        {deactivatedMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive space-y-1">
            <p className="font-semibold">Conta desativada</p>
            <p>Sua conta foi desativada pelo administrador. Para mais informações ou reativação, entre em contato com o suporte pelo e-mail ou WhatsApp disponíveis na página de contato.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
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
          <Button className="w-full font-display font-semibold" size="lg" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        </form>

        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <p>
            Não tem uma conta?
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/signup/student">
              <Button variant="secondary" size="sm" className="font-display">
                Cadastrar como Aluno
              </Button>
            </Link>
            <Link to="/signup/teacher">
              <Button variant="secondary" size="sm" className="font-display">
                Cadastrar como Professor
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
