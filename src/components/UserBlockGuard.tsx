import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "react-router-dom";

/**
 * Guard global que detecta se o usuário autenticado está sob bloqueio ativo
 * em `user_blocks`. Se estiver:
 *  - Exibe um aviso modal não-fechável.
 *  - Faz signOut imediatamente (encerra a sessão no cliente e revoga o token).
 *
 * Polling leve a cada 60s + verificação ao montar e ao trocar de usuário.
 */
interface ActiveBlock {
  id: string;
  reason: string;
  blocked_at: string;
  blocked_until: string;
  metadata: Record<string, unknown>;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

const UserBlockGuard = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  // Em rotas de aula (`/aula/:id`), a própria VideoPage renderiza um screen
  // dedicado de "Acesso Suspenso" — evitamos modal + signOut aqui para que o
  // usuário possa visualizar a data/hora de desbloqueio sem perder a sessão.
  const isLessonRoute = location.pathname.startsWith("/aula/");
  const [block, setBlock] = useState<ActiveBlock | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setBlock(null);
      return;
    }

    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase
        .from("user_blocks")
        .select("id, reason, blocked_at, blocked_until, metadata")
        .eq("user_id", user.id)
        .is("unblocked_at", null)
        .gt("blocked_until", new Date().toISOString())
        .order("blocked_until", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("[UserBlockGuard] check failed", error);
        return;
      }
      if (data) {
        setBlock(data as ActiveBlock);
        // Agenda expiração precisa: assim que `blocked_until` passar, libera o
        // estado local automaticamente (com pequeno colchão de 1s para clock skew).
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        const ms = Math.max(
          1_000,
          new Date(data.blocked_until).getTime() - Date.now() + 1_000
        );
        expiryTimer.current = setTimeout(() => {
          if (!cancelled) setBlock(null);
        }, ms);
      } else {
        // Sem bloqueio ativo — garante que qualquer estado anterior seja limpo.
        setBlock(null);
        if (expiryTimer.current) {
          clearTimeout(expiryTimer.current);
          expiryTimer.current = null;
        }
      }
    };

    check();
    const t = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
    };
  }, [user?.id]);

  // Sai imediatamente ao detectar bloqueio: o modal continua visível porque
  // mantemos o estado local até o usuário confirmar.
  useEffect(() => {
    if (block && !isLessonRoute) {
      void signOut();
    }
  }, [block, signOut, isLessonRoute]);

  if (!block || isLessonRoute) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Acesso temporariamente bloqueado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-sm">
            <span className="block">
              Detectamos múltiplas tentativas de violação das políticas de proteção de
              conteúdo na sua conta. Por segurança, seu acesso foi suspenso até{" "}
              <strong>{formatDate(block.blocked_until)}</strong>.
            </span>
            <span className="block text-muted-foreground">
              Se você acredita que isso foi um engano, entre em contato com o suporte.
              Esta atividade foi registrada e revisada por nossa equipe.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setBlock(null)}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UserBlockGuard;