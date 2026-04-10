import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import type { BrandingSettings } from "@/hooks/usePlatformSettings";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  title: string;
  type: "lesson" | "exam_solution";
}

const publicMenuItems = [
  { label: "Assine a Revisão Fácil", href: "#pricing" },
  { label: "Revisões", href: "/revisoes" },
  { label: "Resumos", href: "/resumos" },
  { label: "Simulados", href: "/simulados" },
  { label: "Top Questões de Provas", href: "/top-questoes" },
  { label: "Colinhas", href: "/colinhas" },
  { label: "Agende uma Aula Particular", href: "/contato" },
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useAllPlatformSettings();
  const branding = settings.branding as BrandingSettings | undefined;

  const menuItems = user ? loggedMenuItems : publicMenuItems;

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const term = `%${searchQuery.trim()}%`;
      const [lessonsRes, examsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, title")
          .eq("published", true)
          .eq("admin_approved", true)
          .ilike("title", term)
          .limit(5),
        supabase
          .from("exam_solutions")
          .select("id, title")
          .eq("published", true)
          .eq("admin_approved", true)
          .ilike("title", term)
          .limit(5),
      ]);
      const results: SearchResult[] = [
        ...(lessonsRes.data || []).map((l) => ({ id: l.id, title: l.title, type: "lesson" as const })),
        ...(examsRes.data || []).map((e) => ({ id: e.id, title: e.title, type: "exam_solution" as const })),
      ];
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    navigate(`/video/${result.id}`);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

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
          <div ref={searchContainerRef} className="relative">
            <button
              className="rounded-full p-2 transition-colors hover:bg-secondary"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="fixed left-4 right-4 top-[60px] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[320px] z-50"
                >
                  <Input
                    ref={searchInputRef}
                    placeholder="Buscar aulas e provas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border"
                  />
                  {(searchResults.length > 0 || searching || (searchQuery.trim().length >= 2 && !searching)) && (
                    <div className="mt-1 rounded-md border border-border bg-background shadow-lg max-h-60 overflow-y-auto">
                      {searching && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
                      )}
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                        >
                          <span className="text-xs text-muted-foreground shrink-0">
                            {result.type === "lesson" ? "📖 Aula" : "📝 Prova"}
                          </span>
                          <span className="truncate">{result.title}</span>
                        </button>
                      ))}
                      {!searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
