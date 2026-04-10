import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import AreaSelector from "@/components/AreaSelector";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import { Camera, Loader2 } from "lucide-react";

const PersonalDataTab = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [slug, setSlug] = useState("");
  const [profileTitle, setProfileTitle] = useState("");
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
      setSlug((profile as any).slug || "");
      setProfileTitle((profile as any).profile_title || "");
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
    setSaving(true);
    const updateData: any = { name, bio, expertise_area: expertiseAreas.join(", "), birth_date: birthDate || null };
    if (role === "teacher") {
      updateData.slug = slug;
      updateData.profile_title = profileTitle;
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
          <label className="text-sm text-muted-foreground mb-1 block">Nome completo</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
          <Input value={user?.email || ""} disabled className="bg-secondary opacity-60" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Data de Nascimento</label>
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="bg-secondary"
            max={new Date().toISOString().split("T")[0]}
          />
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
