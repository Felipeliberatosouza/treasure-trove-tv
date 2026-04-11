import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUpCircle, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
}: Props) {
  const navigate = useNavigate();
  const label = RESOURCE_LABELS[resourceType] || resourceType;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
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
              <>
                Você não possui uma assinatura ativa para acessar{" "}
                <Badge variant="secondary" className="mx-1">{label}</Badge>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Upgrade option */}
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={() => {
              onClose();
              navigate("/#planos");
            }}
          >
            <ArrowUpCircle className="h-4 w-4" />
            {hasSubscription ? "Fazer upgrade de plano" : "Ver planos de assinatura"}
          </Button>

          {/* Individual purchase */}
          {individualPrice !== null && individualPrice > 0 && (
            <div className="space-y-1.5">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onBuyIndividual?.();
                  onClose();
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Comprar avulso por R$ {individualPrice.toFixed(2).replace(".", ",")}
              </Button>
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pl-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                A compra avulsa dá direito a <strong>1 único uso</strong>. Para mais acessos, assine um plano ou compre novamente.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Ao fazer upgrade, você terá acesso a mais recursos e limites maiores.
        </p>
      </DialogContent>
    </Dialog>
  );
}
