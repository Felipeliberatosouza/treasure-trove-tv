import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

interface Experience { role: string; org: string; period?: string }
interface Education { course: string; institution: string; year?: string }

interface PendingRequest {
  id: string;
  teacher_id: string;
  proposed: {
    name?: string;
    profile_title?: string;
    expertise_area?: string;
    bio?: string;
    avatar_url?: string;
    experiences?: Experience[];
    education?: Education[];
  };
  status: string;
  created_at: string;
  teacher_name?: string;
  teacher_email?: string;
  current?: Record<string, unknown>;
}

const Field = ({ label, current, proposed }: { label: string; current?: string; proposed?: string }) => {
  const changed = (current || "") !== (proposed || "");
  if (!changed) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2 border-b border-border last:border-0">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label} (atual)</p>
        <p className="text-sm whitespace-pre-wrap break-words">{current || <em className="text-muted-foreground">vazio</em>}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-primary">{label} (novo)</p>
        <p className="text-sm whitespace-pre-wrap break-words font-medium">{proposed || <em className="text-muted-foreground">vazio</em>}</p>
      </div>
    </div>
  );
};

const ListField = ({ label, current, proposed, render }: { label: string; current?: any[]; proposed?: any[]; render: (item: any) => string }) => {
  const c = JSON.stringify(current || []);
  const p = JSON.stringify(proposed || []);
  if (c === p) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2 border-b border-border last:border-0">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label} (atual)</p>
        {(current && current.length > 0) ? (
          <ul className="text-sm list-disc pl-4 space-y-1">
            {current.map((it, i) => <li key={i}>{render(it)}</li>)}
          </ul>
        ) : <p className="text-sm text-muted-foreground italic">vazio</p>}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-primary">{label} (novo)</p>
        {(proposed && proposed.length > 0) ? (
          <ul className="text-sm list-disc pl-4 space-y-1 font-medium">
            {proposed.map((it, i) => <li key={i}>{render(it)}</li>)}
          </ul>
        ) : <p className="text-sm text-muted-foreground italic">vazio</p>}
      </div>
    </div>
  );
};

const AdminProfileApprovalsTab = () => {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState<PendingRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: reqs } = await supabase
      .from("teacher_profile_change_requests")
      .select("id, teacher_id, proposed, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const teacherIds = Array.from(new Set((reqs || []).map((r) => r.teacher_id)));
    const profMap = new Map<string, any>();
    if (teacherIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, email, profile_title, expertise_area, bio, avatar_url, experiences, education")
        .in("user_id", teacherIds);
      (profs || []).forEach((p) => profMap.set(p.user_id, p));
    }
    setRequests(
      (reqs || []).map((r) => {
        const cur = profMap.get(r.teacher_id) || {};
        return {
          ...r,
          proposed: r.proposed as PendingRequest["proposed"],
          teacher_name: cur.name,
          teacher_email: cur.email,
          current: cur,
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (req: PendingRequest) => {
    setBusy(req.id);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("teacher_profile_change_requests")
      .update({ status: "approved", reviewed_by: u.user?.id })
      .eq("id", req.id);
    setBusy(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("approve_profile_change", { targetTable: "teacher_profile_change_requests", targetId: req.id });
    toast({ title: "Aprovado", description: "Página pública atualizada." });
    load();
  };

  const doReject = async () => {
    if (!reject) return;
    setBusy(reject.id);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("teacher_profile_change_requests")
      .update({ status: "rejected", rejection_reason: reason.trim() || "Não informado", reviewed_by: u.user?.id })
      .eq("id", reject.id);
    setBusy(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("reject_profile_change", { targetTable: "teacher_profile_change_requests", targetId: reject.id });
    toast({ title: "Rejeitado" });
    setReject(null);
    setReason("");
    load();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <UserCog className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Aprovação de Páginas de Professores</h2>
        <Badge variant="secondary">{requests.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Revise as alterações enviadas pelos professores em suas páginas públicas. Aprovações são aplicadas imediatamente.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma alteração pendente.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold">{r.teacher_name || "Professor"}</p>
                  <p className="text-xs text-muted-foreground">{r.teacher_email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviado em {new Date(r.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setReject(r); setReason(""); }} disabled={busy === r.id}>
                    <XCircle className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                  <Button size="sm" onClick={() => approve(r)} disabled={busy === r.id}>
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    Aprovar
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/30 px-3">
                <Field label="Nome" current={r.current?.name as string} proposed={r.proposed.name} />
                <Field label="Título da página" current={r.current?.profile_title as string} proposed={r.proposed.profile_title} />
                <Field label="Áreas" current={r.current?.expertise_area as string} proposed={r.proposed.expertise_area} />
                <Field label="Biografia" current={r.current?.bio as string} proposed={r.proposed.bio} />
                <Field label="Foto (URL)" current={r.current?.avatar_url as string} proposed={r.proposed.avatar_url} />
                <ListField
                  label="Experiência profissional"
                  current={(r.current?.experiences as Experience[]) || []}
                  proposed={r.proposed.experiences || []}
                  render={(it: Experience) => `${it.role || ""}${it.org ? " — " + it.org : ""}${it.period ? " (" + it.period + ")" : ""}`}
                />
                <ListField
                  label="Formação acadêmica"
                  current={(r.current?.education as Education[]) || []}
                  proposed={r.proposed.education || []}
                  render={(it: Education) => `${it.course || ""}${it.institution ? " — " + it.institution : ""}${it.year ? " (" + it.year + ")" : ""}`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar alterações</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (será visível ao professor)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReject(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doReject} disabled={busy === reject?.id}>
              {busy === reject?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProfileApprovalsTab;
