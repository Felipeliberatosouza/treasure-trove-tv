import { useState, useRef, useEffect, forwardRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const UserMenu = forwardRef<HTMLDivElement>((_, forwardedRef) => {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <User className="h-4 w-4 text-primary" />
        <span className="max-w-[100px] truncate">{firstName}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg z-50">
          <Link
            to={dashboardPath}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" /> Meu Painel
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-secondary transition-colors"
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
