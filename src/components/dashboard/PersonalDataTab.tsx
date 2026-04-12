import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import AreaSelector from "@/components/AreaSelector";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import CpfInput from "@/components/CpfInput";
import { isValidCPF } from "@/lib/cpfValidator";
import { Camera, Loader2 } from "lucide-react";

const PersonalDataTab = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [slug, setSlug] = useState("");
  const [profileTitle, setProfileTitle] = useState("");
  const [address, setAddress] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { areas } = useCourseAreas(true);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setBio(profile.bio || "");
      setExpertiseAreas(profile.expertise_area ? profile.expertise_area.split(", ").filter(Boolean) : []);
      setBirthDate(profile.birth_date || "");
      setPhone(profile.phone || "");
      setCpf((profile as any).cpf || "");
      setSlug((profile as any).slug || "");
      setProfileTitle((profile as any).profile_title || "");
      setAddress((profile as any).address || "");
      setAcceptsMarketing((profile as any).accepts_marketing || false);
    }
  }, [profile]);

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
    if (!birthDate) {
      toast.error("A data de nascimento é obrigatória");
      return;
    }
    if (phone && !isValidBrazilianPhone(phone)) {
      toast.error("Informe um celular válido com DDD (11 dígitos)");
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      toast.error("Informe um CPF válido");
      return;
    }
    setSaving(true);
    const updateData: any = { name, bio, expertise_area: expertiseAreas.join(", "), birth_date: birthDate || null, phone: phone || null, cpf: cpf || null, accepts_marketing: acceptsMarketing };
    if (role === "teacher") {
      updateData.slug = slug;
      updateData.profile_title = profileTitle;
      updateData.address = address || null;
    }
    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar dados");
    } else {
      toast.success("Dados atualizados com sucesso!");
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
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
          <Input value={user?.email || ""} disabled className="bg-secondary opacity-60" />
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
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Celular</label>
          <PhoneInput value={phone} onChange={setPhone} placeholder="(00) 00000-0000" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">CPF {role === "teacher" && <span className="text-xs text-primary font-medium">(obrigatório para contrato)</span>}</label>
          <CpfInput value={cpf} onChange={setCpf} className="bg-secondary" />
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
                <span className="text-sm text-muted-foreground whitespace-nowrap">revisaofacil.com/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))}
                  className="bg-secondary"
                  placeholder="nome.sobrenome"
                />
              </div>
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
              <label className="text-sm text-muted-foreground mb-1 block">Áreas de expertise</label>
              <AreaSelector selected={expertiseAreas} onChange={setExpertiseAreas} max={areas.length || 10} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bio</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="bg-secondary" rows={3} />
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
