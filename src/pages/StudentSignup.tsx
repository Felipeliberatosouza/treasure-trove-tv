import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, GraduationCap, ArrowLeft, CalendarDays, Camera, CreditCard } from "lucide-react";
import PhoneVerification from "@/components/PhoneVerification";
import { isValidBrazilianPhone } from "@/components/PhoneInput";
import CpfInput from "@/components/CpfInput";
import { isValidCPF } from "@/lib/cpfValidator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import AreaSelector from "@/components/AreaSelector";
import { translateAuthError } from "@/lib/translateAuthError";
import PasswordStrengthChecker, { validatePassword } from "@/components/PasswordStrengthChecker";

const StudentSignup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // Returns true if every field except phone verification is valid.
  const preSignupValid = () => {
    if (!name.trim() || !email.trim() || !password.trim() || !birthDate || !cpf) return false;
    if (!isValidCPF(cpf)) return false;
    if (validatePassword(password, birthDate)) return false;
    if (password !== confirmPassword) return false;
    if (!acceptsTerms) return false;
    return true;
  };

  const reportPreSignupError = () => {
    if (!name.trim() || !email.trim() || !password.trim() || !birthDate || !cpf) {
      toast.error("Preencha todos os campos obrigatórios antes do celular");
      return;
    }
    if (!isValidCPF(cpf)) { toast.error("Informe um CPF válido"); return; }
    const pwdError = validatePassword(password, birthDate);
    if (pwdError) { toast.error(pwdError); return; }
    if (password !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
    if (!acceptsTerms) { toast.error("Você precisa aceitar os Termos de Uso para continuar"); return; }
  };

  const performSignup = async (verifiedPhone: string) => {
    if (loading) return;
    if (!preSignupValid()) { reportPreSignupError(); return; }
    if (!isValidBrazilianPhone(verifiedPhone)) {
      toast.error("Informe um celular válido com DDD (11 dígitos)");
      return;
    }

    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "student", areas: selectedAreas, birth_date: birthDate, phone: verifiedPhone },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      // Upload avatar if provided
      if (signUpData?.user && avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${signUpData.user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", signUpData.user.id);
        }
      }
      // Save areas, phone and marketing preference to profile if signup succeeded
      if (signUpData?.user) {
        const updateData: any = { accepts_marketing: acceptsMarketing, cpf };
        if (selectedAreas.length > 0) updateData.areas = selectedAreas;
        if (verifiedPhone) updateData.phone = verifiedPhone;
        await supabase.from("profiles").update(updateData).eq("user_id", signUpData.user.id);
      }
      // Send welcome email and notify admins
      if (signUpData?.user) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-student",
            recipientEmail: email,
            idempotencyKey: `welcome-student-${signUpData.user.id}`,
            templateData: { name: name.trim() },
          },
        });
        // Notify admin about new student signup
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (adminRoles && adminRoles.length > 0) {
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email")
            .in("user_id", adminRoles.map((r) => r.user_id));
          if (adminProfiles) {
            for (const admin of adminProfiles) {
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "new-student-admin-notify",
                  recipientEmail: admin.email,
                  idempotencyKey: `new-student-notify-${signUpData.user.id}-${admin.email}`,
                  templateData: { studentName: name.trim(), studentEmail: email },
                },
              });
            }
          }
        }
      }
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate("/login");
    }
    setLoading(false);
  };

  const handlePhoneVerified = (verifiedPhone: string) => {
    setPhoneVerified(true);
    setPhone(verifiedPhone);
    performSignup(verifiedPhone);
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">Cadastro de Aluno</h1>
          <p className="text-sm text-muted-foreground">
            Crie sua conta para acessar os cursos
          </p>
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
              toast.error("Erro ao cadastrar com Google");
              return;
            }
            if (result.redirected) {
              return;
            }
            toast.success("Cadastro realizado com sucesso!");
            navigate("/");
          }}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Cadastrar com Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Avatar upload */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative h-20 w-20 rounded-full bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <p className="text-center text-xs text-muted-foreground -mt-2">Adicionar foto</p>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
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
            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Data de Nascimento *"
              value={birthDate}
              onFocus={(e) => (e.target.type = "date")}
              onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
              onChange={(e) => setBirthDate(e.target.value)}
              className="pl-10 bg-secondary border-border"
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <div className="pl-10">
              <CpfInput value={cpf} onChange={setCpf} placeholder="CPF *" className="bg-secondary border-border" />
            </div>
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Senha *"
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
          <PasswordStrengthChecker password={password} birthDate={birthDate} />
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Confirmar senha *"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive">As senhas não coincidem</p>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Áreas de interesse (opcional)</label>
            <AreaSelector selected={selectedAreas} onChange={setSelectedAreas} max={3} />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={acceptsTerms}
                onCheckedChange={(v) => setAcceptsTerms(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
                Li e concordo com os{" "}
                <Link to="/termos?tipo=alunos" target="_blank" className="text-primary hover:underline font-medium">
                  Termos de Uso
                </Link>{" "}
                *
              </label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="marketing"
                checked={acceptsMarketing}
                onCheckedChange={(v) => setAcceptsMarketing(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="marketing" className="text-sm text-muted-foreground leading-tight">
                Aceito receber mensagens e e-mails com promoções e novidades da Revisão Fácil
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              Última etapa: verifique seu celular para concluir o cadastro automaticamente.
            </p>
            {preSignupValid() ? (
              <PhoneVerification phone={phone} onPhoneChange={setPhone} onVerified={handlePhoneVerified} verified={phoneVerified} />
            ) : (
              <div className="rounded-md bg-secondary/50 border border-border px-3 py-3 text-xs text-muted-foreground text-center">
                Preencha todos os campos acima e aceite os Termos para liberar a verificação do celular.
              </div>
            )}
            {loading && (
              <p className="text-center text-xs text-primary mt-3">Criando sua conta...</p>
            )}
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          É professor?{" "}
          <Link to="/signup/teacher" className="font-medium text-accent hover:underline">
            Cadastre-se como professor
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default StudentSignup;
