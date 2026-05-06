import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import StudentContentSections from "@/components/student/StudentContentSections";

const MinhasRevisoes = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <header className="px-6 md:px-12 lg:px-20 mb-8">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold text-gradient">Minhas Revisões</h1>
          </div>
          <p className="text-muted-foreground text-lg mt-2">
            Aulas de revisão e resoluções de provas selecionadas com base nas suas áreas de interesse.
          </p>
        </header>
        <StudentContentSections
          lessonsLabel="Aulas de Revisão"
          examsLabel="Resoluções de Provas"
        />
      </main>
      <Footer />
    </div>
  );
};

export default MinhasRevisoes;
