import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="text-center space-y-4">
          <h1 className="font-display text-6xl font-bold text-gradient">404</h1>
          <p className="text-xl text-muted-foreground">Página não encontrada</p>
          <a href="/" className="inline-block text-sm text-primary hover:underline transition-colors">
            ← Voltar para a página inicial
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
