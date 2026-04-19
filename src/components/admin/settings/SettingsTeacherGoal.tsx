import { useEffect, useState } from "react";
import { Target, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface TeacherRow {
  user_id: string;
  name: string;
  email: string;
  monthly_content_goal: number | null;
}

const SettingsTeacherGoal = () => {
  const [globalGoal, setGlobalGoal] = useState<number>(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const fetchAll = async () => {
    setLoading(true);
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "teacher_content_goal")
      .maybeSingle();
    const g = (setting?.value as { monthly_goal?: number })?.monthly_goal ?? 8;
    setGlobalGoal(g);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");
    const teacherIds = (roles || []).map((r) => r.user_id);

    if (teacherIds.length === 0) {
      setTeachers([]);
      setLoading(false);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email, monthly_content_goal")
      .in("user_id", teacherIds)
      .order("name");

    const list = (profiles || []) as TeacherRow[];
    setTeachers(list);
    const init: Record<string, string> = {};
    list.forEach((t) => {
      init[t.user_id] = t.monthly_content_goal != null ? String(t.monthly_content_goal) : "";
    });
    setOverrides(init);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const saveGlobal = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: { monthly_goal: globalGoal } })
      .eq("key", "teacher_content_goal");
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar meta global");
    } else {
      toast.success("Meta global atualizada");
    }
  };

  const saveOverride = async (userId: string) => {
    const raw = overrides[userId];
    const value = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
    const { error } = await supabase
      .from("profiles")
      .update({ monthly_content_goal: value } as any)
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao salvar meta individual");
    } else {
      toast.success("Meta individual atualizada");
      setTeachers((prev) =>
        prev.map((t) => (t.user_id === userId ? { ...t, monthly_content_goal: value } : t))
      );
    }
  };

  return (
    <div>
      <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
        <Target className="h-4 w-4" /> Meta de Publicações por Professor
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Define quantas publicações (vídeos, simulados, colinhas, etc.) cada professor deve postar
        por mês. A meta global vale para todos; você pode sobrescrever individualmente abaixo.
      </p>

      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <Label htmlFor="global-goal" className="text-sm font-medium">
          Meta global mensal (todos os professores)
        </Label>
        <div className="flex gap-2 mt-2 max-w-xs">
          <Input
            id="global-goal"
            type="number"
            min={0}
            value={globalGoal}
            onChange={(e) => setGlobalGoal(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
          <Button onClick={saveGlobal} disabled={saving} size="sm" className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <h4 className="font-medium text-sm mb-3">Overrides individuais</h4>
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando professores...</span>
        </div>
      ) : teachers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum professor cadastrado.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-40">Meta personalizada</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.user_id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      placeholder={`Padrão: ${globalGoal}`}
                      value={overrides[t.user_id] ?? ""}
                      onChange={(e) =>
                        setOverrides((p) => ({ ...p, [t.user_id]: e.target.value }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => saveOverride(t.user_id)}>
                      Salvar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SettingsTeacherGoal;
