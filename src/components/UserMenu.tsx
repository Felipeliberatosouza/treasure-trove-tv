import { useState, useRef, useEffect, forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, LogOut, LayoutDashboard, ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings, BrandingSettings } from "@/hooks/usePlatformSettings";
import { useReferralCredits } from "@/hooks/useReferralCredits";
import { useResourceLimit } from "@/hooks/useResourceLimit";

const UserMenu = forwardRef<HTMLDivElement>((_, forwardedRef) => {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: branding } = usePlatformSettings("branding");
  const accentColor = (branding as BrandingSettings | null)?.accent_color || "#f59e0b";
  const { totalRemaining, aiCredits } = useReferralCredits();
  const { planName } = useResourceLimit();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const firstName = profile?.name?.split(" ")[0] || user.email?.split("@")[0] || "Usuário";
  const dashboardPath = role === "admin" ? "/dashboard/admin" : role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-black transition-colors hover:bg-white/90"
      >
        <User className="h-4 w-4 text-primary" />
        <span className="flex flex-col items-start leading-tight">
          <span className="max-w-[110px] truncate">{firstName}</span>
          {role === "student" && planName && (
            <span className="max-w-[130px] truncate text-[10px] font-semibold text-primary">
              Plano {planName}
            </span>
          )}
          {role === "student" && (
            <span className="text-[10px] font-normal text-black/60">
              {aiCredits} Crédito{aiCredits === 1 ? "" : "s"} de IA
              {totalRemaining > 0 ? ` · ${totalRemaining} acesso${totalRemaining === 1 ? "" : "s"} grátis` : ""}
            </span>
          )}
        </span>
        <ChevronDown className={`h-3 w-3 text-black transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg z-50">
          <Link
            to={dashboardPath}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" /> {role === "admin" ? "Painel Administrativo" : "Meu Painel"}
          </Link>
          {role === "student" && (
            <Link
              to="/creditos-ia"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <Sparkles className="h-4 w-4" /> Comprar Créditos de IA
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            style={{ color: accentColor }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
});
UserMenu.displayName = "UserMenu";

export default UserMenu;
