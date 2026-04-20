import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle, XCircle, Video, FileText, DollarSign, Eye, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import MaterialReviewDrawer from "./MaterialReviewDrawer";

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  published: boolean | null;
  admin_approved: boolean | null;
  platform_percentage: number | null;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  type: "lesson" | "exam_solution";
  created_at: string;
  price: number | null;
}

const AdminContentTab = () => {
  const navigate = useNavigate();
  const { logAction } = useAuditLog();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [rejectItem, setRejectItem] = useState<ContentItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [materialReview, setMaterialReview] = useState<ContentItem | null>(null);
  const { toast } = useToast();

  const fetchContent = async () => {
    setLoading(true);
    const [lessonsRes, examsRes, profilesRes] = await Promise.all([
      supabase.from("lessons").select("id, title, description, published, admin_approved, platform_percentage, teacher_id, created_at, price"),
      supabase.from("exam_solutions").select("id, title, description, published, admin_approved, platform_percentage, teacher_id, created_at, price"),
      supabase.from("profiles").select("user_id, name, email"),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, { name: p.name, email: p.email }]));

    const lessons: ContentItem[] = (lessonsRes.data || []).map((l) => ({
      ...l,
      type: "lesson" as const,
      teacher_name: profileMap.get(l.teacher_id)?.name || "Desconhecido",
      teacher_email: profileMap.get(l.teacher_id)?.email || "",
    }));

    const exams: ContentItem[] = (examsRes.data || []).map((e) => ({
      ...e,
      type: "exam_solution" as const,
      teacher_name: profileMap.get(e.teacher_id)?.name || "Desconhecido",
      teacher_email: profileMap.get(e.teacher_id)?.email || "",
    }));

    setItems([...lessons, ...exams].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  };

  useEffect(() => { fetchContent(); }, []);

  const sendDecisionEmail = async (item: ContentItem, approved: boolean, reason?: string) => {
    if (!item.teacher_email) return;

    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: approved ? "content-approved" : "content-rejected",
        recipientEmail: item.teacher_email,
        idempotencyKey: `content-${approved ? "approved" : "rejected"}-${item.type}-${item.id}-${Date.now()}`,
        templateData: {
          teacherName: item.teacher_name || "",
          contentTitle: item.title,
          contentType: item.type,
          ...(reason ? { rejectionReason: reason } : {}),
        },
      },
    });

    if (error) {
      console.error("Erro ao enviar e-mail de moderação:", error);
    }
  };

  const handleApprove = async (item: ContentItem) => {
    const table = item.type === "lesson" ? "lessons" : "exam_solutions";
    const { error } = await supabase
      .from(table)
      .update({ published: true, admin_approved: true })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao aprovar conteúdo.", variant: "destructive" });
      return;
    }

    await sendDecisionEmail(item, true);
    await logAction("content_approved", { targetTable: table, targetId: item.id, metadata: { title: item.title } });
    toast({ title: "Aprovado", description: `"${item.title}" foi aprovado e publicado.` });
    fetchContent();
  };

  const handleReject = async (item: ContentItem, reason: string) => {
    const table = item.type === "lesson" ? "lessons" : "exam_solutions";
    const { error } = await supabase
      .from(table)
      .update({ published: false, admin_approved: false })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao rejeitar conteúdo.", variant: "destructive" });
      return;
    }

    await sendDecisionEmail(item, false, reason);
    await logAction("content_rejected", { targetTable: table, targetId: item.id, metadata: { title: item.title, reason } });
    toast({ title: "Rejeitado", description: `"${item.title}" foi rejeitado e voltou para rascunho.` });
    setRejectItem(null);
    setRejectReason("");
    fetchContent();
  };

  const handleRevoke = async (item: ContentItem) => {
    const table = item.type === "lesson" ? "lessons" : "exam_solutions";
    const { error } = await supabase
      .from(table)
      .update({ admin_approved: false })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao revogar aprovação.", variant: "destructive" });
      return;
    }

    await logAction("content_revoked", { targetTable: table, targetId: item.id, metadata: { title: item.title } });
    toast({ title: "Aprovação revogada", description: `"${item.title}" voltou para pendente.` });
    fetchContent();
  };

  const handlePercentageChange = async (item: ContentItem, percentage: number) => {
    const table = item.type === "lesson" ? "lessons" : "exam_solutions";
    const { error } = await supabase
      .from(table)
      .update({ platform_percentage: percentage })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar percentual.", variant: "destructive" });
    } else {
      toast({ title: "Atualizado", description: `Percentual da plataforma: ${percentage}%` });
      fetchContent();
    }
  };

  const filtered = items.filter((i) => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) || (i.teacher_name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" 
      || (filterStatus === "pending" && i.published && !i.admin_approved)
      || (filterStatus === "approved" && i.admin_approved)
      || (filterStatus === "draft" && !i.published);
    const matchType = filterType === "all" || filterType === i.type;
    return matchSearch && matchStatus && matchType;
  });

  const pendingCount = items.filter((i) => i.published && !i.admin_approved).length;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
        <Video className="h-5 w-5" /> Aprovação de Conteúdos
      </h2>
      {pendingCount > 0 && (
        <p className="text-sm text-accent font-medium mb-4">{pendingCount} conteúdo(s) aguardando aprovação</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título ou professor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="lesson">Aulas</SelectItem>
            <SelectItem value="exam_solution">Resoluções</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Professor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>% Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={`${item.type}-${item.id}`}>
                  <TableCell className="font-medium max-w-[200px] truncate">{item.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.teacher_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={item.type === "lesson" ? "border-primary/30 text-primary" : "border-accent/30 text-accent"}>
                      {item.type === "lesson" ? <><Video className="h-3 w-3 mr-1" />Aula</> : <><FileText className="h-3 w-3 mr-1" />Resolução</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.price ? `R$ ${Number(item.price).toFixed(2)}` : "Grátis"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(item.platform_percentage || 30)}
                      onValueChange={(val) => handlePercentageChange(item, Number(val))}
                    >
                      <SelectTrigger className="w-[80px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 15, 20, 25, 30, 35, 40, 50].map((p) => (
                          <SelectItem key={p} value={String(p)}>{p}%</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {!item.published ? (
                      <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>
                    ) : item.admin_approved ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-500">Aprovado</Badge>
                    ) : (
                      <Badge variant="outline" className="border-accent/30 text-accent">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => navigate(`/video/${item.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> Assistir
                      </Button>
                      {item.type === "lesson" && (
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setMaterialReview(item)}>
                          <Layers className="h-4 w-4 mr-1" /> Materiais
                        </Button>
                      )}
                      {item.published && !item.admin_approved && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-green-500 hover:text-green-400" onClick={() => handleApprove(item)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => { setRejectItem(item); setRejectReason(""); }}>
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
                      {item.admin_approved && (
                        <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => handleRevoke(item)}>
                          <XCircle className="h-4 w-4 mr-1" /> Revogar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum conteúdo encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={!!rejectItem} onOpenChange={(open) => { if (!open) { setRejectItem(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar conteúdo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Explique ao professor o motivo da rejeição de <strong>"{rejectItem?.title}"</strong>. Esta observação será enviada por e-mail.
          </p>
          <Textarea
            placeholder="Descreva os pontos que precisam ser corrigidos..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectItem(null); setRejectReason(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()} onClick={() => rejectItem && handleReject(rejectItem, rejectReason.trim())}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {materialReview && (
        <MaterialReviewDrawer
          open={!!materialReview}
          onClose={() => setMaterialReview(null)}
          lessonId={materialReview.id}
          lessonTitle={materialReview.title}
          onChanged={fetchContent}
        />
      )}
    </div>
  );
};

export default AdminContentTab;
