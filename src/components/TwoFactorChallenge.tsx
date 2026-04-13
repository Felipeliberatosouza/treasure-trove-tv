import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface TwoFactorChallengeProps {
  onVerified: () => void;
  onCancel: () => void;
}

const TwoFactorChallenge = ({ onVerified, onCancel }: TwoFactorChallengeProps) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp.find((f) => f.status === "verified");
      if (!totpFactor) {
        toast.error("Nenhum fator 2FA encontrado");
        return;
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challengeError) throw challengeError;

      const { error } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });
      if (error) throw error;

      onVerified();
    } catch (err: any) {
      toast.error("Código inválido. Tente novamente.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <ShieldCheck className="h-12 w-12 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold">Verificação em Duas Etapas</h2>
        <p className="text-sm text-muted-foreground">
          Digite o código de 6 dígitos do seu aplicativo autenticador
        </p>
      </div>

      <div className="space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="text-center text-2xl tracking-[0.5em] font-mono h-14"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6) handleVerify();
          }}
        />
        <Button
          onClick={handleVerify}
          disabled={verifying || code.length !== 6}
          className="w-full font-display font-semibold"
          size="lg"
        >
          {verifying ? "Verificando..." : "Verificar"}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full text-sm"
        >
          Cancelar e voltar ao login
        </Button>
      </div>
    </motion.div>
  );
};

export default TwoFactorChallenge;
