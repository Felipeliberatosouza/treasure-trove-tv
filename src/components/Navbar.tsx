import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import ContinueWatchingMenu from "@/components/student/ContinueWatchingMenu";
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
  type: "lesson" | "exam_solution" | "ai_kit";
}

type AlertKey =
  | "doubts"
  | "scheduledToday"
  | "agendaOutdated"
  | "adminPendingContent"
  | "adminPendingDoubts"
  | "adminExpiringSubscriptions"
  | "adminPendingProfileChanges"
  | "studentAnsweredDoubts"
  | "studentScheduledToday";

type MenuItem = {
  label: string;
  shortLabel?: string;
  href?: string;
  alertKey?: AlertKey;
  children?: { label: string; shortLabel?: string; href: string; alertKey?: AlertKey }[];
};

const publicMenuItems: MenuItem[] = [
  { label: "Assine a Revisão Fácil", shortLabel: "Assine", href: "#pricing" },
  { label: "Revisões", shortLabel: "Revisões", href: "/revisoes" },
  { label: "Resumos", shortLabel: "Resumos", href: "/resumos" },
  { label: "Simulados", shortLabel: "Simulados", href: "/simulados" },
  { label: "Top Questões de Provas", shortLabel: "Top Questões", href: "/top-questoes" },
  { label: "Colinhas", shortLabel: "Colinhas", href: "/colinhas" },
  { label: "Agende uma Aula Particular", shortLabel: "Aula Particular", href: "#agendar-aula" },
];

const subscriberMenuItem: MenuItem = {
  label: "Minha Assinatura",
  shortLabel: "Assinatura",
  href: "/dashboard/student?tab=subscription",
};

const loggedMenuItems: MenuItem[] = [
  { label: "Revisão com IA", shortLabel: "IA", href: "/" },
  { label: "Minhas Revisões", shortLabel: "Revisões", href: "/minhas-revisoes" },
  { label: "Meus Resumos", shortLabel: "Resumos", href: "/meus-resumos" },
  { label: "Meus Simulados", shortLabel: "Simulados", href: "/meus-simulados" },
  { label: "Minhas Top Questões de Provas", shortLabel: "Top Questões", href: "/minhas-top-questoes" },
  { label: "Minhas Colinhas", shortLabel: "Colinhas", href: "/minhas-colinhas" },
  { label: "Minhas Dúvidas", shortLabel: "Dúvidas", href: "/minhas-duvidas", alertKey: "studentAnsweredDoubts" },
  { label: "Aula Particular: Agende/Acesse", shortLabel: "Aula Particular", href: "/minhas-aulas-agendadas", alertKey: "studentScheduledToday" },
];

const teacherMenuItems: MenuItem[] = [
  { label: "Gravar Nova Aula", shortLabel: "Gravar", href: "/dashboard/teacher?tab=lessons" },
  { label: "Editar Conteúdos Publicados", shortLabel: "Editar", href: "/dashboard/teacher?tab=lessons" },
  { label: "Gerar Post para Divulgação das Minhas Aulas", shortLabel: "Posts", href: "/dashboard/teacher?tab=sales-boost" },
  { label: "Responder Dúvidas de Alunos", shortLabel: "Dúvidas", href: "/dashboard/teacher?tab=doubts", alertKey: "doubts" },
  { label: "Acessar Aula Particular Agendada", shortLabel: "Aula Particular", href: "/minhas-aulas-agendadas", alertKey: "scheduledToday" },
  { label: "Atualizar Agenda", shortLabel: "Agenda", href: "/dashboard/teacher?tab=agenda", alertKey: "agendaOutdated" },
  { label: "Ver Minha Página Pública", shortLabel: "Página Pública", href: "__teacher_public_page__" },
];

const adminMenuItems: MenuItem[] = [
  { label: "Aprovação de Conteúdos", shortLabel: "Ap. Conteúdos", href: "/dashboard/admin?tab=content", alertKey: "adminPendingContent" },
  { label: "Aprovação de Dúvidas", shortLabel: "Ap. Dúvidas", href: "/dashboard/admin?tab=doubts", alertKey: "adminPendingDoubts" },
  { label: "Aprovação de Páginas de Professores", shortLabel: "Ap. Páginas", href: "/dashboard/admin?tab=profile-approvals", alertKey: "adminPendingProfileChanges" },
  { label: "Pagamento de Professores", shortLabel: "Pagamentos", href: "/dashboard/admin?tab=compensation" },
  { label: "Vencimento de Assinaturas", shortLabel: "Vencimentos", href: "/dashboard/admin?tab=subscriptions", alertKey: "adminExpiringSubscriptions" },
  { label: "Monitoramento de E-mails", shortLabel: "E-mails", href: "/dashboard/admin?tab=emails" },
  { label: "Posts de Divulgação", shortLabel: "Posts", href: "/dashboard/admin?tab=sales-posts" },
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
  const location = useLocation();
  const { user, role, profile, signOut } = useAuth();
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
  const teacherSlug = (profile as { slug?: string | null } | null)?.slug ?? "";
  const resolvedBase = baseMenu
    .map((item) => {
      // Hide "Ver Minha Página Pública" until the teacher has a slug.
      if (item.href === "__teacher_public_page__") {
        if (!teacherSlug) return null;
        return { ...item, href: `/${teacherSlug}` };
      }
      return item;
    })
    .filter(Boolean) as MenuItem[];
  const dashboardPath =
    role === "admin"
      ? "/dashboard/admin"
      : role === "teacher"
        ? "/dashboard/teacher"
        : "/dashboard/student";
  const meuPainelItem: MenuItem = { label: role === "admin" ? "Painel Administrativo" : "Meu Painel", shortLabel: "Painel", href: dashboardPath };
  let menuItems = user && role === "student" && hasActiveSubscription
    ? [subscriberMenuItem, ...resolvedBase]
    : resolvedBase;
  if (user) {
    menuItems = [meuPainelItem, ...menuItems];
  }

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
      case "adminPendingProfileChanges":
        return adminAlerts.pendingProfileChanges;
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
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const term = `%${searchQuery.trim()}%`;
      const [lessonsRes, examsRes, aiRes] = await Promise.all([
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
        supabase
          .from("ai_canonical_contents")
          .select("id, assunto, disciplina, kit")
          .eq("status", "ready")
          .eq("visibility", "public_canonical")
          .or(`assunto.ilike.${term},disciplina.ilike.${term}`)
          .limit(5),
      ]);
      const results: SearchResult[] = [
        ...(lessonsRes.data || []).map((l) => ({ id: l.id, title: l.title, type: "lesson" as const })),
        ...(examsRes.data || []).map((e) => ({ id: e.id, title: e.title, type: "exam_solution" as const })),
        ...((aiRes.data as any[]) || []).map((k) => ({
          id: k.id,
          title: (k.kit as any)?.titulo || k.assunto,
          type: "ai_kit" as const,
        })),
      ];
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.type === "ai_kit" ? `/conteudo-ia/${result.id}` : `/video/${result.id}`);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSignOut = async () => {
    setMobileOpen(false);
    await signOut();
    navigate("/");
  };

  const handleHashNav = (hash: string) => {
    const id = hash.replace(/^#/, "");
    setMobileOpen(false);
    if (location.pathname === "/") {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.hash = id;
      }
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <>
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      data-fixed-header
      className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-12 lg:px-20">
        <Link to="/" className="flex flex-col items-center justify-center gap-0 leading-none shrink-0 self-center">
          {(() => {
            // Escolhe a variante da logomarca de acordo com o plano de fundo
            // configurado em Identidade Visual: fundo claro -> logo escura;
            // fundo escuro -> logo clara. Cai para a logo legada se faltar.
            const isLightBg = typeof document !== "undefined" &&
              document.documentElement.getAttribute("data-theme") === "light";
            const preferred = isLightBg ? branding?.logo_url_light_bg : branding?.logo_url_dark_bg;
            const fallback = isLightBg ? branding?.logo_url_dark_bg : branding?.logo_url_light_bg;
            const logoSrc = preferred || fallback || branding?.logo_url;
            return logoSrc && !branding?.use_text_logo ? (
            <img
              ref={logoRef}
              src={logoSrc}
              alt={branding?.platform_name || "Logo"}
              className="h-11 md:h-14 max-w-[240px] md:max-w-[300px] object-contain block"
              onLoad={(e) => setLogoWidth((e.target as HTMLImageElement).getBoundingClientRect().width)}
            />
          ) : (
            <span className="font-display text-xl font-bold text-gradient">
              {branding?.platform_name || "Revisão Fácil"}
            </span>
          );
          })()}
          {slogan && (
            <span
              className="-mt-2 md:-mt-3 leading-none text-center whitespace-nowrap overflow-hidden"
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

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 overflow-hidden lg:flex">
          {menuItems.map((item) => {
            if (item.children && item.children.length > 0) {
              return (
                <div key={item.label} className="relative group">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap"
                  >
                    {item.shortLabel ?? item.label}
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
              "relative inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap";
            const alertBadge = hasAlert ? (
              <span
                aria-label="Pendência"
                title="Pendência"
                className="inline-block h-1.5 w-1.5 rounded-full bg-destructive"
              />
            ) : null;
            const label = item.shortLabel ?? item.label;
            return href.startsWith("#") ? (
              <a
                key={item.label}
                href={`/${href}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleHashNav(href);
                }}
                className={className}
              >
                {label}
                {alertBadge}
              </a>
            ) : (
              <Link key={item.label} to={href} className={className}>
                {label}
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
                            {result.type === "lesson"
                              ? "📖 Aula"
                              : result.type === "exam_solution"
                              ? "📝 Prova"
                              : "🤖 IA"}
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
            className="group inline-flex items-center gap-2 rounded-full px-3 py-2 transition-colors hover:bg-primary hover:text-primary-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="hidden text-sm font-medium text-foreground group-hover:text-primary-foreground sm:inline">Menu</span>
          </button>
        </div>
      </div>

    </motion.nav>
    <AnimatePresence>
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3 md:px-8">
            <span className="font-display text-lg font-semibold text-foreground">Menu</span>
            <button
              type="button"
              className="rounded-full p-2 transition-colors hover:bg-secondary"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {user && role === "student" && (
              <div className="md:col-span-2 lg:col-span-3">
                <ContinueWatchingMenu onNavigate={() => setMobileOpen(false)} />
              </div>
            )}
            {menuItems.map((item) => {
              if (item.children && item.children.length > 0) {
                return (
                  <div key={item.label} className="flex min-w-0 flex-col gap-2 rounded-md border border-border/60 bg-secondary/40 p-4">
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    <div className="flex flex-col gap-2 border-l border-border pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className="inline-flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="min-w-0 break-words">{child.label}</span>
                          {alertActive(child.alertKey) && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
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
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  ● Pendência
                </span>
              ) : null;
              const menuLinkClassName = "inline-flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-md bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80";
              return href.startsWith("#") ? (
                <a
                  key={item.label}
                  href={`/${href}`}
                  className={menuLinkClassName}
                  onClick={(e) => {
                    e.preventDefault();
                    handleHashNav(href);
                  }}
                >
                  <span className="min-w-0 break-words">{item.label}</span>
                  {alertBadge}
                </a>
              ) : (
                <Link key={item.label} to={href} className={menuLinkClassName} onClick={() => setMobileOpen(false)}>
                  <span className="min-w-0 break-words">{item.label}</span>
                  {alertBadge}
                </Link>
              );
            })}
            {!user && (
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="h-12 w-full gap-2 font-display">
                  <User className="h-4 w-4" /> Entrar
                </Button>
              </Link>
            )}
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <span>Sair</span>
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Navbar;
