import { useState } from "react";
import { Plus, Trash2, GripVertical, Eye, EyeOff, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCourseAreas, CourseArea } from "@/hooks/useCourseAreas";
import { toast } from "sonner";

const SettingsCourseAreas = () => {
  const { areas, loading, refetch } = useCourseAreas(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    const { error } = await supabase.from("course_areas").insert({
      name,
      sort_order: areas.length,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Essa área já existe.");
      } else {
        toast.error("Erro ao criar área.");
      }
    } else {
      toast.success("Área criada!");
      setNewName("");
      refetch();
    }
    setSaving(false);
  };

  const handleToggle = async (area: CourseArea, field: "active" | "show_on_homepage") => {
    const updatePayload = field === "active"
      ? { active: !area.active }
      : { show_on_homepage: !area.show_on_homepage };
    const { error } = await supabase
      .from("course_areas")
      .update(updatePayload)
      .eq("id", area.id);

    if (error) {
      toast.error("Erro ao atualizar.");
    } else {
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta área?")) return;
    const { error } = await supabase.from("course_areas").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover.");
    } else {
      toast.success("Área removida.");
      refetch();
    }
  };

  const handleRename = async (id: string, name: string) => {
    const { error } = await supabase.from("course_areas").update({ name }).eq("id", id);
    if (error) toast.error("Erro ao renomear.");
    else refetch();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-sm font-semibold mb-1">Áreas de Cursos</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Gerencie as áreas disponíveis para professores e alunos. Marque quais aparecem na página inicial.
        </p>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome da nova área..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="bg-secondary max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={saving || !newName.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {areas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma área cadastrada.</p>
        )}
        {areas.map((area) => (
          <div
            key={area.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

            <Input
              defaultValue={area.name}
              className="bg-transparent border-none h-8 text-sm font-medium flex-1 min-w-0"
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val && val !== area.name) handleRename(area.id, val);
              }}
            />

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleToggle(area, "active")}
                className={`p-1.5 rounded ${area.active ? "text-green-500" : "text-muted-foreground"}`}
                title={area.active ? "Ativa" : "Inativa"}
              >
                {area.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              <button
                onClick={() => handleToggle(area, "show_on_homepage")}
                className={`p-1.5 rounded ${area.show_on_homepage ? "text-primary" : "text-muted-foreground"}`}
                title={area.show_on_homepage ? "Visível na home" : "Oculta na home"}
              >
                <Home className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleDelete(area.id)}
                className="p-1.5 rounded text-muted-foreground hover:text-destructive"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>👁 = Área ativa (visível para professores e alunos)</p>
        <p>🏠 = Aparece como seção na página inicial</p>
      </div>
    </div>
  );
};

export default SettingsCourseAreas;
