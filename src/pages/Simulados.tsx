import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ClipboardList } from "lucide-react";

const Simulados = () => (
  <div className="min-h-screen bg-background text-foreground flex flex-col">
    <Navbar />
    <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          <h1 className="font-display text-3xl font-bold text-gradient">Simulados</h1>
        </div>
        <p className="text-muted-foreground text-lg">Teste seus conhecimentos com simulados completos.</p>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Em breve teremos conteúdos disponíveis aqui.</p>
        </div>
      </div>
    </div>
    <Footer />
  </div>
);

export default Simulados;
