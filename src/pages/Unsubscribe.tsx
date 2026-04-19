import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MailX, CheckCircle, AlertCircle, Loader2, Mail, MessageSquare } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success_all" | "success_marketing" | "error";
type FeedbackState = "hidden" | "asking" | "submitting" | "submitted";
const FEEDBACK_OPTIONS = [
  { value: "too_many", label: "Recebo demais" },
  { value: "not_relevant", label: "Não é relevante" },
  { value: "never_signed_up", label: "Nunca me cadastrei" },
  { value: "other", label: "Outro" },
] as const;

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState<"all" | "marketing" | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [acceptsMarketing, setAcceptsMarketing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<FeedbackState>("hidden");
  const [feedbackReason, setFeedbackReason] = useState<string>("");
  const [feedbackComment, setFeedbackComment] = useState<string>("");

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
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (typeof data.accepts_marketing === "boolean") setAcceptsMarketing(data.accepts_marketing);
        if (data.valid === true) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async (scope: "all" | "marketing") => {
    setProcessing(scope);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token, scope },
      });
      if (data?.success && scope === "all") setStatus("success_all");
      else if (data?.success && scope === "marketing") setStatus("success_marketing");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      setProcessing(null);
    }
  };

  const firstName = name ? name.trim().split(" ")[0] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6 space-y-5">
          {status === "loading" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Verificando seu link...</p>
            </div>
          )}

          {status === "valid" && (
            <>
              <div className="text-center space-y-3">
                <MailX className="h-12 w-12 mx-auto text-destructive" />
                <h1 className="text-xl font-bold">
                  {firstName ? `Olá, ${firstName}!` : "Olá!"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  Sentimos muito que você queira parar de receber nossos e-mails
                  {email ? ` em ${email}` : ""}. Antes de ir, escolha o que prefere:
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold">
                        Apenas parar e-mails promocionais
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Você não receberá novidades, ofertas e dicas — mas continuará
                        recebendo e-mails importantes sobre sua conta, pagamentos e dúvidas.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnsubscribe("marketing")}
                    disabled={processing !== null || !acceptsMarketing}
                    variant="outline"
                    className="w-full"
                  >
                    {processing === "marketing" && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    {acceptsMarketing
                      ? "Parar apenas marketing"
                      : "Marketing já está desativado"}
                  </Button>
                </div>

                <div className="rounded-lg border border-destructive/30 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <MailX className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold">
                        Descadastrar de todos os e-mails
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Você não receberá mais nenhum e-mail da Revisão Fácil,
                        incluindo notificações importantes da sua conta.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnsubscribe("all")}
                    disabled={processing !== null}
                    variant="destructive"
                    className="w-full"
                  >
                    {processing === "all" && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Descadastrar de tudo
                  </Button>
                </div>
              </div>
            </>
          )}

          {status === "success_marketing" && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h1 className="text-xl font-bold">
                {firstName ? `Pronto, ${firstName}!` : "Pronto!"}
              </h1>
              <p className="text-muted-foreground">
                Você não receberá mais e-mails promocionais da Revisão Fácil.
                Continuaremos enviando apenas comunicações essenciais sobre sua conta.
              </p>
            </div>
          )}

          {status === "success_all" && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h1 className="text-xl font-bold">E-mail descadastrado</h1>
              <p className="text-muted-foreground">
                {firstName ? `${firstName}, seu` : "Seu"} e-mail foi descadastrado com
                sucesso. Você não receberá mais nenhum e-mail da Revisão Fácil a partir
                de hoje.
              </p>
            </div>
          )}

          {status === "already" && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <h1 className="text-xl font-bold">
                {firstName ? `${firstName}, sua` : "Sua"} inscrição já foi cancelada
              </h1>
              <p className="text-muted-foreground">
                Você não está mais recebendo nossos e-mails. Caso mude de ideia, entre
                em contato com nosso suporte.
              </p>
            </div>
          )}

          {status === "invalid" && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Link inválido</h1>
              <p className="text-muted-foreground">
                Este link de cancelamento é inválido ou expirou.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Erro</h1>
              <p className="text-muted-foreground">
                Ocorreu um erro ao processar sua solicitação. Tente novamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
