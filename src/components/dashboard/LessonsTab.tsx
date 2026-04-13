import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Video, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ContentForm from "./ContentForm";
import TeacherContractModal from "./TeacherContractModal";
import TeacherDataModal from "./TeacherDataModal";
import { isValidCPF } from "@/lib/cpfValidator";
import { toast } from "sonner";

const LessonsTab = () => {
  const { user, profile } = useAuth();
  const [lessons, setLessons] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasValidContract, setHasValidContract] = useState<boolean | null>(null);

  const fetchLessons = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setLessons(data || []);
    setLoading(false);
  };

  const checkContract = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("teacher_contracts" as any)
      .select("id, expires_at")
      .eq("teacher_id", user.id)
      .eq("status", "active")
      .order("signed_at", { ascending: false })
      .limit(1);

    const contracts = data as any[] | null;
    if (!contracts || contracts.length === 0) {
      setHasValidContract(false);
      return;
    }
    const expiresAt = new Date(contracts[0].expires_at);
    setHasValidContract(expiresAt > new Date());
  };

  useEffect(() => {
    fetchLessons();
    checkContract();
  }, [user]);

  const hasCompleteData = () => {
    const p = profile as any;
    return p?.cpf && isValidCPF(p.cpf) && p?.address && p.address.trim() !== "" && p?.pix_key && p.pix_key.trim() !== "";
  };

  const handleNewLesson = () => {
    if (!hasCompleteData()) {
      setShowDataModal(true);
    } else if (!hasValidContract) {
      setShowContract(true);
    } else {
      setShowForm(true);
    }
  };

  const handleDataComplete = () => {
    setShowDataModal(false);
    // After saving data, check contract
    if (!hasValidContract) {
      setShowContract(true);
    } else {
      setShowForm(true);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">Minhas Aulas</h2>
        {!showForm && (
          <Button size="sm" onClick={handleNewLesson} className="font-display gap-1">
            <Plus className="h-4 w-4" /> Nova Aula
          </Button>
        )}
      </div>

      <TeacherDataModal
        open={showDataModal}
        onClose={() => setShowDataModal(false)}
        onComplete={handleDataComplete}
      />

      <TeacherContractModal
        open={showContract}
        onClose={() => setShowContract(false)}
        onSigned={() => {
          setShowContract(false);
          setHasValidContract(true);
          setShowForm(true);
        }}
      />

      {showForm ? (
        <ContentForm
          table="lessons"
          editData={editingLesson}
          onSaved={() => { setShowForm(false); setEditingLesson(null); fetchLessons(); }}
          onCancel={() => { setShowForm(false); setEditingLesson(null); }}
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada. Clique em "Nova Aula" para começar.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const isPending = lesson.published && !lesson.admin_approved;
            const canDelete = isPending || (!lesson.published && !lesson.admin_approved);
            return (
              <div key={lesson.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
                {lesson.thumbnail_url ? (
                  <img src={lesson.thumbnail_url} alt="" className="h-14 w-20 rounded object-cover" />
                ) : (
                  <div className="flex h-14 w-20 items-center justify-center rounded bg-muted">
                    <Video className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{lesson.title}</p>
                    {lesson.published && lesson.admin_approved ? (
                      <Badge variant="default" className="shrink-0 bg-green-600 text-xs">Aprovado</Badge>
                    ) : isPending ? (
                      <Badge variant="secondary" className="shrink-0 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">Pendente</Badge>
                    ) : (
                      <Badge variant="destructive" className="shrink-0 text-xs">Rejeitado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{lesson.description || "Sem descrição"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      if (lesson.admin_approved) {
                        if (!confirm("Ao editar um conteúdo já aprovado, ele voltará para pendência de aprovação. Deseja continuar?")) return;
                      }
                      setEditingLesson(lesson); setShowForm(true);
                    }}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Tem certeza que deseja excluir esta aula?")) return;
                        const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
                        if (error) { toast.error("Erro ao excluir"); return; }
                        toast.success("Aula excluída");
                        fetchLessons();
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LessonsTab;
