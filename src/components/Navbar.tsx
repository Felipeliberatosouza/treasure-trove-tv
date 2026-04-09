import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import type { BrandingSettings } from "@/hooks/usePlatformSettings";

const publicMenuItems = [
  { label: "Assine a Revisão Fácil", href: "#pricing" },
  { label: "Revisões", href: "/revisoes" },
  { label: "Resumos", href: "/resumos" },
  { label: "Simulados", href: "/simulados" },
  { label: "Top Questões de Provas", href: "/top-questoes" },
  { label: "Minhas Colinhas", href: "/colinhas" },
];

const loggedMenuItems = [
  { label: "Minhas Revisões", href: "/minhas-revisoes" },
  { label: "Meus Resumos", href: "/meus-resumos" },
  { label: "Meus Simulados", href: "/meus-simulados" },
  { label: "Minhas Top Questões de Provas", href: "/minhas-top-questoes" },
  { label: "Minhas Colinhas", href: "/minhas-colinhas" },
  { label: "Minhas Dúvidas", href: "/minhas-duvidas" },
  { label: "Minhas Aulas Agendadas", href: "/minhas-aulas-agendadas" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useAllPlatformSettings();
  const branding = settings.branding as BrandingSettings | undefined;

  const menuItems = user ? loggedMenuItems : publicMenuItems;

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

        <div className="hidden items-center gap-5 md:flex">
          {menuItems.map((item) =>
            item.href.startsWith("#") ? (
              <a key={item.label} href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap">
                {item.label}
              </a>
            ) : (
              <Link key={item.label} to={item.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap">
                {item.label}
              </Link>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 transition-colors hover:bg-secondary">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>

          {user ? (
            <UserMenu />
          ) : (
            <Link to="/login">
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
            {menuItems.map((item) =>
              item.href.startsWith("#") ? (
                <a key={item.label} href={item.href} className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} to={item.href} className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </Link>
              )
            )}
            {!user && (
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
