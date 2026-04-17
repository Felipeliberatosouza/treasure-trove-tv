import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Eye, Star, Plus } from "lucide-react";
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
}

const AdminPaymentsTab = () => {
  const [metrics, setMetrics] = useState<TeacherMetrics[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"metrics" | "payments">("metrics");
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

  useEffect(() => { fetchData(); }, []);

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

  const handleStatusChange = async (paymentId: string, status: string) => {
    const { error } = await supabase.from("teacher_payments").update({ status }).eq("id", paymentId);
    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    } else {
      toast({ title: "Atualizado", description: `Status alterado para ${status}.` });
      fetchData();
    }
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

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5" /> Pagamentos de Professores
      </h2>

      <div className="flex gap-2 mb-6">
        <Button size="sm" variant={activeView === "metrics" ? "default" : "outline"} onClick={() => setActiveView("metrics")}>
          <TrendingUp className="h-4 w-4 mr-1" /> Métricas
        </Button>
        <Button size="sm" variant={activeView === "payments" ? "default" : "outline"} onClick={() => setActiveView("payments")}>
          <DollarSign className="h-4 w-4 mr-1" /> Pagamentos
        </Button>
      </div>

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
                {payments.map((p) => (
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
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum pagamento registrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentsTab;
