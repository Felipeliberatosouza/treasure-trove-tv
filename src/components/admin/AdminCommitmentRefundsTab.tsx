import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Receipt, RotateCcw, Search, AlertTriangle, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";

const escapeCsv = (val: string | number | null | undefined) => {
  const s = val == null ? "" : String(val);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

interface RefundRecord {
  id: string;
  user_id: string;
  admin_id: string;
  stripe_subscription_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
  original_penalty_amount: number;
  refund_amount: number;
  refund_type: string;
  reason: string | null;
  status: string;
  created_at: string;
  student_name?: string | null;
  student_email?: string | null;
}

interface StudentOption {
  user_id: string;
  name: string;
  email: string;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
};

const AdminCommitmentRefundsTab = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RefundRecord[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [originalPenalty, setOriginalPenalty] = useState<string>("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: refunds, error: re }, { data: profiles }] = await Promise.all([
        supabase
          .from("commitment_penalty_refunds")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, name, email"),
      ]);
      if (re) throw re;
      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, { name: p.name, email: p.email }])
      );
      const enriched = (refunds ?? []).map((r) => ({
        ...r,
        student_name: profileMap.get(r.user_id)?.name ?? null,
        student_email: profileMap.get(r.user_id)?.email ?? null,
      })) as RefundRecord[];
      setRecords(enriched);
      setStudents(
        (profiles ?? []).map((p) => ({
          user_id: p.user_id,
          name: p.name ?? "",
          email: p.email ?? "",
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar reembolsos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return records.filter((r) => {
      if (q) {
        const matches =
          (r.student_name ?? "").toLowerCase().includes(q) ||
          (r.student_email ?? "").toLowerCase().includes(q) ||
          (r.stripe_refund_id ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (fromTs || toTs) {
        const ts = new Date(r.created_at).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
  }, [records, query, dateFrom, dateTo]);

  const hasFilters = !!(query.trim() || dateFrom || dateTo);

  const clearFilters = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const exportCsv = () => {
    if (filteredRecords.length === 0) {
      toast.error("Nenhum reembolso para exportar");
      return;
    }
    const headers = [
      "Aluno",
      "E-mail",
      "ID do aluno",
      "Data",
      "Multa original (R$)",
      "Reembolsado (R$)",
      "Tipo",
      "Motivo",
      "ID do reembolso",
      "ID da cobrança",
      "ID da assinatura",
      "Status",
    ];
    const rows = filteredRecords.map((r) =>
      [
        escapeCsv(r.student_name ?? ""),
        escapeCsv(r.student_email ?? ""),
        escapeCsv(r.user_id),
        escapeCsv(r.created_at),
        escapeCsv(Number(r.original_penalty_amount).toFixed(2).replace(".", ",")),
        escapeCsv(Number(r.refund_amount).toFixed(2).replace(".", ",")),
        escapeCsv(r.refund_type),
        escapeCsv(r.reason ?? ""),
        escapeCsv(r.stripe_refund_id ?? ""),
        escapeCsv(r.stripe_charge_id ?? ""),
        escapeCsv(r.stripe_subscription_id ?? ""),
        escapeCsv(r.status),
      ].join(";")
    );
    const csv = [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `reembolsos-multa_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      `CSV exportado (${filteredRecords.length} registro${filteredRecords.length > 1 ? "s" : ""})`
    );
  };

  const studentMatches = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [students, studentSearch]);

  const totalRefunded = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0),
    [filteredRecords]
  );

  const resetForm = () => {
    setSelectedStudent(null);
    setStudentSearch("");
    setOriginalPenalty("");
    setRefundAmount("");
    setReason("");
  };

  const submitRefund = async () => {
    if (!selectedStudent) {
      toast.error("Selecione um aluno");
      return;
    }
    const refundNum = Number(refundAmount.replace(",", "."));
    const originalNum = Number(originalPenalty.replace(",", "."));
    if (!refundNum || refundNum <= 0) {
      toast.error("Informe um valor de reembolso válido");
      return;
    }
    if (originalNum > 0 && refundNum > originalNum) {
      toast.error("O reembolso não pode ser maior que a multa original");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe o motivo do reembolso");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "refund-commitment-penalty",
        {
          body: {
            user_id: selectedStudent.user_id,
            refund_amount: refundNum,
            original_penalty_amount: originalNum > 0 ? originalNum : undefined,
            reason: reason.trim(),
          },
        }
      );
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao reembolsar");

      toast.success(
        `Reembolso ${data.refund_type === "total" ? "total" : "parcial"} de ${formatBRL(refundNum)} processado`
      );
      setDialogOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro ao processar reembolso");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" /> Reembolsos de Multa de Permanência
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reembolse parcial ou totalmente multas cobradas no cancelamento. Cada operação é registrada no log de auditoria.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Receipt className="h-4 w-4 mr-1" /> Novo reembolso
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Reembolsos exibidos</div>
          <div className="text-2xl font-display font-bold mt-1">{filteredRecords.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor total reembolsado</div>
          <div className="text-2xl font-display font-bold mt-1 text-primary">
            {formatBRL(totalRefunded)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total no histórico</div>
          <div className="text-2xl font-display font-bold mt-1">{records.length}</div>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-end flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-md">
          <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, e-mail ou ID Stripe..."
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filteredRecords.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : filteredRecords.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum reembolso registrado.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Multa original</TableHead>
                  <TableHead>Reembolsado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>ID do reembolso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.student_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.student_email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      {r.original_penalty_amount > 0 ? formatBRL(Number(r.original_penalty_amount)) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-primary">
                      {formatBRL(Number(r.refund_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.refund_type === "total" ? "default" : "secondary"}>
                        {r.refund_type === "total" ? "Total" : "Parcial"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate" title={r.reason ?? ""}>
                      {r.reason ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.stripe_refund_id ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reembolsar multa de permanência</DialogTitle>
            <DialogDescription>
              O reembolso será processado no provedor de pagamento e registrado no log de auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Aluno</Label>
              {selectedStudent ? (
                <div className="mt-1 flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <div className="text-sm font-medium">{selectedStudent.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedStudent.email}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Buscar aluno por nome ou e-mail..."
                  />
                  {studentMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {studentMatches.map((s) => (
                        <button
                          key={s.user_id}
                          type="button"
                          className="w-full text-left p-2 hover:bg-accent text-sm"
                          onClick={() => {
                            setSelectedStudent(s);
                            setStudentSearch("");
                          }}
                        >
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Multa original (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={originalPenalty}
                  onChange={(e) => setOriginalPenalty(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label>Valor a reembolsar (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {originalPenalty && refundAmount && (
              <div className="text-xs text-muted-foreground">
                Tipo:{" "}
                <span className="font-medium text-foreground">
                  {Number(refundAmount.replace(",", ".")) >=
                  Number(originalPenalty.replace(",", "."))
                    ? "Total"
                    : "Parcial"}
                </span>
              </div>
            )}

            <div>
              <Label>Motivo *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: solicitação do aluno por motivo médico, erro na cobrança, etc."
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                O valor será reembolsado pela última cobrança do aluno e a operação não pode ser desfeita pela plataforma.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={submitRefund} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCommitmentRefundsTab;
