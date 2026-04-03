import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, User, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-6 py-3 md:px-12 lg:px-20">
        <Link to="/" className="font-display text-xl font-bold text-gradient">
          StudyFlix
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Catálogo
          </Link>
          <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Preços
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 transition-colors hover:bg-secondary">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>

          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <span className="text-xs text-muted-foreground capitalize">
                {role === "teacher" ? "📚 Professor" : "🎓 Aluno"}
              </span>
              <Button size="sm" variant="secondary" onClick={handleSignOut} className="gap-2 font-display">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          ) : (
            <Link to="/login" className="hidden md:block">
              <Button size="sm" className="gap-2 font-display">
                <User className="h-4 w-4" /> Entrar
              </Button>
            </Link>
          )}

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
            <Link to="/" className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
              Catálogo
            </Link>
            <a href="#pricing" className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
              Preços
            </a>
            {user ? (
              <>
                <span className="text-xs text-muted-foreground capitalize">
                  {role === "teacher" ? "📚 Professor" : "🎓 Aluno"}
                </span>
                <Button size="sm" variant="secondary" onClick={handleSignOut} className="gap-2 font-display">
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="gap-2 font-display w-full">
                  <User className="h-4 w-4" /> Entrar
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
};

export default Navbar;
