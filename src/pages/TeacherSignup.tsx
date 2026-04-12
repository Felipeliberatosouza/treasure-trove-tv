import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, BookOpen, ArrowLeft, CalendarDays, Camera } from "lucide-react";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import AreaSelector from "@/components/AreaSelector";
import { translateAuthError } from "@/lib/translateAuthError";
import PasswordStrengthChecker, { validatePassword } from "@/components/PasswordStrengthChecker";

const TeacherSignup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { areas } = useCourseAreas(true);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !birthDate || !phone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!acceptsTerms) {
      toast.error("Você precisa aceitar os Termos de Uso para continuar");
      return;
    }
    if (!isValidBrazilianPhone(phone)) {
      toast.error("Informe um celular válido com DDD (11 dígitos)");
      return;
    }
    const pwdError = validatePassword(password, birthDate);
    if (pwdError) {
      toast.error(pwdError);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "teacher", bio, expertise_area: expertise.join(", "), birth_date: birthDate, phone },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      // Upload avatar if provided
      const userId = (await supabase.auth.getUser())?.data?.user?.id;
      if (avatarFile && userId) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", userId);
        }
      }
      // Save phone and marketing preference to profile
      if (userId) {
        await supabase.from("profiles").update({ phone, accepts_marketing: acceptsMarketing }).eq("user_id", userId);
      }
      // Send welcome email
      if (userId) {
        // Send welcome email to teacher
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-teacher",
            recipientEmail: email,
            idempotencyKey: `welcome-teacher-${userId}`,
            templateData: { name: name.trim() },
          },
        });
        // Notify admin about new teacher signup
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
                  templateName: "new-teacher-admin-notify",
                  recipientEmail: admin.email,
                  idempotencyKey: `new-teacher-notify-${userId}-${admin.email}`,
                  templateData: { teacherName: name.trim(), teacherEmail: email },
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <BookOpen className="h-7 w-7 text-accent" />
          </div>
          <h1 className="font-display text-2xl font-bold">Cadastro de Professor</h1>
          <p className="text-sm text-muted-foreground">
            Crie sua conta para disponibilizar seus cursos
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
            }
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar upload */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative h-20 w-20 rounded-full bg-secondary border-2 border-dashed border-border hover:border-accent/50 transition-colors flex items-center justify-center overflow-hidden"
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
              placeholder="Nome completo *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="E-mail *"
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
          <PhoneInput value={phone} onChange={setPhone} />
          
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
            <label className="text-sm text-muted-foreground mb-1 block">Áreas de especialização</label>
            <AreaSelector selected={expertise} onChange={setExpertise} max={areas.length || 10} />
          </div>
          <Textarea
            placeholder="Bio — Conte sobre você e sua experiência"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="min-h-[100px] bg-secondary border-border"
          />

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
                <Link to="/termos?tipo=professores" target="_blank" className="text-primary hover:underline font-medium">
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

          <Button className="w-full font-display font-semibold" size="lg" disabled={loading || !acceptsTerms}>
            {loading ? "Criando..." : "Criar Conta de Professor"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          É aluno?{" "}
          <Link to="/signup/student" className="font-medium text-primary hover:underline">
            Cadastre-se como aluno
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default TeacherSignup;
