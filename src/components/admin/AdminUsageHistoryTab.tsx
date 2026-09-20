import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const RESOURCE_LABELS: Record<string, string> = {
  revisao: "Revisão",
  resumo: "Resumo",
  simulado: "Simulado",
  top_questoes: "Top Questões",
  colinha: "Colinha",
  duvida: "Dúvida",
  aula_particular: "Aula Particular",
};

interface UsageRow {
  id: string;
  resource_type: string;
  accessed_at: string;
  duration_seconds: number;
  content_id: string | null;
  content_type: string | null;
  user_id: string;
  profile_name: string;
  profile_email: string;
}

interface StudentOption {
  user_id: string;
  name: string;
  email: string;
}

export default function AdminUsageHistoryTab() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [options, setOptions] = useState<StudentOption[]>([]);
  const [selected, setSelected] = useState<StudentOption | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const loadUsage = async (userId?: string) => {
    setLoading(true);
    let query = supabase
      .from("resource_usage")
      .select("id, resource_type, accessed_at, duration_seconds, content_id, content_type, user_id")
      .order("accessed_at", { ascending: false })
      .limit(500);
    if (userId) query = query.eq("user_id", userId);
    const { data: usage } = await query;

    if (!usage || usage.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(usage.map((u) => u.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email")
      .in("user_id", userIds);

    const profileMap: Record<string, { name: string; email: string }> = {};
    (profiles || []).forEach((p) => {
      profileMap[p.user_id] = { name: p.name, email: p.email };
    });

    setRows(
      usage.map((u) => ({
        ...u,
        profile_name: profileMap[u.user_id]?.name || "—",
        profile_email: profileMap[u.user_id]?.email || "—",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadUsage();
  }, []);

  // Sugestões de alunos atualizadas a cada letra digitada (busca no cadastro completo).
  useEffect(() => {
    const term = search.trim();
    if (selected || term.length < 1) {
      setOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .order("name")
        .limit(8);
      setOptions((data as StudentOption[]) || []);
      setShowOptions(true);
    }, 250);
    return () => clearTimeout(handle);
  }, [search, selected]);

  const pickStudent = (s: StudentOption) => {
    setSelected(s);
    setSearch(s.name);
    setShowOptions(false);
    void loadUsage(s.user_id);
  };

  const clearStudent = () => {
    setSelected(null);
    setSearch("");
    setOptions([]);
    void loadUsage();
  };

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchType = filterType === "all" || r.resource_type === filterType;
        if (selected) return matchType;
        const q = search.trim().toLowerCase();
        const matchSearch =
          !q || r.profile_name.toLowerCase().includes(q) || r.profile_email.toLowerCase().includes(q);
        return matchType && matchSearch;
      }),
    [rows, filterType, search, selected]
  );

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}min ${rem}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4">Histórico de Uso de Recursos</h2>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por aluno..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(null);
            }}
            onFocus={() => setShowOptions(true)}
            className="pl-9 pr-9"
          />
          {(selected || search) && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Limpar busca"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={clearStudent}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {showOptions && !selected && options.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {options.map((o) => (
                <li key={o.user_id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-secondary"
                    onClick={() => pickStudent(o)}
                  >
                    <span className="block text-sm font-medium">{o.name}</span>
                    <span className="block text-xs text-muted-foreground">{o.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todos os recursos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os recursos</SelectItem>
            {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <p className="mb-2 text-xs text-muted-foreground">
          Mostrando o histórico de <strong>{selected.name}</strong> ({selected.email}).
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{r.profile_name}</div>
                    <div className="text-xs text-muted-foreground">{r.profile_email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {RESOURCE_LABELS[r.resource_type] || r.resource_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(r.accessed_at).toLocaleDateString("pt-BR")}{" "}
                    <span className="text-muted-foreground">
                      {new Date(r.accessed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{formatDuration(r.duration_seconds)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
