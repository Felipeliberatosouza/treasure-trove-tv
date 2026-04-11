import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, CreditCard, Lock, FileText, BookOpen, HelpCircle, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import PersonalDataTab from "@/components/dashboard/PersonalDataTab";
import LoginDataTab from "@/components/dashboard/LoginDataTab";
import StudentDoubtsTab from "@/components/dashboard/StudentDoubtsTab";
import StudentSubscriptionTab from "@/components/dashboard/StudentSubscriptionTab";
import StudentInstructionsTab from "@/components/dashboard/StudentInstructionsTab";

const tabs = [
  { id: "instructions", label: "Como Usar", icon: Info },
  { id: "personal", label: "Dados Pessoais", icon: User },
  { id: "subscription", label: "Assinatura e Compras", icon: CreditCard },
  { id: "login", label: "Dados de Login", icon: Lock },
  { id: "doubts", label: "Minhas Dúvidas", icon: HelpCircle },
  { id: "exams", label: "Minhas Provas", icon: FileText },
  { id: "subjects", label: "Minhas Disciplinas", icon: BookOpen },
] as const;

type TabId = (typeof tabs)[number]["id"];

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>("instructions");
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 pt-24 pb-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="font-display text-2xl font-bold mb-1">Meu Painel</h1>
        <p className="text-sm text-muted-foreground mb-8">Olá, {profile?.name?.split(" ")[0] || "Aluno"}! Gerencie sua conta.</p>

        <div className="flex gap-6 flex-col md:flex-row">
          {/* Sidebar tabs */}
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

          {/* Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 rounded-xl border border-border bg-card p-6"
          >
            {activeTab === "personal" && <PersonalDataTab />}
            {activeTab === "login" && <LoginDataTab />}
            {activeTab === "doubts" && <StudentDoubtsTab />}
            {activeTab === "subscription" && <StudentSubscriptionTab />}
            {activeTab === "exams" && (
              <div>
                <h2 className="font-display text-lg font-semibold mb-4">Minhas Provas</h2>
                <p className="text-sm text-muted-foreground">Nenhuma prova disponível no momento.</p>
              </div>
            )}
            {activeTab === "subjects" && (
              <div>
                <h2 className="font-display text-lg font-semibold mb-4">Minhas Disciplinas</h2>
                <p className="text-sm text-muted-foreground">Você ainda não se inscreveu em nenhuma disciplina.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
