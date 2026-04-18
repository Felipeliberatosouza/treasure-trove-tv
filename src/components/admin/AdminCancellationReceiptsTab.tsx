import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Loader2, Search } from "lucide-react";
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

const AdminCancellationReceiptsTab = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [query, setQuery] = useState("");

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

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((it) =>
          (it.studentName ?? "").toLowerCase().includes(q) ||
          (it.studentEmail ?? "").toLowerCase().includes(q) ||
          it.userId.toLowerCase().includes(q),
        )
      : items;
    const map = new Map<string, { name: string | null; email: string | null; userId: string; receipts: ReceiptItem[] }>();
    for (const it of filtered) {
      const g = map.get(it.userId) ?? { name: it.studentName, email: it.studentEmail, userId: it.userId, receipts: [] };
      g.receipts.push(it);
      map.set(it.userId, g);
    }
    return Array.from(map.values()).sort((a, b) => (a.name ?? a.email ?? a.userId).localeCompare(b.name ?? b.email ?? b.userId));
  }, [items, query]);

  const totalReceipts = items.length;

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
          Total: <span className="font-medium text-foreground">{totalReceipts}</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, e-mail ou ID do aluno..."
          className="pl-9"
        />
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
