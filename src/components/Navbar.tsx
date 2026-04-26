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
import { useActiveSubscription } from "@/hooks/useActiveSubscription";
import { useTeacherAlerts } from "@/hooks/useTeacherAlerts";
import { useAdminAlerts } from "@/hooks/useAdminAlerts";
import { useStudentAlerts } from "@/hooks/useStudentAlerts";

interface SearchResult {
  id: string;
  title: string;
  type: "lesson" | "exam_solution";
}

type AlertKey =
  | "doubts"
  | "scheduledToday"
  | "agendaOutdated"
  | "adminPendingContent"
  | "adminPendingDoubts"
  | "adminExpiringSubscriptions"
  | "studentAnsweredDoubts"
  | "studentScheduledToday";

type MenuItem = {
  label: string;
  href?: string;
  alertKey?: AlertKey;
  children?: { label: string; href: string; alertKey?: AlertKey }[];
};

const publicMenuItems: MenuItem[] = [
  { label: "Assine a Revisão Fácil", href: "#pricing" },
  { label: "Revisões", href: "/revisoes" },
  { label: "Resumos", href: "/resumos" },
  { label: "Simulados", href: "/simulados" },
  { label: "Top Questões de Provas", href: "/top-questoes" },
  { label: "Colinhas", href: "/colinhas" },
  { label: "Agende uma Aula Particular", href: "/contato" },
];

const subscriberMenuItem: MenuItem = {
  label: "Minha Assinatura",
  href: "/dashboard/student?tab=subscription",
};

const loggedMenuItems: MenuItem[] = [
  { label: "Minhas Revisões", href: "/minhas-revisoes" },
  { label: "Meus Resumos", href: "/meus-resumos" },
  { label: "Meus Simulados", href: "/meus-simulados" },
  { label: "Minhas Top Questões de Provas", href: "/minhas-top-questoes" },
  { label: "Minhas Colinhas", href: "/minhas-colinhas" },
  { label: "Minhas Dúvidas", href: "/minhas-duvidas", alertKey: "studentAnsweredDoubts" },
  { label: "Aula Particular: Agende/Acesse", href: "/minhas-aulas-agendadas", alertKey: "studentScheduledToday" },
];

const teacherMenuItems: MenuItem[] = [
  { label: "Minhas Revisões: Gravar Nova Aula", href: "/dashboard/teacher?tab=lessons" },
  { label: "Responder Dúvidas de Alunos", href: "/dashboard/teacher?tab=doubts", alertKey: "doubts" },
  {
    label: "Aula Particular: Acesse Aulas/ Atualize Agenda",
    children: [
      { label: "Acessar Aulas", href: "/minhas-aulas-agendadas", alertKey: "scheduledToday" },
      { label: "Atualizar Agenda", href: "/dashboard/teacher?tab=agenda", alertKey: "agendaOutdated" },
    ],
  },
  { label: "Meus Resumos", href: "/meus-resumos" },
  { label: "Meus Simulados", href: "/meus-simulados" },
  { label: "Minhas Top Questões de Provas", href: "/minhas-top-questoes" },
  { label: "Minhas Colinhas", href: "/minhas-colinhas" },
];

const adminMenuItems: MenuItem[] = [
  { label: "Aprovação de Conteúdos", href: "/dashboard/admin?tab=content", alertKey: "adminPendingContent" },
  { label: "Aprovação de Dúvidas", href: "/dashboard/admin?tab=doubts", alertKey: "adminPendingDoubts" },
  { label: "Pagamento de Professores", href: "/dashboard/admin?tab=compensation" },
  { label: "Vencimento de Assinaturas", href: "/dashboard/admin?tab=subscriptions", alertKey: "adminExpiringSubscriptions" },
  { label: "Monitoramento de E-mails", href: "/dashboard/admin?tab=emails" },
  { label: "Posts de Divulgação", href: "/dashboard/admin?tab=sales-posts" },
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
  const { user, role } = useAuth();
  const { settings } = useAllPlatformSettings();
  const branding = settings.branding as BrandingSettings | undefined;
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoWidth, setLogoWidth] = useState<number>(0);

  useEffect(() => {
    const el = logoRef.current;
    if (!el) {
      setLogoWidth(0);
      return;
    }
    const measure = () => setLogoWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [branding?.logo_url, branding?.slogan]);

  const slogan = branding?.slogan || "";
  // Calcula font-size para o slogan ocupar a mesma largura da logo
  // Aproximação: largura média de caractere ≈ 0.5 * fontSize
  const sloganFontSize =
    logoWidth > 0 && slogan.length > 0
      ? Math.max(8, Math.min(18, (logoWidth / slogan.length) * 1.7))
      : 11;
  const { isActive: hasActiveSubscription } = useActiveSubscription();
  const teacherAlerts = useTeacherAlerts();
  const adminAlerts = useAdminAlerts();
  const studentAlerts = useStudentAlerts();

  const baseMenu = user
    ? role === "admin"
      ? adminMenuItems
      : role === "teacher"
        ? teacherMenuItems
        : loggedMenuItems
    : publicMenuItems;
  const menuItems = user && role === "student" && hasActiveSubscription
    ? [subscriberMenuItem, ...baseMenu]
    : baseMenu;

  const alertActive = (key?: AlertKey) => {
    if (!key) return false;
    switch (key) {
      case "doubts":
        return teacherAlerts.pendingDoubts;
      case "scheduledToday":
        return teacherAlerts.scheduledToday;
      case "agendaOutdated":
        return teacherAlerts.agendaOutdated;
      case "adminPendingContent":
        return adminAlerts.pendingContent;
      case "adminPendingDoubts":
        return adminAlerts.pendingDoubts;
      case "adminExpiringSubscriptions":
        return adminAlerts.expiringSubscriptions;
      case "studentAnsweredDoubts":
        return studentAlerts.answeredDoubts;
      case "studentScheduledToday":
        return studentAlerts.scheduledToday;
      default:
        return false;
    }
  };

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
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-12 lg:px-20">
        <Link to="/" className="relative flex items-center leading-none shrink-0">
          {branding?.logo_url && !branding?.use_text_logo ? (
            <img
              ref={logoRef}
              src={branding.logo_url}
              alt={branding.platform_name || "Logo"}
              className="h-12 md:h-14 max-w-[260px] object-contain block"
              onLoad={(e) => setLogoWidth((e.target as HTMLImageElement).getBoundingClientRect().width)}
            />
          ) : (
            <span className="font-display text-xl font-bold text-gradient">
              {branding?.platform_name || "Revisão Fácil"}
            </span>
          )}
          {slogan && (
            <span
              className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 leading-none text-center whitespace-nowrap overflow-hidden pointer-events-none"
              style={{
                width: logoWidth > 0 ? `${logoWidth}px` : undefined,
                fontSize: `${sloganFontSize}px`,
                color: branding?.slogan_color || "hsl(var(--muted-foreground))",
              }}
            >
              {slogan}
            </span>
          )}
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          {menuItems.map((item) => {
            if (item.children && item.children.length > 0) {
              return (
                <div key={item.label} className="relative group">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap"
                  >
                    {item.label}
                  </button>
                  <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50">
                    <div className="min-w-[220px] rounded-md border border-border bg-background shadow-lg py-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <span>{child.label}</span>
                          {alertActive(child.alertKey) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              ● Pendência
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            const href = item.href ?? "#";
            const hasAlert = alertActive(item.alertKey);
            const className =
              "relative inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap";
            const alertBadge = hasAlert ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                ● Pendência
              </span>
            ) : null;
            return href.startsWith("#") ? (
              <a key={item.label} href={href} className={className}>
                {item.label}
                {alertBadge}
              </a>
            ) : (
              <Link key={item.label} to={href} className={className}>
                {item.label}
                {alertBadge}
              </Link>
            );
          })}
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
            {menuItems.map((item) => {
              if (item.children && item.children.length > 0) {
                return (
                  <div key={item.label} className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <div className="flex flex-col gap-2 pl-3 border-l border-border">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className="inline-flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => setMobileOpen(false)}
                        >
                          <span>{child.label}</span>
                          {alertActive(child.alertKey) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              ● Pendência
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }
              const href = item.href ?? "#";
              const hasAlert = alertActive(item.alertKey);
              const alertBadge = hasAlert ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  ● Pendência
                </span>
              ) : null;
              return href.startsWith("#") ? (
                <a key={item.label} href={href} className="inline-flex items-center justify-between gap-2 text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                  <span>{item.label}</span>
                  {alertBadge}
                </a>
              ) : (
                <Link key={item.label} to={href} className="inline-flex items-center justify-between gap-2 text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                  <span>{item.label}</span>
                  {alertBadge}
                </Link>
              );
            })}
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
