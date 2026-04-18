import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Loader2, Search, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";

interface ReceiptItem {
  path: string;
  fileName: string;
  userId: string;
  studentName: string | null;
  studentEmail: string | null;
  createdAt: string | null;
  size: number | null;
  signedUrl: string;
}

const formatBytes = (n: number | null) => {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch { return iso; }
};

const escapeCsv = (val: string | number | null | undefined) => {
  const s = val == null ? "" : String(val);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const AdminCancellationReceiptsTab = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-cancellation-receipts");
      if (error) throw error;
      setItems((data?.items ?? []) as ReceiptItem[]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar comprovantes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return items.filter((it) => {
      if (q) {
        const matches =
          (it.studentName ?? "").toLowerCase().includes(q) ||
          (it.studentEmail ?? "").toLowerCase().includes(q) ||
          it.userId.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (fromTs || toTs) {
        if (!it.createdAt) return false;
        const ts = new Date(it.createdAt).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
  }, [items, query, dateFrom, dateTo]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string | null; userId: string; receipts: ReceiptItem[] }>();
    for (const it of filteredItems) {
      const g = map.get(it.userId) ?? { name: it.studentName, email: it.studentEmail, userId: it.userId, receipts: [] };
      g.receipts.push(it);
      map.set(it.userId, g);
    }
    return Array.from(map.values()).sort((a, b) => (a.name ?? a.email ?? a.userId).localeCompare(b.name ?? b.email ?? b.userId));
  }, [filteredItems]);

  const totalReceipts = items.length;
  const filteredCount = filteredItems.length;
  const hasFilters = !!(query.trim() || dateFrom || dateTo);

  const clearFilters = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const exportCsv = () => {
    if (filteredItems.length === 0) {
      toast.error("Nenhum comprovante para exportar");
      return;
    }
    const headers = ["Nome do aluno", "E-mail", "ID do aluno", "Arquivo", "Gerado em", "Tamanho (bytes)", "Link de download"];
    const rows = filteredItems.map((it) => [
      escapeCsv(it.studentName ?? ""),
      escapeCsv(it.studentEmail ?? ""),
      escapeCsv(it.userId),
      escapeCsv(it.fileName),
      escapeCsv(it.createdAt ?? ""),
      escapeCsv(it.size ?? ""),
      escapeCsv(it.signedUrl ?? ""),
    ].join(";"));

    const csv = [headers.join(";"), ...rows].join("\r\n");
    // UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `comprovantes-cancelamento_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`CSV exportado (${filteredItems.length} registro${filteredItems.length > 1 ? "s" : ""})`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Comprovantes de Cancelamento
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Lista de PDFs gerados em cancelamentos de assinatura, agrupados por aluno.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {hasFilters ? (
            <>Exibindo <span className="font-medium text-foreground">{filteredCount}</span> de <span className="font-medium text-foreground">{totalReceipts}</span></>
          ) : (
            <>Total: <span className="font-medium text-foreground">{totalReceipts}</span></>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-end flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, e-mail ou ID do aluno..."
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={filteredItems.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum comprovante encontrado.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <Card key={g.userId} className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="font-medium">{g.name ?? "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground">{g.email ?? "—"} · {g.userId}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {g.receipts.length} comprovante{g.receipts.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Gerado em</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.receipts.map((r) => (
                      <TableRow key={r.path}>
                        <TableCell className="font-mono text-xs">{r.fileName}</TableCell>
                        <TableCell className="text-sm">{formatDate(r.createdAt)}</TableCell>
                        <TableCell className="text-sm">{formatBytes(r.size)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            disabled={!r.signedUrl}
                          >
                            <a href={r.signedUrl} target="_blank" rel="noopener noreferrer" download={r.fileName}>
                              <Download className="h-4 w-4 mr-1" /> Baixar
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCancellationReceiptsTab;
