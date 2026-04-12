import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";

interface KpiDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiKey: string;
  title: string;
}

const KpiDetailDialog = ({ open, onOpenChange, kpiKey, title }: KpiDetailDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (open) fetchDetail();
  }, [open, kpiKey]);

  const fetchDetail = async () => {
    setLoading(true);
    let result: any[] = [];

    switch (kpiKey) {
      case "users": {
        const [{ data: roles }, { data: profiles }] = await Promise.all([
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("profiles").select("user_id, name, email, created_at, active"),
        ]);
        const roleMap: Record<string, string[]> = {};
        roles?.forEach((r) => {
          if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
          roleMap[r.user_id].push(r.role);
        });
        result = (profiles ?? []).map((p) => ({
          name: p.name,
          email: p.email,
          roles: (roleMap[p.user_id] ?? []).join(", "),
          active: p.active,
          created_at: new Date(p.created_at).toLocaleDateString("pt-BR"),
        }));
        break;
      }
      case "pending_content": {
        const [{ data: lessons }, { data: exams }] = await Promise.all([
          supabase.from("lessons").select("id, title, created_at, teacher_id").eq("published", true).eq("admin_approved", false),
          supabase.from("exam_solutions").select("id, title, created_at, teacher_id").eq("published", true).eq("admin_approved", false),
        ]);
        const teacherIds = [...new Set([...(lessons ?? []).map(l => l.teacher_id), ...(exams ?? []).map(e => e.teacher_id)])];
        const { data: teacherProfiles } = await supabase.from("profiles").select("user_id, name").in("user_id", teacherIds);
        const nameMap: Record<string, string> = {};
        teacherProfiles?.forEach(p => { nameMap[p.user_id] = p.name; });

        result = [
          ...(lessons ?? []).map((l) => ({ tipo: "Aula", title: l.title, professor: nameMap[l.teacher_id] ?? "—", created_at: new Date(l.created_at).toLocaleDateString("pt-BR") })),
          ...(exams ?? []).map((e) => ({ tipo: "Prova", title: e.title, professor: nameMap[e.teacher_id] ?? "—", created_at: new Date(e.created_at).toLocaleDateString("pt-BR") })),
        ];
        break;
      }
      case "revenue": {
        const { data: payments } = await supabase
          .from("teacher_payments")
          .select("teacher_id, gross_amount, net_amount, platform_fee, status, period_start, period_end, payment_type")
          .order("period_start", { ascending: false });
        const teacherIds = [...new Set((payments ?? []).map(p => p.teacher_id))];
        const { data: teacherProfiles } = await supabase.from("profiles").select("user_id, name").in("user_id", teacherIds);
        const nameMap: Record<string, string> = {};
        teacherProfiles?.forEach(p => { nameMap[p.user_id] = p.name; });

        result = (payments ?? []).map((p) => ({
          professor: nameMap[p.teacher_id] ?? "—",
          bruto: `R$ ${Number(p.gross_amount).toFixed(2)}`,
          liquido: `R$ ${Number(p.net_amount).toFixed(2)}`,
          taxa: `R$ ${Number(p.platform_fee).toFixed(2)}`,
          status: p.status,
          periodo: `${new Date(p.period_start).toLocaleDateString("pt-BR")} — ${new Date(p.period_end).toLocaleDateString("pt-BR")}`,
        }));
        break;
      }
      case "views": {
        const { data: views } = await supabase
          .from("video_views")
          .select("content_id, content_type, user_id, viewed_at, watch_percentage")
          .order("viewed_at", { ascending: false })
          .limit(100);
        const userIds = [...new Set((views ?? []).map(v => v.user_id))];
        const { data: userProfiles } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
        const nameMap: Record<string, string> = {};
        userProfiles?.forEach(p => { nameMap[p.user_id] = p.name; });

        // Get content titles
        const lessonIds = (views ?? []).filter(v => v.content_type === "lesson").map(v => v.content_id);
        const examIds = (views ?? []).filter(v => v.content_type === "exam_solution").map(v => v.content_id);
        const [{ data: lessonTitles }, { data: examTitles }] = await Promise.all([
          lessonIds.length > 0 ? supabase.from("lessons").select("id, title").in("id", lessonIds) : { data: [] },
          examIds.length > 0 ? supabase.from("exam_solutions").select("id, title").in("id", examIds) : { data: [] },
        ]);
        const titleMap: Record<string, string> = {};
        lessonTitles?.forEach(l => { titleMap[l.id] = l.title; });
        examTitles?.forEach(e => { titleMap[e.id] = e.title; });

        result = (views ?? []).map((v) => ({
          usuario: nameMap[v.user_id] ?? "—",
          conteudo: titleMap[v.content_id] ?? v.content_id?.substring(0, 8) + "...",
          tipo: v.content_type === "lesson" ? "Aula" : "Prova",
          progresso: `${v.watch_percentage}%`,
          data: new Date(v.viewed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }),
        }));
        break;
      }
      case "pending_payments": {
        const { data: payments } = await supabase
          .from("teacher_payments")
          .select("teacher_id, gross_amount, net_amount, platform_fee, period_start, period_end")
          .eq("status", "pending")
          .order("period_start", { ascending: false });
        const teacherIds = [...new Set((payments ?? []).map(p => p.teacher_id))];
        const { data: teacherProfiles } = await supabase.from("profiles").select("user_id, name").in("user_id", teacherIds);
        const nameMap: Record<string, string> = {};
        teacherProfiles?.forEach(p => { nameMap[p.user_id] = p.name; });

        result = (payments ?? []).map((p) => ({
          professor: nameMap[p.teacher_id] ?? "—",
          bruto: `R$ ${Number(p.gross_amount).toFixed(2)}`,
          liquido: `R$ ${Number(p.net_amount).toFixed(2)}`,
          taxa: `R$ ${Number(p.platform_fee).toFixed(2)}`,
          periodo: `${new Date(p.period_start).toLocaleDateString("pt-BR")} — ${new Date(p.period_end).toLocaleDateString("pt-BR")}`,
        }));
        break;
      }
      case "avg_rating": {
        const { data: ratings } = await supabase
          .from("video_ratings")
          .select("content_id, content_type, rating, comment, user_id, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        const userIds = [...new Set((ratings ?? []).map(r => r.user_id))];
        const { data: userProfiles } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
        const nameMap: Record<string, string> = {};
        userProfiles?.forEach(p => { nameMap[p.user_id] = p.name; });

        const lessonIds = (ratings ?? []).filter(r => r.content_type === "lesson").map(r => r.content_id);
        const examIds = (ratings ?? []).filter(r => r.content_type === "exam_solution").map(r => r.content_id);
        const [{ data: lessonTitles }, { data: examTitles }] = await Promise.all([
          lessonIds.length > 0 ? supabase.from("lessons").select("id, title").in("id", lessonIds) : { data: [] },
          examIds.length > 0 ? supabase.from("exam_solutions").select("id, title").in("id", examIds) : { data: [] },
        ]);
        const titleMap: Record<string, string> = {};
        lessonTitles?.forEach(l => { titleMap[l.id] = l.title; });
        examTitles?.forEach(e => { titleMap[e.id] = e.title; });

        result = (ratings ?? []).map((r) => ({
          usuario: nameMap[r.user_id] ?? "—",
          conteudo: titleMap[r.content_id] ?? r.content_id?.substring(0, 8) + "...",
          nota: `${r.rating} ★`,
          comentario: r.comment || "—",
          data: new Date(r.created_at).toLocaleDateString("pt-BR"),
        }));
        break;
      }
      case "unsubscribed": {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("name, email, updated_at")
          .eq("accepts_marketing", false)
          .order("updated_at", { ascending: false });
        result = (profiles ?? []).map((p) => ({
          nome: p.name,
          email: p.email,
          data: new Date(p.updated_at).toLocaleDateString("pt-BR"),
        }));
        break;
      }
    }

    setData(result);
    setLoading(false);
  };

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  const columnLabels: Record<string, string> = {
    name: "Nome", email: "E-mail", roles: "Papéis", active: "Ativo", created_at: "Cadastro",
    tipo: "Tipo", title: "Título", professor: "Professor", conteudo: "Conteúdo",
    bruto: "Bruto", liquido: "Líquido", taxa: "Taxa Plataforma", status: "Status", periodo: "Período",
    usuario: "Usuário", progresso: "Progresso", data: "Data", nota: "Nota", comentario: "Comentário",
    nome: "Nome",
  };

  const renderCell = (col: string, value: any) => {
    if (col === "active") return <Badge variant={value ? "default" : "destructive"}>{value ? "Sim" : "Não"}</Badge>;
    if (col === "status") {
      const statusColors: Record<string, string> = { pending: "bg-yellow-500/20 text-yellow-400", paid: "bg-green-500/20 text-green-400", cancelled: "bg-red-500/20 text-red-400" };
      return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[value] ?? "bg-muted text-muted-foreground"}`}>{value}</span>;
    }
    return <span className="text-sm">{String(value ?? "—")}</span>;
  };

  const exportCsv = useCallback(() => {
    if (data.length === 0) return;
    const headers = columns.map(c => columnLabels[c] ?? c);
    const rows = data.map(row => columns.map(col => {
      const val = row[col];
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
    }));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, columns, columnLabels, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{title} — Relatório Detalhado</DialogTitle>
            {data.length > 0 && !loading && (
              <Button variant="outline" size="sm" onClick={exportCsv} className="shrink-0">
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro encontrado.</p>
        ) : (
          <ScrollArea className="max-h-[65vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="text-xs whitespace-nowrap">{columnLabels[col] ?? col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col} className="py-2 max-w-[200px] truncate">{renderCell(col, row[col])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.length >= 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">Exibindo os 100 registros mais recentes</p>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KpiDetailDialog;
