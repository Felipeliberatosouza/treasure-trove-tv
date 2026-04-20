import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { CheckCircle, XCircle, FileText, ClipboardList, Trophy, StickyNote, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  onChanged?: () => void;
}

interface MaterialMeta {
  id: string;
  material_type: "resumo" | "simulado" | "top_questoes" | "colinhas";
  offered: boolean;
  admin_approved: boolean;
  submitted_for_review: boolean;
  rejection_reason: string | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  resumo: { label: "Resumo", icon: FileText },
  simulado: { label: "Simulado", icon: ClipboardList },
  top_questoes: { label: "Top Questões", icon: Trophy },
  colinhas: { label: "Colinha", icon: StickyNote },
};

const MaterialReviewDrawer = ({ open, onClose, lessonId, lessonTitle, onChanged }: Props) => {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [metas, setMetas] = useState<MaterialMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<MaterialMeta | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lesson_material_meta")
      .select("id, material_type, offered, admin_approved, submitted_for_review, rejection_reason")
      .eq("lesson_id", lessonId);
    setMetas((data || []) as MaterialMeta[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, lessonId]);

  const handleApprove = async (meta: MaterialMeta) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("lesson_material_meta")
      .update({
        admin_approved: true,
        submitted_for_review: false,
        rejection_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userRes.user?.id,
      })
      .eq("id", meta.id);
    if (error) { toast({ title: "Erro", description: "Não foi possível aprovar.", variant: "destructive" }); return; }
    await logAction("material_approved", { targetTable: "lesson_material_meta", targetId: meta.id, metadata: { lesson_id: lessonId, material_type: meta.material_type } });
    toast({ title: "Aprovado", description: `${TYPE_LABELS[meta.material_type].label} aprovado.` });
    load();
    onChanged?.();
  };

  const confirmReject = async () => {
    if (!rejecting || !reason.trim()) return;
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("lesson_material_meta")
      .update({
        admin_approved: false,
        submitted_for_review: false,
        rejection_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: userRes.user?.id,
      })
      .eq("id", rejecting.id);
    if (error) { toast({ title: "Erro", description: "Não foi possível rejeitar.", variant: "destructive" }); return; }
    await logAction("material_rejected", { targetTable: "lesson_material_meta", targetId: rejecting.id, metadata: { lesson_id: lessonId, material_type: rejecting.material_type, reason } });
    toast({ title: "Rejeitado", description: `${TYPE_LABELS[rejecting.material_type].label} rejeitado.` });
    setRejecting(null);
    setReason("");
    load();
    onChanged?.();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Materiais de "{lessonTitle}"</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate(`/video/${lessonId}`)}>
              <Eye className="h-4 w-4" /> Abrir página da aula
            </Button>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : metas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum material cadastrado nesta aula ainda.</p>
            ) : (
              metas
                .filter((m) => m.offered) // só mostra os que o professor escolheu oferecer
                .map((m) => {
                  const cfg = TYPE_LABELS[m.material_type] || { label: m.material_type, icon: FileText };
                  const Icon = cfg.icon;
                  return (
                    <div key={m.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">{cfg.label}</span>
                        </div>
                        {m.admin_approved ? (
                          <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-xs">Aprovado</Badge>
                        ) : m.submitted_for_review ? (
                          <Badge variant="outline" className="border-accent/30 text-accent text-xs">Pendente</Badge>
                        ) : m.rejection_reason ? (
                          <Badge variant="outline" className="border-destructive/30 text-destructive text-xs">Rejeitado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">Não revisado</Badge>
                        )}
                      </div>
                      {m.rejection_reason && !m.admin_approved && (
                        <p className="text-[11px] text-destructive">Motivo da rejeição: {m.rejection_reason}</p>
                      )}
                      <div className="flex gap-2">
                        {!m.admin_approved && (
                          <Button size="sm" variant="ghost" className="h-8 text-green-600 dark:text-green-400 hover:text-green-500" onClick={() => handleApprove(m)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => { setRejecting(m); setReason(m.rejection_reason || ""); }}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!rejecting} onOpenChange={(v) => { if (!v) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar material</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o motivo da rejeição de <strong>{rejecting && TYPE_LABELS[rejecting.material_type]?.label}</strong>.
          </p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Descreva o motivo..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={!reason.trim()} onClick={confirmReject}>Confirmar Rejeição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MaterialReviewDrawer;
