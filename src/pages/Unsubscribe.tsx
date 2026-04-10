import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MailX, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: supabaseKey } }
        );
        const data = await res.json();
        if (data.valid === true) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Verificando...</p>
            </>
          )}
          {status === "valid" && (
            <>
              <MailX className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Cancelar inscrição</h1>
              <p className="text-muted-foreground">
                Tem certeza que deseja cancelar o recebimento de e-mails?
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar cancelamento
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h1 className="text-xl font-bold">Inscrição cancelada</h1>
              <p className="text-muted-foreground">
                Você não receberá mais e-mails desta plataforma.
              </p>
            </>
          )}
          {status === "already" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <h1 className="text-xl font-bold">Já cancelada</h1>
              <p className="text-muted-foreground">
                Sua inscrição já foi cancelada anteriormente.
              </p>
            </>
          )}
          {status === "invalid" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Link inválido</h1>
              <p className="text-muted-foreground">
                Este link de cancelamento é inválido ou expirou.
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Erro</h1>
              <p className="text-muted-foreground">
                Ocorreu um erro ao processar sua solicitação. Tente novamente.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
