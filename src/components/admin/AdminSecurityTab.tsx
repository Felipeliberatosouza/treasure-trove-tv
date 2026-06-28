import { useState, useEffect } from "react";
import { Shield, LogIn, ShieldAlert, ShieldCheck, Mail } from "lucide-react";
import AdminAuditLogsTab from "./AdminAuditLogsTab";
import AdminLoginAttemptsTab from "./AdminLoginAttemptsTab";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EmailChange {
  id: string;
  user_id: string;
  old_email: string | null;
  new_email: string;
  created_at: string;
  user_name?: string;
}

const EmailChangeHistorySection = () => {
  const [rows, setRows] = useState<EmailChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("email_change_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (data || []) as any[];
      if (list.length > 0) {
        const ids = [...new Set(list.map((r) => r.user_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", ids);
        const map = new Map((profs || []).map((p) => [p.user_id, p.name]));
        setRows(list.map((r) => ({ ...r, user_name: map.get(r.user_id) || "—" })));
      } else {
        setRows([]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <Mail className="h-5 w-5" /> Histórico de Troca de E-mails
      </h3>
      <p className="text-sm text-muted-foreground">
        Registro de todas as alterações de e-mail realizadas pelos usuários.
      </p>
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma alteração registrada.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail Anterior</TableHead>
                <TableHead>Novo E-mail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">{r.user_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.old_email || "—"}</TableCell>
                  <TableCell className="text-sm">{r.new_email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

const SecuritySection = () => {
  const [mandatory, setMandatory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "admin_2fa_required")
      .maybeSingle()
      .then(({ data }) => {
        setMandatory(data?.value === true);
        setLoading(false);
      });
  }, []);

  const toggleMandatory = async (checked: boolean) => {
    setMandatory(checked);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: JSON.parse(JSON.stringify(checked)) })
      .eq("key", "admin_2fa_required");
    if (error) {
      toast.error("Erro ao salvar configuração");
      setMandatory(!checked);
    } else {
      toast.success(checked ? "2FA obrigatório ativado para admins" : "2FA obrigatório desativado");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Autenticação de Dois Fatores (2FA)
        </h3>
        <TwoFactorSetup />
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Política de 2FA para Administradores
        </h3>
        <p className="text-sm text-muted-foreground">
          Quando ativado, todos os administradores serão obrigados a configurar a autenticação de dois fatores antes de acessar o painel administrativo.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            id="mandatory-2fa"
            checked={mandatory}
            onCheckedChange={toggleMandatory}
            disabled={loading}
          />
          <Label htmlFor="mandatory-2fa" className="text-sm font-medium">
            Exigir 2FA obrigatório para todos os administradores
          </Label>
        </div>
      </div>
    </div>
  );
};

const sections = [
  { id: "2fa", label: "2FA", icon: ShieldCheck },
  { id: "audit", label: "Logs de Auditoria", icon: ShieldAlert },
  { id: "login-attempts", label: "Tentativas de Login", icon: LogIn },
  { id: "email-history", label: "Histórico de E-mails", icon: Mail },
] as const;

type SectionId = (typeof sections)[number]["id"];

const AdminSecurityTab = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("2fa");

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5" /> Segurança
      </h2>

      <div className="flex gap-2 flex-wrap mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              activeSection === s.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "2fa" && <SecuritySection />}
      {activeSection === "audit" && <AdminAuditLogsTab />}
      {activeSection === "login-attempts" && <AdminLoginAttemptsTab />}
      {activeSection === "email-history" && <EmailChangeHistorySection />}
    </div>
  );
};

export default AdminSecurityTab;
