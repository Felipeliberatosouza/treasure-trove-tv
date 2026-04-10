import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PersonalDataTab = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [expertiseArea, setExpertiseArea] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setBio(profile.bio || "");
      setExpertiseArea(profile.expertise_area || "");
      setBirthDate(profile.birth_date || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, bio, expertise_area: expertiseArea, birth_date: birthDate || null })
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
              <label className="text-sm text-muted-foreground mb-1 block">Área de expertise</label>
              <Input value={expertiseArea} onChange={(e) => setExpertiseArea(e.target.value)} className="bg-secondary" />
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
