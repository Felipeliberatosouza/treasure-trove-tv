import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Lock, Video, FileText, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import PersonalDataTab from "@/components/dashboard/PersonalDataTab";
import LoginDataTab from "@/components/dashboard/LoginDataTab";
import LessonsTab from "@/components/dashboard/LessonsTab";
import ExamSolutionsTab from "@/components/dashboard/ExamSolutionsTab";

const tabs = [
  { id: "personal", label: "Dados Pessoais", icon: User },
  { id: "login", label: "Dados de Login", icon: Lock },
  { id: "lessons", label: "Minhas Aulas", icon: Video },
  { id: "exams", label: "Resoluções de Provas", icon: FileText },
  { id: "sales", label: "Vendas e Recebimentos", icon: DollarSign },
] as const;

type TabId = (typeof tabs)[number]["id"];

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 pt-24 pb-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="font-display text-2xl font-bold mb-1">Painel do Professor</h1>
        <p className="text-sm text-muted-foreground mb-8">Olá, {profile?.name?.split(" ")[0] || "Professor"}! Gerencie seus conteúdos.</p>

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
            className="flex-1 rounded-xl border border-border bg-card p-6"
          >
            {activeTab === "personal" && <PersonalDataTab />}
            {activeTab === "login" && <LoginDataTab />}
            {activeTab === "lessons" && <LessonsTab />}
            {activeTab === "exams" && <ExamSolutionsTab />}
            {activeTab === "sales" && (
              <div>
                <h2 className="font-display text-lg font-semibold mb-4">Vendas e Recebimentos</h2>
                <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda. Publique seus conteúdos para começar a vender.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
