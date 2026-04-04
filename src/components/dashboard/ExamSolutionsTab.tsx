import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ContentForm from "./ContentForm";

const ExamSolutionsTab = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("exam_solutions")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">Resoluções de Provas</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="font-display gap-1">
            <Plus className="h-4 w-4" /> Nova Resolução
          </Button>
        )}
      </div>

      {showForm ? (
        <ContentForm
          table="exam_solutions"
          onSaved={() => { setShowForm(false); fetchItems(); }}
          onCancel={() => setShowForm(false)}
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma resolução cadastrada. Clique em "Nova Resolução" para começar.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt="" className="h-14 w-20 rounded object-cover" />
              ) : (
                <div className="flex h-14 w-20 items-center justify-center rounded bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.description || "Sem descrição"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamSolutionsTab;
