import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUpCircle, ShoppingCart, Sparkles, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InviteFriendsPanel from "@/components/referral/InviteFriendsPanel";

const RESOURCE_LABELS: Record<string, string> = {
  revisao: "Revisão",
  resumo: "Resumo",
  simulado: "Simulado",
  top_questoes: "Top Questões",
  colinha: "Colinha",
  duvida: "Dúvida",
  aula_particular: "Aula Particular (50 min)",
};

interface Props {
  open: boolean;
  onClose: () => void;
  resourceType: string;
  used: number;
  total: number;
  hasSubscription: boolean;
  individualPrice: number | null;
  onBuyIndividual?: () => void;
  trialAlreadyUsed?: boolean;
  /** true quando o aluno tem créditos de indicação, mas o conteúdo não aceita créditos. */
  referralBlocked?: boolean;
}

export default function ResourceLimitModal({
  open,
  onClose,
  resourceType,
  used,
  total,
  hasSubscription,
  individualPrice,
  onBuyIndividual,
  trialAlreadyUsed,
  referralBlocked,
}: Props) {
  const navigate = useNavigate();
  const label = RESOURCE_LABELS[resourceType] || resourceType;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-base">Limite Atingido</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {hasSubscription ? (
              <>
                Você já utilizou <strong>{used}</strong> de <strong>{total}</strong>{" "}
                <Badge variant="secondary" className="mx-1">{label}</Badge> disponíveis no seu plano.
              </>
            ) : (
              <>Você não possui assinatura ativa!</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {referralBlocked && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-destructive">
                Este conteúdo precisa ser comprado e <strong>não pode ser acessado com os Créditos
                de IA Ganhos por Indicação</strong>. Assine um plano ou compre o conteúdo avulso para continuar.
              </p>
            </div>
          )}
          {trialAlreadyUsed && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                Você já utilizou seu <strong>teste grátis</strong> anteriormente e não pode iniciá-lo novamente. Assine um plano ou compre o conteúdo avulso para continuar.
              </p>
            </div>
          )}
          {/* CTA subscription */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              <Sparkles className="inline h-4 w-4 text-primary mr-1.5 -mt-0.5" />
              Para mais acessos, assine um plano.
            </p>
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => {
                onClose();
                navigate("/#pricing");
              }}
            >
              <ArrowUpCircle className="h-4 w-4" />
              {hasSubscription ? "Fazer upgrade de plano" : "Ver planos de assinatura"}
            </Button>
          </div>

          {/* Individual purchase */}
          {individualPrice !== null && individualPrice > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Prefere usar apenas este recurso?
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  onBuyIndividual?.();
                  onClose();
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Comprar avulso por R$ {individualPrice.toFixed(2).replace(".", ",")}
              </Button>
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  A compra avulsa dá direito a <strong>1 único uso</strong>. Para mais acessos, assine um plano ou compre novamente.
                </p>
              </div>
            </div>
          )}

          <InviteFriendsPanel
            variant="compact"
            eyebrow="Indique amigos: Créditos de IA + Cashback"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

