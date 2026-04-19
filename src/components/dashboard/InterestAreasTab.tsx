import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import AreaSelector from "@/components/AreaSelector";

const InterestAreasTab = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { logAction } = useAuditLog();
  const [studentAreas, setStudentAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setStudentAreas((profile as any).areas || []);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ areas: studentAreas })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar áreas de interesse");
    } else {
      await logAction("profile_update", { targetTable: "profiles", metadata: { fields: ["areas"] } });
      toast.success("Áreas de interesse atualizadas!");
      refreshProfile();
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-2">Áreas de Interesse</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Selecione até 3 áreas para personalizarmos os conteúdos exibidos para você.
      </p>
      <div className="space-y-4 max-w-md">
        <AreaSelector selected={studentAreas} onChange={setStudentAreas} max={3} />
        <Button onClick={handleSave} disabled={saving} className="font-display">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default InterestAreasTab;
