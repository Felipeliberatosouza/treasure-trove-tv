import { Link } from "react-router-dom";
import { ShieldAlert, Clock, ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AccessSuspendedScreenProps {
  blockedUntil: string;
  reason?: string | null;
}

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const formatRemaining = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "alguns instantes";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && mins > 0) parts.push(`${mins}min`);
  return parts.join(" ") || "alguns instantes";
};

const AccessSuspendedScreen = ({ blockedUntil, reason }: AccessSuspendedScreenProps) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 bg-background">
      <Card className="w-full max-w-xl border-destructive/40 shadow-lg">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Acesso temporariamente suspenso
            </h1>
            <p className="text-sm text-muted-foreground">
              Identificamos atividades que violam nossas políticas de proteção de
              conteúdo. Por segurança, o acesso a aulas e materiais foi suspenso.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Liberação automática em
                </p>
                <p className="text-base font-semibold text-foreground">
                  {formatDateTime(blockedUntil)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tempo restante aproximado: {formatRemaining(blockedUntil)}
                </p>
              </div>
            </div>
            {reason ? (
              <div className="text-xs text-muted-foreground border-t pt-3">
                <span className="font-medium text-foreground">Motivo registrado:</span>{" "}
                {reason}
              </div>
            ) : null}
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 leading-relaxed">
            Você não precisa fazer nada — assim que o prazo acima for atingido, o
            acesso será restabelecido automaticamente. Esta atividade foi registrada
            em nossos logs de auditoria.
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao início
              </Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/contato">
                <LifeBuoy className="h-4 w-4 mr-2" />
                Falar com o suporte
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessSuspendedScreen;