import { useState } from "react";
import { motion } from "framer-motion";
import { Search, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  onLoginClick: () => void;
}

const Navbar = ({ onLoginClick }: NavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-6 py-3 md:px-12 lg:px-20">
        <h1 className="font-display text-xl font-bold text-gradient">
          StudyFlix
        </h1>

        <div className="hidden items-center gap-6 md:flex">
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Catálogo
          </a>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Categorias
          </a>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Preços
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 transition-colors hover:bg-secondary">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
          <Button size="sm" onClick={onLoginClick} className="hidden gap-2 font-display md:flex">
            <User className="h-4 w-4" /> Entrar
          </Button>
          <button
            className="rounded-full p-2 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-border bg-background px-6 py-4 md:hidden"
        >
          <div className="flex flex-col gap-3">
            <a href="#" className="text-sm text-muted-foreground">Catálogo</a>
            <a href="#" className="text-sm text-muted-foreground">Categorias</a>
            <a href="#" className="text-sm text-muted-foreground">Preços</a>
            <Button size="sm" onClick={onLoginClick} className="gap-2 font-display">
              <User className="h-4 w-4" /> Entrar
            </Button>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
};

export default Navbar;
