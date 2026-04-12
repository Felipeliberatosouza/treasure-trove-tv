import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ContentForm from "./ContentForm";
import TeacherContractModal from "./TeacherContractModal";
import TeacherDataModal from "./TeacherDataModal";
import { isValidCPF } from "@/lib/cpfValidator";

const ExamSolutionsTab = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasValidContract, setHasValidContract] = useState<boolean | null>(null);

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
    fetchItems();
    checkContract();
  }, [user]);

  const hasCompleteData = () => {
    const p = profile as any;
    return p?.cpf && isValidCPF(p.cpf) && p?.address && p.address.trim() !== "";
  };

  const handleNewItem = () => {
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
    if (!hasValidContract) {
      setShowContract(true);
    } else {
      setShowForm(true);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">Resoluções de Provas</h2>
        {!showForm && (
          <Button size="sm" onClick={handleNewItem} className="font-display gap-1">
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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.published && item.admin_approved ? (
                    <Badge variant="default" className="shrink-0 bg-green-600 text-xs">Aprovado</Badge>
                  ) : item.published && !item.admin_approved ? (
                    <Badge variant="secondary" className="shrink-0 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">Pendente</Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0 text-xs">Rejeitado</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.description || "Sem descrição"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
};

export default ExamSolutionsTab;
