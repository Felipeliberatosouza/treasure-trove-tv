import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import type { BrandingSettings } from "@/hooks/usePlatformSettings";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useAllPlatformSettings();
  const branding = settings.branding as BrandingSettings | undefined;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-6 py-3 md:px-12 lg:px-20">
        <Link to="/" className="flex items-center gap-2">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.platform_name || "Logo"} className="h-8 max-w-[160px] object-contain" />
          ) : (
            <span className="font-display text-xl font-bold text-gradient">
              {branding?.platform_name || "Revisão Fácil"}
            </span>
          )}
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

          <div className="hidden md:block">
            {user ? (
              <UserMenu />
            ) : (
              <Link to="/login">
                <Button size="sm" className="gap-2 font-display">
                  <User className="h-4 w-4" /> Entrar
                </Button>
              </Link>
            )}
          </div>

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
              <UserMenu />
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
