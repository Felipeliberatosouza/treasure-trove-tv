import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, UserCog, UserCheck, UserX, FileSignature, Eye, Download, MailCheck, KeyRound, Send, Gift, Coins, ReceiptText } from "lucide-react";
import CreditStatementDialog from "./users/CreditStatementDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { formatCPF } from "@/lib/cpfValidator";

const CREDIT_RESOURCES: { key: string; label: string }[] = [
  { key: "revisao", label: "Revisões" },
  { key: "resumo", label: "Resumos" },
  { key: "simulado", label: "Simulados" },
  { key: "top_questoes", label: "Top Questões" },
  { key: "colinha", label: "Colinhas" },
  { key: "duvida", label: "Dúvidas" },
  { key: "aula_particular", label: "Aula particular" },
  { key: "ai_credits", label: "Créditos de IA" },
];

interface UserWithRole {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  referral_code: number | null;
  active: boolean;
  accepts_marketing: boolean;
  birth_date?: string | null;
  cpf?: string | null;
  contract_signed_at?: string | null;
  contract_expires_at?: string | null;
  contract_status?: string | null;
  contract_text?: string | null;
  contract_signature_name?: string | null;
  contract_signature_cpf?: string | null;
  trial_status?: "none" | "active" | "used";
  trial_started_at?: string | null;
  trial_type?: string | null;
  trial_days?: number | null;
  trial_videos?: number | null;
  trial_videos_watched?: number | null;
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
  const [creditUser, setCreditUser] = useState<UserWithRole | null>(null);
  const [creditValues, setCreditValues] = useState<Record<string, string>>({});
  const [savingCredits, setSavingCredits] = useState(false);
  const [statementUser, setStatementUser] = useState<UserWithRole | null>(null);
  // Resumo de créditos gratuitos por usuário (usados x restantes).
  const [creditSummary, setCreditSummary] = useState<Record<string, { used: number; remaining: number }>>({});

  const loadCreditSummary = async () => {
    const [{ data: rows }, { data: ai }] = await Promise.all([
      supabase.from("referral_content_credits").select("user_id, granted, used"),
      supabase.from("ai_revision_credits").select("user_id, balance"),
    ]);
    const map: Record<string, { used: number; remaining: number }> = {};
    (rows || []).forEach((r: any) => {
      const entry = map[r.user_id] || { used: 0, remaining: 0 };
      entry.used += r.used || 0;
      entry.remaining += Math.max(0, (r.granted || 0) - (r.used || 0));
      map[r.user_id] = entry;
    });
    (ai || []).forEach((r: any) => {
      const entry = map[r.user_id] || { used: 0, remaining: 0 };
      entry.remaining += r.balance || 0;
      map[r.user_id] = entry;
    });
    setCreditSummary(map);
  };

  useEffect(() => {
    void loadCreditSummary();
  }, []);
  const { toast } = useToast();

  const handleGrantCredits = async () => {
    if (!creditUser) return;
    const grants: Record<string, number> = {};
    for (const r of CREDIT_RESOURCES) {
      const n = parseInt(creditValues[r.key] || "0", 10);
      if (Number.isFinite(n) && n > 0) grants[r.key] = n;
    }
    if (Object.keys(grants).length === 0) {
      toast({ title: "Informe ao menos uma quantidade", variant: "destructive" });
      return;
    }
    setSavingCredits(true);
    const { error } = await supabase.rpc("admin_grant_content_credits" as any, {
      _user_id: creditUser.user_id,
      _grants: grants,
    });
    setSavingCredits(false);
    if (error) {
      toast({ title: "Erro ao conceder créditos", description: error.message, variant: "destructive" });
      return;
    }
    await logAction("grant_credits", {
      targetTable: "referral_content_credits",
      targetId: creditUser.user_id,
      metadata: { grants },
    });
    await loadCreditSummary();
    toast({ title: "Créditos de IA concedidos", description: `Créditos de IA adicionados para ${creditUser.name}.` });
    setCreditUser(null);
    setCreditValues({});
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, email, created_at, referral_code, active, accepts_marketing, birth_date, cpf");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: contracts } = await supabase.from("teacher_contracts" as any).select("teacher_id, signed_at, expires_at, status, contract_text, signature_name, signature_cpf").eq("status", "active");
    const { data: trials } = await supabase
      .from("free_trials")
      .select("user_id, active, started_at, trial_type, trial_days, trial_videos, videos_watched");

    if (profiles && roles) {
      const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
      const contractMap = new Map((contracts as any[] || []).map((c: any) => [c.teacher_id, c]));
      const trialMap = new Map((trials as any[] || []).map((t: any) => [t.user_id, t]));
      const merged: UserWithRole[] = profiles.map((p) => {
        const contract = contractMap.get(p.user_id) as any;
        const t = trialMap.get(p.user_id) as any;
        let trial_status: "none" | "active" | "used" = "none";
        if (t) {
          let stillActive = false;
          if (t.active) {
            if (t.trial_type === "days") {
              const exp = new Date(t.started_at).getTime() + (t.trial_days || 0) * 86400000;
              stillActive = exp > Date.now();
            } else {
              stillActive = (t.videos_watched || 0) < (t.trial_videos || 0);
            }
          }
          trial_status = stillActive ? "active" : "used";
        }
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
          trial_status,
          trial_started_at: t?.started_at || null,
          trial_type: t?.trial_type || null,
          trial_days: t?.trial_days ?? null,
          trial_videos: t?.trial_videos ?? null,
          trial_videos_watched: t?.videos_watched ?? null,
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
    const { error } = await supabase.functions.invoke("send-password-recovery", {
      body: { email: user.email, redirect_to: redirectTo },
    });
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
    // Envia e-mail de notificação de segurança ao usuário (best-effort).
    try {
      const [{ data: branding }, { data: contact }] = await Promise.all([
        supabase.from("platform_settings").select("value").eq("key", "branding").maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "contact").maybeSingle(),
      ]);
      const platformName = (branding?.value as any)?.platform_name || "Revisão Fácil";
      const supportEmail = (contact?.value as any)?.email || "";
      const supportWhatsapp = (contact?.value as any)?.whatsapp || "";
      const changedAt = new Date().toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      await supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "password_changed_admin",
          recipientEmail: pwdUser.email,
          idempotencyKey: `pwd-changed-admin-${pwdUser.user_id}-${Date.now()}`,
          templateData: {
            name: (pwdUser.name || "").split(" ")[0] || "",
            platform_name: platformName,
            support_email: supportEmail,
            support_whatsapp: supportWhatsapp,
            changed_at: changedAt,
          },
        },
      });
    } catch (e) {
      console.error("Falha ao enviar e-mail de notificação de senha alterada", e);
    }
    toast({ title: "Senha atualizada", description: `Nova senha definida para "${pwdUser.name}". Informe ao usuário com segurança.` });
    setPwdUser(null);
    setNewPwd("");
  };

  const handleResetTrial = async (user: UserWithRole) => {
    if (!confirm(`Liberar o teste grátis novamente para "${user.name}"? O histórico do teste anterior será apagado.`)) return;
    const { error } = await supabase.rpc("admin_reset_free_trial" as any, { _user_id: user.user_id });
    if (error) {
      toast({ title: "Erro", description: error.message || "Não foi possível liberar o teste grátis.", variant: "destructive" });
      return;
    }
    await logAction("free_trial_reset", { targetTable: "free_trials", targetId: user.user_id, metadata: { name: user.name, email: user.email } });
    toast({ title: "Liberado", description: `Teste grátis liberado novamente para "${user.name}".` });
    fetchUsers();
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
        <div className="rounded-lg border border-border overflow-x-scroll overflow-y-scroll max-h-[70vh] scrollbar-always">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aceita e-mails</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Teste Grátis</TableHead>
                <TableHead className="text-right">Créditos de IA usados</TableHead>
                <TableHead className="text-right">Créditos de IA restantes</TableHead>
                <TableHead>Extrato</TableHead>
                <TableHead>Aniversário</TableHead>
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
                  <TableCell className="text-muted-foreground text-xs font-mono whitespace-nowrap">{u.cpf ? formatCPF(u.cpf) : "—"}</TableCell>
                  <TableCell>{roleBadge(u.role)}</TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-500">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/30 text-destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.accepts_marketing ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-500">Sim</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Não</Badge>
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
                  <TableCell>
                    {u.trial_status === "active" ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="border-green-500/30 text-green-500 w-fit" title={u.trial_started_at ? `Iniciado em ${new Date(u.trial_started_at).toLocaleDateString("pt-BR")}` : undefined}>
                          Em andamento
                        </Badge>
                        {u.trial_type === "videos" && (
                          <span className="text-[10px] text-muted-foreground">
                            {(u.trial_videos_watched ?? 0)}/{(u.trial_videos ?? 0)} acessos · {Math.max(0, (u.trial_videos ?? 0) - (u.trial_videos_watched ?? 0))} restantes
                          </span>
                        )}
                      </div>
                    ) : u.trial_status === "used" ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="border-amber-500/30 text-amber-500 w-fit" title={u.trial_started_at ? `Iniciado em ${new Date(u.trial_started_at).toLocaleDateString("pt-BR")}` : undefined}>
                          Já utilizado
                        </Badge>
                        {u.trial_type === "videos" && (
                          <span className="text-[10px] text-muted-foreground">
                            {(u.trial_videos_watched ?? 0)}/{(u.trial_videos ?? 0)} acessos
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground">
                        Não usado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">{creditSummary[u.user_id]?.used ?? 0}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{creditSummary[u.user_id]?.remaining ?? 0}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => setStatementUser(u)}>
                      <ReceiptText className="h-4 w-4" /> Ver extrato
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.birth_date ? new Date(u.birth_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 gap-1 border-primary/40 text-primary hover:text-primary"
                        onClick={() => { setCreditUser(u); setCreditValues({}); }}
                        title="Conceder Créditos de IA por recurso"
                      >
                        <Coins className="h-4 w-4" /> Créditos
                      </Button>
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
                      {u.trial_status !== "none" && (

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:text-primary"
                          onClick={() => handleResetTrial(u)}
                          title="Liberar teste grátis novamente"
                        >
                          <Gift className="h-4 w-4" />
                        </Button>
                      )}
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
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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

      <Dialog open={!!pwdUser} onOpenChange={(o) => { if (!o) { setPwdUser(null); setNewPwd(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Definir nova senha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Usuário: <span className="font-medium text-foreground">{pwdUser?.name}</span> ({pwdUser?.email})
            </p>
            <Input
              type="text"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A ação será registrada na auditoria. Informe a nova senha ao usuário por um canal seguro e oriente-o a alterá-la em seguida.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPwdUser(null); setNewPwd(""); }} disabled={savingPwd}>Cancelar</Button>
              <Button onClick={handleSavePassword} disabled={savingPwd}>{savingPwd ? "Salvando..." : "Salvar nova senha"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditUser} onOpenChange={(o) => { if (!o) { setCreditUser(null); setCreditValues({}); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Coins className="h-5 w-5" /> Conceder créditos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe quantos Créditos de IA serão concedidos a <strong>{creditUser?.name}</strong> em cada recurso.
              Os créditos somam ao saldo gratuito do usuário.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CREDIT_RESOURCES.map((r) => (
                <div key={r.key} className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`credit-${r.key}`}>{r.label}</label>
                  <Input
                    id={`credit-${r.key}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={creditValues[r.key] ?? ""}
                    onChange={(e) =>
                      setCreditValues((prev) => ({ ...prev, [r.key]: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCreditUser(null); setCreditValues({}); }} disabled={savingCredits}>Cancelar</Button>
              <Button onClick={handleGrantCredits} disabled={savingCredits}>{savingCredits ? "Salvando..." : "Conceder Créditos de IA"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreditStatementDialog
        user={statementUser ? { user_id: statementUser.user_id, name: statementUser.name } : null}
        onClose={() => setStatementUser(null)}
      />
    </div>
  );
};

export default AdminUsersTab;
