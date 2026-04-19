import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Eye, Star, Plus, Pencil, CheckCircle2, Download, X, RefreshCw, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface TeacherMetrics {
  teacher_id: string;
  teacher_name: string;
  pix_key: string;
  total_views: number;
  avg_rating: number;
  total_purchases: number;
  total_revenue: number;
}

interface Payment {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  period_start: string;
  period_end: string;
  payment_type: string;
  total_views: number;
  avg_rating: number;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  notes?: string | null;
}

const AdminPaymentsTab = () => {
  const [metrics, setMetrics] = useState<TeacherMetrics[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"metrics" | "payments" | "runs">("metrics");
  const [runs, setRuns] = useState<any[]>([]);
  const { toast } = useToast();

  // New payment form state
  const [newPayment, setNewPayment] = useState({
    teacher_id: "",
    period_start: "",
    period_end: "",
    payment_type: "subscription",
    gross_amount: "",
    platform_fee: "",
    net_amount: "",
    notes: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    period_start: "",
    period_end: "",
    payment_type: "subscription",
    gross_amount: "",
    platform_fee: "",
    net_amount: "",
    status: "pending",
    notes: "",
  });

  // Filters
  const [filterTeacherId, setFilterTeacherId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);

    const [profilesRes, viewsRes, ratingsRes, purchasesRes, paymentsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, name, pix_key"),
      supabase.from("video_views").select("content_id, content_type, user_id"),
      supabase.from("video_ratings").select("content_id, content_type, rating"),
      supabase.from("video_purchases").select("content_id, content_type, amount, user_id"),
      supabase.from("teacher_payments").select("*").order("created_at", { ascending: false }),
    ]);

    const profiles = profilesRes.data || [];
    const profileMap = new Map(profiles.map((p) => [p.user_id, p.name]));
    const pixMap = new Map(profiles.map((p) => [p.user_id, (p as any).pix_key || ""]));

    // Get all teachers
    const { data: teacherRoles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
    const teacherIds = (teacherRoles || []).map((t) => t.user_id);

    // Get lessons and exam_solutions to map content to teachers
    const [lessonsRes, examsRes] = await Promise.all([
      supabase.from("lessons").select("id, teacher_id"),
      supabase.from("exam_solutions").select("id, teacher_id"),
    ]);

    const contentTeacherMap = new Map<string, string>();
    (lessonsRes.data || []).forEach((l) => contentTeacherMap.set(l.id, l.teacher_id));
    (examsRes.data || []).forEach((e) => contentTeacherMap.set(e.id, e.teacher_id));

    // Build metrics per teacher
    const metricsMap = new Map<string, TeacherMetrics>();
    teacherIds.forEach((tid) => {
      metricsMap.set(tid, {
        teacher_id: tid,
        teacher_name: profileMap.get(tid) || "Desconhecido",
        pix_key: pixMap.get(tid) || "",
        total_views: 0,
        avg_rating: 0,
        total_purchases: 0,
        total_revenue: 0,
      });
    });

    // Count views per teacher
    (viewsRes.data || []).forEach((v) => {
      const teacherId = contentTeacherMap.get(v.content_id);
      if (teacherId && metricsMap.has(teacherId)) {
        metricsMap.get(teacherId)!.total_views++;
      }
    });

    // Calculate avg rating per teacher
    const ratingsPerTeacher = new Map<string, number[]>();
    (ratingsRes.data || []).forEach((r) => {
      const teacherId = contentTeacherMap.get(r.content_id);
      if (teacherId) {
        if (!ratingsPerTeacher.has(teacherId)) ratingsPerTeacher.set(teacherId, []);
        ratingsPerTeacher.get(teacherId)!.push(r.rating);
      }
    });
    ratingsPerTeacher.forEach((ratings, teacherId) => {
      if (metricsMap.has(teacherId)) {
        metricsMap.get(teacherId)!.avg_rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      }
    });

    // Count purchases and revenue per teacher
    (purchasesRes.data || []).forEach((p) => {
      const teacherId = contentTeacherMap.get(p.content_id);
      if (teacherId && metricsMap.has(teacherId)) {
        metricsMap.get(teacherId)!.total_purchases++;
        metricsMap.get(teacherId)!.total_revenue += Number(p.amount);
      }
    });

    setMetrics(Array.from(metricsMap.values()).sort((a, b) => b.total_views - a.total_views));

    // Payments
    const paymentsList = (paymentsRes.data || []).map((p) => ({
      ...p,
      teacher_name: profileMap.get(p.teacher_id) || "Desconhecido",
    }));
    setPayments(paymentsList);
    setLoading(false);
  };

  const fetchRuns = async () => {
    const { data } = await supabase
      .from("recompute_runs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRuns(data || []);
  };

  useEffect(() => { fetchData(); fetchRuns(); }, []);

  const handleCreatePayment = async () => {
    const { error } = await supabase.from("teacher_payments").insert({
      teacher_id: newPayment.teacher_id,
      period_start: newPayment.period_start,
      period_end: newPayment.period_end,
      payment_type: newPayment.payment_type,
      gross_amount: Number(newPayment.gross_amount),
      platform_fee: Number(newPayment.platform_fee),
      net_amount: Number(newPayment.net_amount),
      total_views: 0,
      avg_rating: 0,
      notes: newPayment.notes || null,
    });

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar pagamento.", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Pagamento registrado." });
      setDialogOpen(false);
      setNewPayment({ teacher_id: "", period_start: "", period_end: "", payment_type: "subscription", gross_amount: "", platform_fee: "", net_amount: "", notes: "" });
      fetchData();
    }
  };

  const sendPaidEmail = async (payment: Payment) => {
    try {
      // Fetch teacher email + pix
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, name, pix_key")
        .eq("user_id", payment.teacher_id)
        .maybeSingle();

      if (!profile?.email) {
        console.warn("Professor sem e-mail cadastrado, não enviando notificação", payment.teacher_id);
        return;
      }

      const fmt = (n: number) =>
        n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "teacher-payment-paid",
          recipientEmail: profile.email,
          idempotencyKey: `teacher-payment-paid-${payment.id}`,
          templateData: {
            name: profile.name || payment.teacher_name,
            periodStart: fmtDate(payment.period_start),
            periodEnd: fmtDate(payment.period_end),
            paymentType: payment.payment_type === "subscription" ? "Assinatura" : "Compra Unitária",
            grossAmount: fmt(Number(payment.gross_amount) || 0),
            platformFee: fmt(Number(payment.platform_fee) || 0),
            netAmount: fmt(Number(payment.net_amount) || 0),
            pixKey: profile.pix_key || "",
            notes: payment.notes || "",
          },
        },
      });
    } catch (err) {
      console.error("Falha ao enviar e-mail de pagamento ao professor", err);
    }
  };

  const handleStatusChange = async (paymentId: string, status: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    const wasPaid = payment?.status === "paid";

    const { error } = await supabase.from("teacher_payments").update({ status }).eq("id", paymentId);
    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
      return;
    }

    toast({ title: "Atualizado", description: `Status alterado para ${status}.` });

    // Send email only on transition to paid
    if (status === "paid" && !wasPaid && payment) {
      await sendPaidEmail({ ...payment, status: "paid" });
      toast({ title: "E-mail enviado", description: "Notificação de pagamento enviada ao professor." });
    }

    fetchData();
  };

  const openEditDialog = (p: Payment) => {
    setEditingPayment(p);
    setEditForm({
      period_start: p.period_start?.slice(0, 10) || "",
      period_end: p.period_end?.slice(0, 10) || "",
      payment_type: p.payment_type || "subscription",
      gross_amount: String(p.gross_amount ?? ""),
      platform_fee: String(p.platform_fee ?? ""),
      net_amount: String(p.net_amount ?? ""),
      status: p.status || "pending",
      notes: p.notes || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingPayment) return;
    const wasPaid = editingPayment.status === "paid";

    const { error } = await supabase
      .from("teacher_payments")
      .update({
        period_start: editForm.period_start,
        period_end: editForm.period_end,
        payment_type: editForm.payment_type,
        gross_amount: Number(editForm.gross_amount) || 0,
        platform_fee: Number(editForm.platform_fee) || 0,
        net_amount: Number(editForm.net_amount) || 0,
        status: editForm.status,
        notes: editForm.notes || null,
      })
      .eq("id", editingPayment.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar pagamento.", variant: "destructive" });
      return;
    }

    toast({ title: "Atualizado", description: "Pagamento atualizado com sucesso." });

    if (editForm.status === "paid" && !wasPaid) {
      await sendPaidEmail({
        ...editingPayment,
        period_start: editForm.period_start,
        period_end: editForm.period_end,
        payment_type: editForm.payment_type,
        gross_amount: Number(editForm.gross_amount) || 0,
        platform_fee: Number(editForm.platform_fee) || 0,
        net_amount: Number(editForm.net_amount) || 0,
        notes: editForm.notes,
        status: "paid",
      });
      toast({ title: "E-mail enviado", description: "Notificação de pagamento enviada ao professor." });
    }

    setEditingPayment(null);
    fetchData();
  };

  const handleMarkPaid = async (paymentId: string) => {
    await handleStatusChange(paymentId, "paid");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "border-accent/30 text-accent",
      paid: "border-success/30 text-success",
      cancelled: "border-destructive/30 text-destructive",
    };
    const labels: Record<string, string> = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
    return <Badge variant="outline" className={map[status] || ""}>{labels[status] || status}</Badge>;
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (filterTeacherId !== "all" && p.teacher_id !== filterTeacherId) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterStart && p.period_end && p.period_end < filterStart) return false;
      if (filterEnd && p.period_start && p.period_start > filterEnd) return false;
      return true;
    });
  }, [payments, filterTeacherId, filterStatus, filterStart, filterEnd]);

  const totals = useMemo(() => {
    return filteredPayments.reduce(
      (acc, p) => {
        acc.gross += Number(p.gross_amount) || 0;
        acc.fee += Number(p.platform_fee) || 0;
        acc.net += Number(p.net_amount) || 0;
        return acc;
      },
      { gross: 0, fee: 0, net: 0 }
    );
  }, [filteredPayments]);

  const handleExportCSV = () => {
    const headers = [
      "Professor",
      "Início do Período",
      "Fim do Período",
      "Tipo",
      "Bruto (R$)",
      "Taxa (R$)",
      "Líquido (R$)",
      "Status",
      "Observações",
      "Criado em",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");
    const fmtNum = (n: number) => n.toFixed(2).replace(".", ",");
    const statusLabel: Record<string, string> = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
    const typeLabel: Record<string, string> = { subscription: "Assinatura", purchase: "Compra Unitária" };

    const rows = filteredPayments.map((p) => [
      p.teacher_name || "",
      fmtDate(p.period_start),
      fmtDate(p.period_end),
      typeLabel[p.payment_type] || p.payment_type,
      fmtNum(Number(p.gross_amount) || 0),
      fmtNum(Number(p.platform_fee) || 0),
      fmtNum(Number(p.net_amount) || 0),
      statusLabel[p.status] || p.status,
      p.notes || "",
      fmtDate(p.created_at),
    ]);

    const csv = [headers, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
    // UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `pagamentos-professores-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Exportado", description: `${filteredPayments.length} pagamento(s) exportado(s).` });
  };

  const clearFilters = () => {
    setFilterTeacherId("all");
    setFilterStatus("all");
    setFilterStart("");
    setFilterEnd("");
  };

  const hasActiveFilters =
    filterTeacherId !== "all" || filterStatus !== "all" || filterStart !== "" || filterEnd !== "";

  // Recompute dialog state
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [recomputeTeacherId, setRecomputeTeacherId] = useState<string>("all");
  const [recomputeStart, setRecomputeStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  });
  const [recomputeEnd, setRecomputeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [recomputeLoading, setRecomputeLoading] = useState(false);

  const handleRecompute = async (dryRun: boolean) => {
    if (!recomputeStart || !recomputeEnd) {
      toast({ title: "Datas obrigatórias", description: "Informe início e fim do período.", variant: "destructive" });
      return;
    }
    if (recomputeStart > recomputeEnd) {
      toast({ title: "Período inválido", description: "Data inicial deve ser anterior à final.", variant: "destructive" });
      return;
    }
    setRecomputeLoading(true);
    const body: Record<string, unknown> = {
      period_start: recomputeStart,
      period_end: recomputeEnd,
      dry_run: dryRun,
    };
    if (recomputeTeacherId !== "all") body.teacher_id = recomputeTeacherId;

    const { data, error } = await supabase.functions.invoke("recompute-teacher-payments", { body });
    setRecomputeLoading(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Erro",
        description: (data as any)?.error || error?.message || "Falha ao recalcular.",
        variant: "destructive",
      });
      return;
    }
    const d = data as any;
    const updated = d.results.filter((r: any) => r.action === "updated").length;
    const inserted = d.results.filter((r: any) => r.action === "inserted").length;
    const skipped = d.results.filter((r: any) => r.action === "skipped_paid").length;
    const preview = d.results.filter((r: any) => r.action === "preview").length;

    toast({
      title: dryRun ? "Pré-visualização" : "Recálculo concluído",
      description: dryRun
        ? `${d.purchases_processed} compras em ${preview} período(s) seriam processadas. Use "Confirmar" para aplicar.`
        : `${d.purchases_processed} compras em ${d.buckets} período(s). Atualizado: ${updated}, criado: ${inserted}, ignorado (pago): ${skipped}.`,
    });

    if (!dryRun) {
      setRecomputeOpen(false);
      fetchData();
    }
    fetchRuns();
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5" /> Pagamentos de Professores
      </h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button size="sm" variant={activeView === "metrics" ? "default" : "outline"} onClick={() => setActiveView("metrics")}>
          <TrendingUp className="h-4 w-4 mr-1" /> Métricas
        </Button>
        <Button size="sm" variant={activeView === "payments" ? "default" : "outline"} onClick={() => setActiveView("payments")}>
          <DollarSign className="h-4 w-4 mr-1" /> Pagamentos
        </Button>
        <Button size="sm" variant={activeView === "runs" ? "default" : "outline"} onClick={() => setActiveView("runs")}>
          <History className="h-4 w-4 mr-1" /> Histórico de Recálculos
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRecomputeOpen(true)}
          className="ml-auto"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Recalcular a partir de compras reais
        </Button>
      </div>

      <Dialog open={recomputeOpen} onOpenChange={setRecomputeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recalcular pagamentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Professor</Label>
              <Select value={recomputeTeacherId} onValueChange={setRecomputeTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os professores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os professores</SelectItem>
                  {metrics.map((m) => (
                    <SelectItem key={m.teacher_id} value={m.teacher_id}>
                      {m.teacher_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={recomputeStart} onChange={(e) => setRecomputeStart(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={recomputeEnd} onChange={(e) => setRecomputeEnd(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Calcula pagamentos a partir das compras reais usando preços por recurso e % da plataforma.
              Pagamentos já marcados como pagos não são alterados.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRecomputeOpen(false)} disabled={recomputeLoading}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => handleRecompute(true)} disabled={recomputeLoading}>
              Pré-visualizar
            </Button>
            <Button onClick={() => handleRecompute(false)} disabled={recomputeLoading}>
              {recomputeLoading ? "Processando..." : "Confirmar recálculo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : activeView === "metrics" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professor</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead className="text-center"><Eye className="h-4 w-4 inline mr-1" />Views</TableHead>
                <TableHead className="text-center"><Star className="h-4 w-4 inline mr-1" />Avaliação</TableHead>
                <TableHead className="text-center">Compras</TableHead>
                <TableHead className="text-right">Receita Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.teacher_id}>
                  <TableCell className="font-medium">{m.teacher_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{m.pix_key || <span className="text-destructive">Não informado</span>}</TableCell>
                  <TableCell className="text-center">{m.total_views}</TableCell>
                  <TableCell className="text-center">{m.avg_rating > 0 ? m.avg_rating.toFixed(1) : "—"}</TableCell>
                  <TableCell className="text-center">{m.total_purchases}</TableCell>
                  <TableCell className="text-right font-medium">R$ {m.total_revenue.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {metrics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum professor encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Registrar Pagamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Pagamento</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Professor</Label>
                    <Select value={newPayment.teacher_id} onValueChange={(val) => setNewPayment((p) => ({ ...p, teacher_id: val }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {metrics.map((m) => (
                          <SelectItem key={m.teacher_id} value={m.teacher_id}>{m.teacher_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Início do Período</Label>
                      <Input type="date" value={newPayment.period_start} onChange={(e) => setNewPayment((p) => ({ ...p, period_start: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Fim do Período</Label>
                      <Input type="date" value={newPayment.period_end} onChange={(e) => setNewPayment((p) => ({ ...p, period_end: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={newPayment.payment_type} onValueChange={(val) => setNewPayment((p) => ({ ...p, payment_type: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subscription">Assinatura</SelectItem>
                        <SelectItem value="purchase">Compra Unitária</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Valor Bruto (R$)</Label>
                      <Input type="number" value={newPayment.gross_amount} onChange={(e) => setNewPayment((p) => ({ ...p, gross_amount: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Taxa Plataforma (R$)</Label>
                      <Input type="number" value={newPayment.platform_fee} onChange={(e) => setNewPayment((p) => ({ ...p, platform_fee: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Valor Líquido (R$)</Label>
                      <Input type="number" value={newPayment.net_amount} onChange={(e) => setNewPayment((p) => ({ ...p, net_amount: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input value={newPayment.notes} onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <Button onClick={handleCreatePayment} disabled={!newPayment.teacher_id || !newPayment.period_start || !newPayment.period_end}>
                    Registrar Pagamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="rounded-lg border border-border p-3 mb-4 bg-card/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Professor</Label>
                <Select value={filterTeacherId} onValueChange={setFilterTeacherId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {metrics.map((m) => (
                      <SelectItem key={m.teacher_id} value={m.teacher_id}>{m.teacher_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Período de</Label>
                <Input type="date" className="h-9" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Período até</Label>
                <Input type="date" className="h-9" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" className="h-9" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-9" onClick={handleExportCSV} disabled={filteredPayments.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Registros</p>
                <p className="font-semibold">{filteredPayments.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bruto total</p>
                <p className="font-semibold">R$ {totals.gross.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa total</p>
                <p className="font-semibold text-muted-foreground">R$ {totals.fee.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Líquido total</p>
                <p className="font-semibold text-success">R$ {totals.net.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Professor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.teacher_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.period_start).toLocaleDateString("pt-BR")} — {new Date(p.period_end).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.payment_type === "subscription" ? "Assinatura" : "Compra"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">R$ {Number(p.gross_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">R$ {Number(p.platform_fee).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(p.net_amount).toFixed(2)}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleMarkPaid(p.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pago
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => openEditDialog(p)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Select value={p.status} onValueChange={(val) => handleStatusChange(p.id, val)}>
                          <SelectTrigger className="w-[110px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="paid">Pago</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {payments.length === 0 ? "Nenhum pagamento registrado." : "Nenhum pagamento corresponde aos filtros."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-sm text-muted-foreground">
              Professor: <span className="font-medium text-foreground">{editingPayment?.teacher_name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início do Período</Label>
                <Input type="date" value={editForm.period_start} onChange={(e) => setEditForm((p) => ({ ...p, period_start: e.target.value }))} />
              </div>
              <div>
                <Label>Fim do Período</Label>
                <Input type="date" value={editForm.period_end} onChange={(e) => setEditForm((p) => ({ ...p, period_end: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={editForm.payment_type} onValueChange={(val) => setEditForm((p) => ({ ...p, payment_type: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Assinatura</SelectItem>
                    <SelectItem value="purchase">Compra Unitária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm((p) => ({ ...p, status: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Bruto (R$)</Label>
                <Input type="number" value={editForm.gross_amount} onChange={(e) => setEditForm((p) => ({ ...p, gross_amount: e.target.value }))} />
              </div>
              <div>
                <Label>Taxa (R$)</Label>
                <Input type="number" value={editForm.platform_fee} onChange={(e) => setEditForm((p) => ({ ...p, platform_fee: e.target.value }))} />
              </div>
              <div>
                <Label>Líquido (R$)</Label>
                <Input type="number" value={editForm.net_amount} onChange={(e) => setEditForm((p) => ({ ...p, net_amount: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPayment(null)}>Cancelar</Button>
              <Button onClick={handleEditSave}>Salvar alterações</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentsTab;
