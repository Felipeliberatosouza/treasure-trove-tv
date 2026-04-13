import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import StudentDashboardContent from "@/components/dashboard/StudentDashboardContent";

const StudentDashboard = () => {
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

        <StudentDashboardContent />
      </div>
    </div>
  );
};

export default StudentDashboard;
