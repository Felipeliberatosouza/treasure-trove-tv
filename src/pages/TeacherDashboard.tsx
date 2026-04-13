import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Lock, Video, FileText, DollarSign, HelpCircle, BookOpen, FileSignature, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import PersonalDataTab from "@/components/dashboard/PersonalDataTab";
import LoginDataTab from "@/components/dashboard/LoginDataTab";
import LessonsTab from "@/components/dashboard/LessonsTab";
import ExamSolutionsTab from "@/components/dashboard/ExamSolutionsTab";
import TeacherDoubtsTab from "@/components/dashboard/TeacherDoubtsTab";
import TeacherInstructionsTab from "@/components/dashboard/TeacherInstructionsTab";
import TeacherContractTab from "@/components/dashboard/TeacherContractTab";
import StudentDashboardContent from "@/components/dashboard/StudentDashboardContent";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const teacherTabs = [
  { id: "instructions", label: "Instruções", icon: BookOpen },
  { id: "personal", label: "Dados Pessoais", icon: User },
  { id: "login", label: "Dados de Login", icon: Lock },
  { id: "lessons", label: "Minhas Aulas", icon: Video },
  { id: "exams", label: "Resoluções de Provas", icon: FileText },
  { id: "doubts", label: "Dúvidas de Alunos", icon: HelpCircle },
  { id: "contract", label: "Meu Contrato", icon: FileSignature },
  { id: "sales", label: "Vendas e Recebimentos", icon: DollarSign },
] as const;

type TeacherTabId = (typeof teacherTabs)[number]["id"];

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState<TeacherTabId>("instructions");
  const [activePanel, setActivePanel] = useState<"teacher" | "student">("teacher");
  const { profile, allRoles, addStudentRole } = useAuth();
  const [addingRole, setAddingRole] = useState(false);

  const hasStudentRole = allRoles.includes("student");

  const handleBecomeStudent = async () => {
    setAddingRole(true);
    await addStudentRole();
    toast.success("Agora você também é aluno! Acesse o Painel de Aluno.");
    setAddingRole(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 pt-24 pb-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="font-display text-2xl font-bold mb-1">
          {activePanel === "teacher" ? "Painel do Professor" : "Painel de Aluno"}
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Olá, {profile?.name?.split(" ")[0] || "Professor"}! Gerencie {activePanel === "teacher" ? "seus conteúdos" : "sua conta de aluno"}.
        </p>

        {/* Panel switcher */}
        {hasStudentRole && (
          <div className="flex gap-2 mb-6">
            <Button
              variant={activePanel === "teacher" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePanel("teacher")}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" /> Professor
            </Button>
            <Button
              variant={activePanel === "student" ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePanel("student")}
              className="gap-2"
            >
              <GraduationCap className="h-4 w-4" /> Aluno
            </Button>
          </div>
        )}

        {activePanel === "student" && hasStudentRole ? (
          <StudentDashboardContent />
        ) : (
          <div className="flex gap-6 flex-col md:flex-row">
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-56 shrink-0 scrollbar-hide">
              {teacherTabs.map((tab) => (
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
              {/* Become student option */}
              {!hasStudentRole && (
                <button
                  onClick={handleBecomeStudent}
                  disabled={addingRole}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-primary hover:bg-secondary transition-colors mt-4 border border-dashed border-primary/30"
                >
                  <GraduationCap className="h-4 w-4" />
                  {addingRole ? "Ativando..." : "Tornar-se também aluno"}
                </button>
              )}
            </nav>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 rounded-xl border border-border bg-card p-6"
            >
              {activeTab === "instructions" && <TeacherInstructionsTab />}
              {activeTab === "personal" && <PersonalDataTab />}
              {activeTab === "login" && <LoginDataTab />}
              {activeTab === "lessons" && <LessonsTab />}
              {activeTab === "exams" && <ExamSolutionsTab />}
              {activeTab === "doubts" && <TeacherDoubtsTab />}
              {activeTab === "contract" && <TeacherContractTab />}
              {activeTab === "sales" && (
                <div>
                  <h2 className="font-display text-lg font-semibold mb-4">Vendas e Recebimentos</h2>
                  <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda. Publique seus conteúdos para começar a vender.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
