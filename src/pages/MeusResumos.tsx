import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const MeusResumos = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold text-gradient">Meus Resumos</h1>
          </div>
          <p className="text-muted-foreground text-lg">Seus resumos salvos para revisão rápida.</p>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Você ainda não possui resumos salvos.</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MeusResumos;
