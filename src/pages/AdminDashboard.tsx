import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import MandatoryMfaGuard from "@/components/MandatoryMfaGuard";
import { motion } from "framer-motion";
import { ArrowLeft, Video, DollarSign, Shield, LayoutDashboard, Settings, HelpCircle, Mail, CalendarClock, Megaphone, Users, CreditCard, Tag, FileText, ScrollText, Activity, RefreshCcw, Receipt, XCircle } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminContentTab from "@/components/admin/AdminContentTab";
import AdminPaymentsTab from "@/components/admin/AdminPaymentsTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import AdminDoubtsTab from "@/components/admin/AdminDoubtsTab";
import AdminEmailsTab from "@/components/admin/AdminEmailsTab";
import AdminSubscriptionsTab from "@/components/admin/AdminSubscriptionsTab";
import AdminSalesPostsTab from "@/components/admin/AdminSalesPostsTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminPlansTab from "@/components/admin/AdminPlansTab";
import AdminSecurityTab from "@/components/admin/AdminSecurityTab";
import AdminAuditLogsTab from "@/components/admin/AdminAuditLogsTab";
import AdminLoginAttemptsTab from "@/components/admin/AdminLoginAttemptsTab";
import AdminCancellationReasonsTab from "@/components/admin/AdminCancellationReasonsTab";
import AdminCancellationReceiptsTab from "@/components/admin/AdminCancellationReceiptsTab";
import AdminCommitmentRefundsTab from "@/components/admin/AdminCommitmentRefundsTab";
import AdminCancellationsTab from "@/components/admin/AdminCancellationsTab";
import AdminResourcePricingTab from "@/components/admin/AdminResourcePricingTab";
import AdminUsageHistoryTab from "@/components/admin/AdminUsageHistoryTab";

const tabs = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "users", label: "Usuários", icon: Users },
  { id: "plans", label: "Planos", icon: CreditCard },
  { id: "resource-pricing", label: "Preços de Recursos", icon: Tag },
  { id: "usage-history", label: "Histórico de Uso", icon: Activity },
  { id: "cancellations", label: "Cancelamentos", icon: XCircle },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "settings", label: "Configurações", icon: Settings },
  // Hidden: agora acessadas como submenu dentro de Cancelamentos
  { id: "cancellation-reasons", label: "Motivos de Cancelamento", icon: FileText, hidden: true },
  { id: "cancellation-receipts", label: "Recibos de Cancelamento", icon: Receipt, hidden: true },
  { id: "commitment-refunds", label: "Reembolso de Multa de Permanência", icon: RefreshCcw, hidden: true },
  // Hidden: agora acessadas como submenu dentro de Segurança
  { id: "audit", label: "Auditoria", icon: ScrollText, hidden: true },
  { id: "login-attempts", label: "Tentativas de Login", icon: Activity, hidden: true },
  // Hidden tabs (acessadas via menu hambúrguer / deep-link, não exibidas no menu lateral)
  { id: "content", label: "Aprovação de Conteúdos", icon: Video, hidden: true },
  { id: "doubts", label: "Aprovação de Dúvidas", icon: HelpCircle, hidden: true },
  { id: "payments", label: "Pagamento de Professores", icon: DollarSign, hidden: true },
  { id: "subscriptions", label: "Vencimento de Assinaturas", icon: CalendarClock, hidden: true },
  { id: "emails", label: "Monitoramento de E-mails", icon: Mail, hidden: true },
  { id: "sales-posts", label: "Posts de Divulgação", icon: Megaphone, hidden: true },
] as const;

type TabId = (typeof tabs)[number]["id"];

const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { role, loading } = useAuth();

  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabId | null;
    if (tabParam && tabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <MandatoryMfaGuard>
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pt-24 pb-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Painel Administrativo</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Gerencie usuários, conteúdos e pagamentos da plataforma.</p>

        <div className="flex gap-6 flex-col md:flex-row">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-56 shrink-0 scrollbar-hide">
            {tabs.filter((t) => !("hidden" in t && t.hidden)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 rounded-xl border border-border bg-card p-6 overflow-x-auto"
          >
            {activeTab === "overview" && <AdminOverviewTab onNavigate={(id) => setActiveTab(id as TabId)} />}
            {activeTab === "content" && <AdminContentTab />}
            {activeTab === "doubts" && <AdminDoubtsTab />}
            {activeTab === "payments" && <AdminPaymentsTab />}
            {activeTab === "subscriptions" && <AdminSubscriptionsTab />}
            {activeTab === "emails" && <AdminEmailsTab />}
            {activeTab === "sales-posts" && <AdminSalesPostsTab />}
            {activeTab === "users" && <AdminUsersTab />}
            {activeTab === "plans" && <AdminPlansTab />}
            {activeTab === "resource-pricing" && <AdminResourcePricingTab />}
            {activeTab === "usage-history" && <AdminUsageHistoryTab />}
            {activeTab === "cancellation-reasons" && <AdminCancellationReasonsTab />}
            {activeTab === "cancellation-receipts" && <AdminCancellationReceiptsTab />}
            {activeTab === "commitment-refunds" && <AdminCommitmentRefundsTab />}
            {activeTab === "security" && <AdminSecurityTab />}
            {activeTab === "audit" && <AdminAuditLogsTab />}
            {activeTab === "login-attempts" && <AdminLoginAttemptsTab />}
            {activeTab === "settings" && <AdminSettingsTab />}
          </motion.div>
        </div>
      </div>
    </div>
    </MandatoryMfaGuard>
  );
};

export default AdminDashboard;
