import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Página de destino do link de convite: registra o acesso, credita o indicador
 * e encaminha o visitante para o cadastro já com o código de indicação.
 */
const ConviteIndicacao = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Validando seu convite...");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      let referralCode: string | null = null;
      try {
        const { data } = await supabase.functions.invoke("referral-invite", {
          body: { action: "claim", token },
        });
        referralCode = (data as { referralCode?: string } | null)?.referralCode ?? null;
      } catch (e) {
        console.error("claim invite failed", e);
      }
      if (cancelled) return;
      if (referralCode) {
        try {
          localStorage.setItem("rf_referral_code", referralCode);
        } catch {
          /* ignore */
        }
      }
      setMessage("Tudo certo! Levando você para o cadastro...");
      navigate(referralCode ? `/signup/student?ref=${referralCode}` : "/signup/student", {
        replace: true,
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

export default ConviteIndicacao;
