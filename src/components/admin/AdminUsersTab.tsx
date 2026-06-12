import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, UserCog, UserCheck, UserX, FileSignature, Eye, Download, MailCheck, KeyRound, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

interface UserWithRole {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  referral_code: number | null;
  active: boolean;
  accepts_marketing: boolean;
  contract_signed_at?: string | null;
  contract_expires_at?: string | null;
  contract_status?: string | null;
  contract_text?: string | null;
  contract_signature_name?: string | null;
  contract_signature_cpf?: string | null;
}

const AdminUsersTab = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewContract, setViewContract] = useState<UserWithRole | null>(null);
  const [pwdUser, setPwdUser] = useState<UserWithRole | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, email, created_at, referral_code, active, accepts_marketing");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: contracts } = await supabase.from("teacher_contracts" as any).select("teacher_id, signed_at, expires_at, status, contract_text, signature_name, signature_cpf").eq("status", "active");

    if (profiles && roles) {
      const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
      const contractMap = new Map((contracts as any[] || []).map((c: any) => [c.teacher_id, c]));
      const merged: UserWithRole[] = profiles.map((p) => {
        const contract = contractMap.get(p.user_id) as any;
        return {
          ...p,
          role: roleMap.get(p.user_id) || "student",
          referral_code: p.referral_code ?? null,
          active: p.active ?? true,
          accepts_marketing: p.accepts_marketing ?? false,
          contract_signed_at: contract?.signed_at || null,
          contract_expires_at: contract?.expires_at || null,
          contract_status: contract?.status || null,
          contract_text: contract?.contract_text || null,
          contract_signature_name: contract?.signature_name || null,
          contract_signature_cpf: contract?.signature_cpf || null,
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole as "student" | "teacher" | "admin" })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível alterar o papel.", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Papel do usuário atualizado." });
      fetchUsers();
    }
  };

  const handleToggleActive = async (user: UserWithRole) => {
    const newActive = !user.active;
    const { error } = await supabase
      .from("profiles")
      .update({ active: newActive })
      .eq("user_id", user.user_id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível alterar o status.", variant: "destructive" });
    } else {
      // If deactivating, reserve the referral_code
      if (!newActive && user.referral_code) {
        await supabase.from("reserved_referral_codes" as any).insert({
          referral_code: user.referral_code,
          original_user_email: user.email,
          reason: "deactivated",
        });
      }
      await logAction(newActive ? "user_activated" : "user_deactivated", { targetTable: "profiles", targetId: user.user_id, metadata: { name: user.name, email: user.email } });
      toast({
        title: newActive ? "Ativado" : "Desativado",
        description: `Usuário "${user.name}" foi ${newActive ? "ativado" : "desativado"}.`,
      });
      fetchUsers();
    }
  };

  const handleReactivateEmail = async (user: UserWithRole) => {
    if (!confirm(`Reativar o recebimento de e-mails promocionais para "${user.name}" (${user.email})?`)) return;
    const { error } = await supabase.functions.invoke("reactivate-email-marketing", {
      body: { email: user.email, user_id: user.user_id },
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível reativar os e-mails.", variant: "destructive" });
    } else {
      toast({ title: "Reativado", description: `E-mails promocionais reativados para "${user.name}".` });
      fetchUsers();
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.")) return;

    const res = await supabase.functions.invoke("delete-user", {
      body: { user_id: userId },
    });

    if (res.error) {
      toast({ title: "Erro", description: "Não foi possível remover o usuário.", variant: "destructive" });
    } else {
      const deletedUser = users.find((u) => u.user_id === userId);
      await logAction("user_deleted", { targetTable: "profiles", targetId: userId, metadata: { name: deletedUser?.name, email: deletedUser?.email } });
      toast({ title: "Removido", description: "Usuário removido completamente." });
      fetchUsers();
    }
  };

  const handleSendReset = async (user: UserWithRole) => {
    if (!confirm(`Enviar link de redefinição de senha para "${user.name}" (${user.email})?`)) return;
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível enviar o link.", variant: "destructive" });
    } else {
      await logAction("password_reset_link_sent", { targetTable: "auth.users", targetId: user.user_id, metadata: { email: user.email } });
      toast({ title: "Enviado", description: `Link de redefinição enviado para ${user.email}.` });
    }
  };

  const handleSavePassword = async () => {
    if (!pwdUser) return;
    if (newPwd.length < 6) {
      toast({ title: "Senha curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    const { data, error } = await supabase.functions.invoke("admin-set-user-password", {
      body: { user_id: pwdUser.user_id, new_password: newPwd },
    });
    setSavingPwd(false);
    if (error || (data && (data as any).error)) {
      toast({ title: "Erro", description: (data as any)?.error || "Não foi possível alterar a senha.", variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada", description: `Nova senha definida para "${pwdUser.name}". Informe ao usuário com segurança.` });
    setPwdUser(null);
    setNewPwd("");
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" && u.active) || (filterStatus === "inactive" && !u.active);
    return matchSearch && matchRole && matchStatus;
  });

  const roleBadge = (role: string) => {
    const variants: Record<string, string> = {
      admin: "bg-destructive/20 text-destructive border-destructive/30",
      teacher: "bg-primary/20 text-primary border-primary/30",
      student: "bg-accent/20 text-accent border-accent/30",
    };
    const labels: Record<string, string> = { admin: "Admin", teacher: "Professor", student: "Aluno" };
    return <Badge variant="outline" className={variants[role] || ""}>{labels[role] || role}</Badge>;
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <UserCog className="h-5 w-5" /> Gestão de Usuários
      </h2>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="student">Alunos</SelectItem>
            <SelectItem value="teacher">Professores</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground mb-2">{filtered.length} usuário(s) encontrado(s)</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.user_id} className={!u.active ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-sm">{u.referral_code || "—"}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground break-all">{u.email}</TableCell>
                  <TableCell>{roleBadge(u.role)}</TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-500">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/30 text-destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.role === "teacher" ? (
                      u.contract_signed_at ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{new Date(u.contract_signed_at).toLocaleDateString("pt-BR")}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setViewContract(u)} title="Ver contrato">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Select value={u.role} onValueChange={(val) => handleRoleChange(u.user_id, val)}>
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Aluno</SelectItem>
                          <SelectItem value="teacher">Professor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {!u.accepts_marketing && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:text-primary"
                          onClick={() => handleReactivateEmail(u)}
                          title="Reativar e-mails promocionais"
                        >
                          <MailCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSendReset(u)}
                        title="Enviar link de redefinição de senha"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => { setPwdUser(u); setNewPwd(""); }}
                        title="Definir nova senha"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 ${u.active ? "text-destructive hover:text-destructive" : "text-green-500 hover:text-green-400"}`}
                        onClick={() => handleToggleActive(u)}
                        title={u.active ? "Desativar" : "Ativar"}
                      >
                        {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(u.user_id)}
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileSignature className="h-5 w-5" /> Contrato — {viewContract?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] rounded-lg border border-border p-4 bg-secondary/30">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-sm leading-relaxed">
              {viewContract?.contract_text?.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-bold mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
                }
                return <p key={i} className="my-0.5">{line.replace(/\*\*/g, "")}</p>;
              })}
            </div>
            {viewContract?.contract_signature_name && (
              <div className="mt-6 pt-4 border-t border-border text-center">
                <p className="text-xl italic font-serif">{viewContract.contract_signature_name}</p>
                <p className="text-xs text-muted-foreground mt-1">CPF: {viewContract.contract_signature_cpf}</p>
              </div>
            )}
          </ScrollArea>
          <Button
            variant="outline"
            className="gap-1"
            onClick={() => {
              if (!viewContract?.contract_text) return;
              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              const esc = (s: unknown) =>
                String(s ?? "")
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#39;");
              const bodyHtml = esc(viewContract.contract_text)
                .replace(/\n/g, "<br/>")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
              printWindow.document.write(`<html><head><title>Contrato - ${esc(viewContract.name)}</title>
              <style>body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.6; font-size: 14px; }
              .signature { text-align: center; margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; font-style: italic; font-size: 20px; }
              .meta { font-size: 11px; color: #666; margin-top: 10px; }</style></head>
              <body><div>${bodyHtml}</div>
              <div class="signature">${esc(viewContract.contract_signature_name)}<br/><span class="meta">CPF: ${esc(viewContract.contract_signature_cpf)}</span></div></body></html>`);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }}
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersTab;
