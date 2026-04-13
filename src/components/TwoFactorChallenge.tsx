import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

interface TwoFactorChallengeProps {
  onVerified: () => void;
  onCancel: () => void;
}

const TwoFactorChallenge = ({ onVerified, onCancel }: TwoFactorChallengeProps) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

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

  const handleRecovery = async () => {
    const cleaned = recoveryCode.trim();
    if (!cleaned) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-recovery-code", {
        body: { code: cleaned },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Código de recuperação inválido");
        setRecoveryCode("");
        return;
      }

      toast.success("Código de recuperação aceito. O 2FA foi desativado da sua conta.");
      onVerified();
    } catch {
      toast.error("Erro ao verificar código de recuperação");
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
          {useRecovery ? (
            <KeyRound className="h-12 w-12 text-primary" />
          ) : (
            <ShieldCheck className="h-12 w-12 text-primary" />
          )}
        </div>
        <h2 className="font-display text-2xl font-bold">
          {useRecovery ? "Código de Recuperação" : "Verificação em Duas Etapas"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {useRecovery
            ? "Digite um dos seus códigos de recuperação para acessar sua conta"
            : "Digite o código de 6 dígitos do seu aplicativo autenticador"}
        </p>
      </div>

      <div className="space-y-4">
        {useRecovery ? (
          <>
            <Input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="text-center text-xl tracking-widest font-mono h-14"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && recoveryCode.trim()) handleRecovery();
              }}
            />
            <Button
              onClick={handleRecovery}
              disabled={verifying || !recoveryCode.trim()}
              className="w-full font-display font-semibold"
              size="lg"
            >
              {verifying ? "Verificando..." : "Usar Código de Recuperação"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ Ao usar um código de recuperação, o 2FA será desativado da sua conta. Você poderá reativá-lo nas configurações.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setUseRecovery(false);
                setRecoveryCode("");
              }}
              className="w-full text-sm"
            >
              Voltar ao código do app
            </Button>
          </>
        ) : (
          <>
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
              onClick={() => {
                setUseRecovery(true);
                setCode("");
              }}
              className="w-full text-sm"
            >
              <KeyRound className="h-4 w-4 mr-1" />
              Perdeu acesso ao app? Use um código de recuperação
            </Button>
          </>
        )}
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
