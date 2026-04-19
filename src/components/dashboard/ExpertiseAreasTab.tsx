import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import AreaSelector from "@/components/AreaSelector";

const ExpertiseAreasTab = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { logAction } = useAuditLog();
  const { areas } = useCourseAreas(true);
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setExpertiseAreas(profile.expertise_area ? profile.expertise_area.split(", ").filter(Boolean) : []);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ expertise_area: expertiseAreas.join(", ") })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar áreas de expertise");
    } else {
      await logAction("profile_update", { targetTable: "profiles", metadata: { fields: ["expertise_area"] } });
      toast.success("Áreas de expertise atualizadas!");
      refreshProfile();
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Áreas de Expertise</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Selecione as áreas em que você tem domínio para ensinar. Essas informações aparecem no seu perfil público.
      </p>
      <div className="space-y-4 max-w-md">
        <AreaSelector selected={expertiseAreas} onChange={setExpertiseAreas} max={areas.length || 10} />
        <Button onClick={handleSave} disabled={saving} className="font-display">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default ExpertiseAreasTab;
