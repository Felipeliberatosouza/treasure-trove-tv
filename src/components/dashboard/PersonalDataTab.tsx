import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import AreaSelector from "@/components/AreaSelector";
import PhoneVerification from "@/components/PhoneVerification";
import { isValidBrazilianPhone } from "@/components/PhoneInput";
import CpfInput from "@/components/CpfInput";
import { isValidCPF, formatCPF } from "@/lib/cpfValidator";
import { Camera, Loader2, CheckCircle2, XCircle, AlertCircle, Plus, Trash2, Briefcase, GraduationCap } from "lucide-react";

interface Experience { role: string; org: string; period?: string; description?: string }
interface Education { course: string; institution: string; year?: string; description?: string }

const PersonalDataTab = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const { logAction } = useAuditLog();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
  const [studentAreas, setStudentAreas] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [profileTitle, setProfileTitle] = useState("");
  const [address, setAddress] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const slugCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { areas } = useCourseAreas(true);
  const { data: contact } = usePlatformSettings("contact");
  const originalSlug = useRef("");
  const initializedProfile = useRef(false);
  const initializedTeacherLists = useRef(false);

  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);

  const generateSuggestions = useCallback(async (base: string) => {
    const candidates = [
      `${base}1`, `${base}2`, `${base}3`,
      `${base}.prof`, `prof.${base}`,
      `${base}.aulas`, `${base}.edu`,
    ];
    const { data } = await supabase
      .from("profiles")
      .select("slug")
      .in("slug", candidates);
    const taken = new Set((data || []).map((r: any) => r.slug));
    setSlugSuggestions(candidates.filter(c => !taken.has(c)).slice(0, 3));
  }, []);

  const checkSlugAvailability = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setSlugStatus("idle");
      setSlugSuggestions([]);
      return;
    }
    if (value === originalSlug.current) {
      setSlugStatus("available");
      setSlugSuggestions([]);
      return;
    }
    setSlugStatus("checking");
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", value)
      .neq("user_id", user?.id || "")
      .limit(1);
    const isTaken = data && data.length > 0;
    setSlugStatus(isTaken ? "taken" : "available");
    if (isTaken) {
      generateSuggestions(value);
    } else {
      setSlugSuggestions([]);
    }
  }, [user?.id, generateSuggestions]);

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9.]/g, "");
    setSlug(sanitized);
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);
    if (!sanitized || sanitized.length < 3) {
      setSlugStatus("idle");
      return;
    }
    slugCheckTimeout.current = setTimeout(() => checkSlugAvailability(sanitized), 500);
  };

  useEffect(() => {
    if (profile && !initializedProfile.current) {
      initializedProfile.current = true;
      setName(profile.name || "");
      setBio(profile.bio || "");
      setExpertiseAreas(profile.expertise_area ? profile.expertise_area.split(", ").filter(Boolean) : []);
      setStudentAreas((profile as any).areas || []);
      setBirthDate(profile.birth_date || "");
      setPhone(profile.phone || "");
      setCpf((profile as any).cpf || "");
      setEmail(profile.email || user?.email || "");
      setOriginalEmail(profile.email || user?.email || "");
      setSlug((profile as any).slug || "");
      originalSlug.current = (profile as any).slug || "";
      setProfileTitle((profile as any).profile_title || "");
      setAddress((profile as any).address || "");
      setPixKey((profile as any).pix_key || "");
      setAcceptsMarketing((profile as any).accepts_marketing || false);
      setPhoneVerified((profile as any).phone_verified || false);
    }
  }, [profile]);

  useEffect(() => {
    if (!user || role !== "teacher") return;
    if (initializedTeacherLists.current) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("experiences, education")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      initializedTeacherLists.current = true;
      setExperiences(Array.isArray((data as any).experiences) ? (data as any).experiences : []);
      setEducation(Array.isArray((data as any).education) ? (data as any).education : []);
    })();
    return () => { cancelled = true; };
  }, [user, role]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateErr } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user.id);
      if (updateErr) throw updateErr;
      toast.success("Foto atualizada!");
      refreshProfile();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto");
    }
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    if (!user) return;
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length < 2 || nameParts.some(p => p.length < 2)) {
      toast.error("Informe o nome completo (nome e sobrenome)");
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const emailChanged = trimmedEmail && trimmedEmail !== (originalEmail || "").toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (!birthDate) {
      toast.error("A data de nascimento é obrigatória");
      return;
    }
    if (phone && !isValidBrazilianPhone(phone)) {
      toast.error("Informe um celular válido com DDD (11 dígitos)");
      return;
    }
    if (!phone || !isValidBrazilianPhone(phone)) {
      toast.error("O celular é obrigatório");
      return;
    }
    if (!phoneVerified) {
      toast.error("Verifique seu celular antes de salvar");
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      toast.error("Informe um CPF válido");
      return;
    }
    if (role === "teacher") {
      if (!cpf || !isValidCPF(cpf)) {
        toast.error("O CPF é obrigatório para professores (necessário para o contrato)");
        return;
      }
      if (!address || !address.trim()) {
        toast.error("O endereço é obrigatório para professores (necessário para o contrato)");
        return;
      }
      if (!pixKey || !pixKey.trim()) {
        toast.error("A chave PIX é obrigatória para professores (necessária para pagamento)");
        return;
      }
      if (slugStatus === "taken") {
        toast.error("A URL do perfil já está em uso. Escolha outra antes de salvar.");
        return;
      }
    }
    setSaving(true);

    if (emailChanged) {
      const { error: authErr } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (authErr) {
        toast.error("Erro ao atualizar e-mail: " + authErr.message);
        setSaving(false);
        return;
      }
    }

    // If re-enabling marketing, call the reactivation function to clear suppression
    if (acceptsMarketing && !(profile as any)?.accepts_marketing) {
      const { error: reactivateErr } = await supabase.functions.invoke("reactivate-email-marketing", {
        body: { email: user.email },
      });
      if (reactivateErr) {
        toast.error("Erro ao reativar e-mails promocionais");
        setSaving(false);
        return;
      }
    }

    const updateData: any = { name, bio, expertise_area: expertiseAreas.join(", "), birth_date: birthDate || null, phone: phone || null, cpf: cpf || null, accepts_marketing: acceptsMarketing };
    if (emailChanged) {
      updateData.email = trimmedEmail;
    }
    if (role === "student") {
      updateData.areas = studentAreas;
    }
    if (role === "teacher") {
      updateData.slug = slug;
      updateData.profile_title = profileTitle;
      updateData.address = address || null;
      updateData.pix_key = pixKey || null;
      updateData.experiences = experiences.filter((x) => (x.role || "").trim() || (x.org || "").trim());
      updateData.education = education.filter((x) => (x.course || "").trim() || (x.institution || "").trim());
    }
    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      if (error.code === "23505" && error.message?.includes("slug")) {
        toast.error("Esta URL de perfil já está em uso. Escolha outra.");
      } else {
        toast.error("Erro ao salvar dados: " + (error.message || error.code));
      }
    } else {
      await logAction("profile_update", { targetTable: "profiles", metadata: { fields: Object.keys(updateData) } });
      if (emailChanged) {
        setOriginalEmail(trimmedEmail);
        toast.success("Dados atualizados! Confirme o novo e-mail pelo link enviado.");
      } else {
        toast.success("Dados atualizados com sucesso!");
      }
      refreshProfile();
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4">Dados Pessoais</h2>
      <div className="space-y-4 max-w-md">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative h-20 w-20 rounded-full bg-secondary border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden shrink-0"
          >
            {uploadingAvatar ? (
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground" />
            )}
          </button>
          <div>
            <p className="text-sm font-medium text-foreground">{profile?.name || "Sua foto"}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="text-xs text-primary hover:underline"
            >
              {uploadingAvatar ? "Enviando..." : "Alterar foto"}
            </button>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Nome completo <span className="text-destructive">*</span></label>
          <Input value={name} onChange={(e) => {
            const capitalized = e.target.value.split(" ").map((w, i) => {
              const lower = w.toLowerCase();
              if (i > 0 && ["de", "da", "do", "dos", "das", "e"].includes(lower)) return lower;
              return w.replace(/^\w/, (c) => c.toUpperCase());
            }).join(" ");
            setName(capitalized);
          }} className="bg-secondary" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-secondary"
            placeholder="seu@email.com"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ao alterar, enviaremos um link de confirmação para o novo endereço.
          </p>
        </div>
        {(profile as any)?.referral_code && (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Código de Indicação</label>
            <Input value={String((profile as any).referral_code)} disabled className="bg-secondary opacity-60 font-mono font-semibold" />
            <p className="text-xs text-muted-foreground mt-1">Compartilhe este código para indicar amigos</p>
          </div>
        )}
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Data de Nascimento <span className="text-destructive">*</span></label>
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="bg-secondary"
            max={new Date().toISOString().split("T")[0]}
          />
        </div>
        <PhoneVerification
          phone={phone}
          onPhoneChange={(v) => { setPhone(v); if (v !== phone) setPhoneVerified(false); }}
          onVerified={() => setPhoneVerified(true)}
          verified={phoneVerified}
        />
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            CPF {role === "teacher" && <span className="text-xs text-primary font-medium">(obrigatório para contrato)</span>}
          </label>
          <Input value={formatCPF(cpf)} disabled className="bg-secondary opacity-60 cursor-not-allowed" placeholder="Não informado" />
          <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                Por questões de segurança, o CPF não pode ser alterado. Em caso de erro de cadastro, entre em contato com o suporte:
              </p>
              <ul className="space-y-0.5">
                {contact?.email && (
                  <li>
                    E-mail: <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
                  </li>
                )}
                {contact?.phone && (
                  <li>
                    Telefone: <a href={`tel:${contact.phone.replace(/\D/g, "")}`} className="text-primary hover:underline">{contact.phone}</a>
                  </li>
                )}
                {contact?.whatsapp && (
                  <li>
                    WhatsApp:{" "}
                    <a
                      href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}${contact.whatsapp_message ? `?text=${encodeURIComponent(contact.whatsapp_message)}` : ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {contact.whatsapp}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 pt-2">
          <Checkbox
            id="acceptsMarketing"
            checked={acceptsMarketing}
            onCheckedChange={(v) => setAcceptsMarketing(v === true)}
            className="mt-0.5"
          />
          <label htmlFor="acceptsMarketing" className="text-sm text-muted-foreground leading-tight">
            Aceito receber mensagens e e-mails com promoções e novidades da Revisão Fácil
          </label>
        </div>
        {role === "teacher" && (
          <>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">URL da sua página</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground whitespace-nowrap">revisaofacil.com.br/</span>
                <div className="relative flex-1">
                  <Input
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className={`bg-secondary pr-8 ${slugStatus === "taken" ? "border-destructive" : slugStatus === "available" ? "border-green-500" : ""}`}
                    placeholder="nome.sobrenome"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {slugStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {slugStatus === "available" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {slugStatus === "taken" && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              </div>
              {slugStatus === "taken" && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-destructive">Esta URL já está em uso. Escolha outra.</p>
                  {slugSuggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Sugestões:</span>
                      {slugSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setSlug(s); checkSlugAvailability(s); }}
                          className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {slugStatus === "available" && slug !== originalSlug.current && (
                <p className="text-xs text-green-500 mt-1">URL disponível!</p>
              )}
              {slug && slug.length < 3 && (
                <p className="text-xs text-muted-foreground mt-1">Mínimo de 3 caracteres.</p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Título da sua página</label>
              <Input
                value={profileTitle}
                onChange={(e) => setProfileTitle(e.target.value)}
                className="bg-secondary"
                placeholder="Ex: Aulas de Matemática com Prof. João"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Endereço Completo <span className="text-xs text-primary font-medium">(obrigatório para contrato)</span></label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-secondary"
                placeholder="Rua, número, bairro, cidade - UF, CEP"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Chave PIX <span className="text-xs text-primary font-medium">(obrigatório para pagamento)</span></label>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="bg-secondary"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
              <p className="text-xs text-muted-foreground mt-1">Utilizada para recebimento do pagamento mensal</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bio</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="bg-secondary" rows={3} />
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Minha Experiência
                </label>
                <Button type="button" size="sm" variant="outline" onClick={() => setExperiences((arr) => [...arr, { role: "", org: "", period: "" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {experiences.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma experiência cadastrada.</p>
              )}
              {experiences.map((exp, i) => (
                <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-secondary/40">
                  <Input
                    placeholder="Cargo / Função"
                    value={exp.role}
                    onChange={(e) => setExperiences((arr) => arr.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))}
                    className="bg-secondary"
                  />
                  <Input
                    placeholder="Empresa / Instituição"
                    value={exp.org}
                    onChange={(e) => setExperiences((arr) => arr.map((x, idx) => idx === i ? { ...x, org: e.target.value } : x))}
                    className="bg-secondary"
                  />
                  <Textarea
                    placeholder="Descrição (atribuições, conquistas, etc.)"
                    value={exp.description || ""}
                    onChange={(e) => setExperiences((arr) => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                    className="bg-secondary"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Período (ex: 2020 - 2023)"
                      value={exp.period || ""}
                      onChange={(e) => setExperiences((arr) => arr.map((x, idx) => idx === i ? { ...x, period: e.target.value } : x))}
                      className="bg-secondary flex-1"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setExperiences((arr) => arr.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Minha Formação Acadêmica
                </label>
                <Button type="button" size="sm" variant="outline" onClick={() => setEducation((arr) => [...arr, { course: "", institution: "", year: "" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {education.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma formação cadastrada.</p>
              )}
              {education.map((edu, i) => (
                <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-secondary/40">
                  <Input
                    placeholder="Curso / Titulação"
                    value={edu.course}
                    onChange={(e) => setEducation((arr) => arr.map((x, idx) => idx === i ? { ...x, course: e.target.value } : x))}
                    className="bg-secondary"
                  />
                  <Input
                    placeholder="Instituição"
                    value={edu.institution}
                    onChange={(e) => setEducation((arr) => arr.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x))}
                    className="bg-secondary"
                  />
                  <Textarea
                    placeholder="Descrição (disciplinas, projeto de conclusão, etc.)"
                    value={edu.description || ""}
                    onChange={(e) => setEducation((arr) => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                    className="bg-secondary"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ano de conclusão"
                      value={edu.year || ""}
                      onChange={(e) => setEducation((arr) => arr.map((x, idx) => idx === i ? { ...x, year: e.target.value } : x))}
                      className="bg-secondary flex-1"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setEducation((arr) => arr.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <Button onClick={handleSave} disabled={saving} className="font-display">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default PersonalDataTab;
