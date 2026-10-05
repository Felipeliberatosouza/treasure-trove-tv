import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBetaMode } from "@/hooks/useBetaMode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const BETA_SIGNUP_EVENT = "rf:beta-signup";
export const openBetaSignup = () => window.dispatchEvent(new Event(BETA_SIGNUP_EVENT));

/** Regiões que continuam livres para visitantes (navegação, login, avisos). */
const ALLOW = 'header, nav, footer, [role="dialog"], [role="alertdialog"], [data-beta-allow], [aria-label="Aviso de versão beta"], [data-radix-popper-content-wrapper]';
const RESOURCE_LINK = /^\/(video|conteudo-ia|trabalho|checkout|creditos-ia|estudar-ia|minhas-|meus-)/;

/**
 * Na versão beta, visitantes não logados que tentam usar qualquer recurso
 * recebem um convite para criar conta (tudo gratuito no beta).
 * Usuários logados seguem as regras normais (teste grátis / créditos).
 */
export default function BetaSignupGate() {
  const { beta, loaded } = useBetaMode();
  const { user, loading } = useAuth() as any;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const active = beta && loaded && !loading && !user;

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(BETA_SIGNUP_EVENT, show);
    return () => window.removeEventListener(BETA_SIGNUP_EVENT, show);
  }, []);

  useEffect(() => {
    if (!active) return;
    const isGated = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el?.closest || el.closest(ALLOW)) return false;
      const link = el.closest("a[href]") as HTMLAnchorElement | null;
      if (link) {
        const url = new URL(link.href, location.href);
        return url.origin === location.origin && RESOURCE_LINK.test(url.pathname);
      }
      return !!el.closest('button, [role="button"], video, input[type="submit"]');
    };
    const onClick = (e: MouseEvent) => {
      if (!isGated(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    };
    const onSubmit = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.(ALLOW)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [active]);

  if (!beta || user) return null;

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Versão beta: tudo gratuito!</DialogTitle>
          <DialogDescription className="text-center">
            A Revisão Fácil está em versão beta e todos os conteúdos estão liberados gratuitamente. Basta fazer o seu cadastro para começar a usar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={() => go("/signup/student")}>Fazer meu cadastro grátis</Button>
          <Button variant="outline" onClick={() => go("/login")}>Já tenho conta</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
