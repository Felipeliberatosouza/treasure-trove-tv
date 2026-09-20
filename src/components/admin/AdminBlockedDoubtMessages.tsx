import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface BlockedMessage {
  id: string;
  doubt_id: string;
  author_id: string | null;
  author_role: string;
  body: string;
  block_reason: string | null;
  block_matches: string[] | null;
  created_at: string;
  author_name?: string;
}

/** Mensagens do chat de dúvidas recusadas pela moderação automática. */
const AdminBlockedDoubtMessages = () => {
  const [rows, setRows] = useState<BlockedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("doubt_messages")
      .select("id, doubt_id, author_id, author_role, body, block_reason, block_matches, created_at")
      .eq("blocked", true)
      .order("created_at", { ascending: false })
      .limit(200);

    const list = (data || []) as BlockedMessage[];
    const ids = [...new Set(list.map((m) => m.author_id).filter(Boolean))] as string[];
    let nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", ids);
      nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.name]));
    }
    setRows(list.map((m) => ({ ...m, author_name: (m.author_id && nameMap.get(m.author_id)) || "—" })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const release = async (m: BlockedMessage) => {
    setActing(m.id);
    const { error } = await supabase
      .from("doubt_messages")
      .update({ blocked: false, status: "approved", block_reason: null })
      .eq("id", m.id);
    setActing(null);
    if (error) return toast.error("Não foi possível liberar a mensagem.");
    toast.success("Mensagem liberada no chat.");
    load();
  };

  return (
    <div className="mt-10">
      <h3 className="font-display text-base font-semibold mb-1 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-destructive" /> Mensagens bloqueadas
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Mensagens recusadas por tentativa de troca de contatos ou linguagem imprópria. Elas não
        aparecem para a outra parte até serem liberadas.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma mensagem bloqueada.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Trechos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.author_name}
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {m.author_role === "student" ? "Aluno" : m.author_role === "teacher" ? "Professor" : "Equipe"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate">{m.body}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-[200px]">{m.block_reason}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                    {(m.block_matches || []).join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" disabled={acting === m.id} onClick={() => release(m)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Liberar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminBlockedDoubtMessages;
