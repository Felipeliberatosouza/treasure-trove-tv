import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2, UserCog, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserWithRole {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  referral_code: number | null;
  active: boolean;
}

const AdminUsersTab = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, email, created_at, referral_code, active");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (profiles && roles) {
      const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
      const merged: UserWithRole[] = profiles.map((p) => ({
        ...p,
        role: roleMap.get(p.user_id) || "student",
        referral_code: p.referral_code ?? null,
        active: p.active ?? true,
      }));
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
      toast({
        title: newActive ? "Ativado" : "Desativado",
        description: `Usuário "${user.name}" foi ${newActive ? "ativado" : "desativado"}.`,
      });
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
      toast({ title: "Removido", description: "Usuário removido completamente." });
      fetchUsers();
    }
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
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.user_id} className={!u.active ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-sm">{u.referral_code || "—"}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{roleBadge(u.role)}</TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-500">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/30 text-destructive">Inativo</Badge>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminUsersTab;
