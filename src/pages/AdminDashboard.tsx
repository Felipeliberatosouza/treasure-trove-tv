import { useState } from "react";
import MandatoryMfaGuard from "@/components/MandatoryMfaGuard";
import { motion } from "framer-motion";
import { ArrowLeft, Video, DollarSign, Shield, LayoutDashboard, Settings, HelpCircle, Mail, CalendarClock, Megaphone } from "lucide-react";
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

const tabs = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "content", label: "Aprovação de Conteúdos", icon: Video },
  { id: "doubts", label: "Aprovação de Dúvidas", icon: HelpCircle },
  { id: "payments", label: "Pagamento de Professores", icon: DollarSign },
  { id: "subscriptions", label: "Vencimento de Assinaturas", icon: CalendarClock },
  { id: "emails", label: "Monitoramento de E-mails", icon: Mail },
  { id: "sales-posts", label: "Posts de Divulgação", icon: Megaphone },
  { id: "settings", label: "Configurações", icon: Settings },
] as const;

type TabId = (typeof tabs)[number]["id"];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { role, loading } = useAuth();

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
            {tabs.map((tab) => (
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
            {activeTab === "settings" && <AdminSettingsTab />}
          </motion.div>
        </div>
      </div>
    </div>
    </MandatoryMfaGuard>
  );
};

export default AdminDashboard;
