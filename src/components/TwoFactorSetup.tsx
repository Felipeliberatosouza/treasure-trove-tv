import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldOff, Copy, Loader2, Download, KeyRound } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";
import { generateRecoveryCodes, hashCode } from "@/lib/recoveryCodeUtils";

interface TwoFactorSetupProps {
  onSetupComplete?: () => void;
}

const RecoveryCodesDisplay = ({ codes, onDone }: { codes: string[]; onDone: () => void }) => {
  const [confirmed, setConfirmed] = useState(false);

  const copyAll = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Códigos copiados!");
  };

  const downloadCodes = () => {
    const text = "CÓDIGOS DE RECUPERAÇÃO 2FA - Revisão Fácil\n" +
      "Guarde estes códigos em um local seguro.\nCada código só pode ser usado uma vez.\n\n" +
      codes.map((c, i) => `${i + 1}. ${c}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codigos-recuperacao-2fa.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <KeyRound className="h-5 w-5" />
        <span className="font-medium">Salve seus códigos de recuperação</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Se você perder acesso ao seu aplicativo autenticador, use um destes códigos para recuperar o acesso à sua conta. Cada código só pode ser usado uma vez.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-secondary/50 p-4">
        {codes.map((code, i) => (
          <code key={i} className="text-sm font-mono text-center py-1">
            {code}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={copyAll} className="flex-1">
          <Copy className="h-4 w-4 mr-1" /> Copiar
        </Button>
        <Button variant="outline" size="sm" onClick={downloadCodes} className="flex-1">
          <Download className="h-4 w-4 mr-1" /> Baixar
        </Button>
      </div>
      <div className="space-y-2 pt-2 border-t">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded"
          />
          Eu salvei meus códigos de recuperação em um local seguro
        </label>
        <Button onClick={onDone} disabled={!confirmed} className="w-full" size="sm">
          Concluir
        </Button>
      </div>
    </div>
  );
};

const TwoFactorSetup = ({ onSetupComplete }: TwoFactorSetupProps = {}) => {
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);
  const { logAction } = useAuditLog();

  const checkEnrollment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totpFactors = data.totp.filter((f) => f.status === "verified");
      const enrolled = totpFactors.length > 0;
      setIsEnrolled(enrolled);

      if (enrolled) {
        const { count } = await supabase
          .from("mfa_recovery_codes" as any)
          .select("*", { count: "exact", head: true })
          .eq("used", false);
        setRemainingCodes(count ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkEnrollment();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);

      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: data.id });
      if (challengeError) throw challengeError;
      setChallengeId(challengeData.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar configuração 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const saveRecoveryCodes = async (codes: string[]) => {
    // Delete old codes first
    await supabase.from("mfa_recovery_codes" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Hash and store new codes
    const rows = await Promise.all(
      codes.map(async (code) => ({
        code_hash: await hashCode(code),
        user_id: (await supabase.auth.getUser()).data.user!.id,
      }))
    );

    await supabase.from("mfa_recovery_codes" as any).insert(rows);
  };

  const verifyEnrollment = async () => {
    if (!factorId || !challengeId || verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode,
      });
      if (error) throw error;

      // Generate recovery codes
      const codes = generateRecoveryCodes(10);
      await saveRecoveryCodes(codes);
      setRecoveryCodes(codes);

      toast.success("2FA ativado com sucesso!");
      await logAction("mfa_enabled");
      setIsEnrolled(true);
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setChallengeId(null);
      setVerifyCode("");
    } catch (err: any) {
      toast.error(err.message || "Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const regenerateCodes = async () => {
    try {
      const codes = generateRecoveryCodes(10);
      await saveRecoveryCodes(codes);
      setRecoveryCodes(codes);
      toast.success("Novos códigos gerados!");
    } catch {
      toast.error("Erro ao gerar novos códigos");
    }
  };

  const unenroll = async () => {
    setUnenrolling(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactors = data?.totp.filter((f) => f.status === "verified") ?? [];
      for (const factor of totpFactors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      // Delete recovery codes
      await supabase.from("mfa_recovery_codes" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      toast.success("2FA desativado com sucesso");
      await logAction("mfa_disabled");
      setIsEnrolled(false);
      setRemainingCodes(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao desativar 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando status do 2FA...
      </div>
    );
  }

  // Show recovery codes after enrollment
  if (recoveryCodes) {
    return (
      <RecoveryCodesDisplay
        codes={recoveryCodes}
        onDone={() => {
          setRecoveryCodes(null);
          setRemainingCodes(10);
          onSetupComplete?.();
        }}
      />
    );
  }

  if (isEnrolled && !qrCode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-green-600">
          <ShieldCheck className="h-5 w-5" />
          <span className="font-medium">Autenticação de dois fatores está ativa</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Sua conta está protegida com autenticação de dois fatores via aplicativo autenticador.
        </p>
        {remainingCodes !== null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="h-4 w-4" />
            <span>{remainingCodes} código(s) de recuperação restante(s)</span>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateCodes}
          >
            <KeyRound className="h-4 w-4 mr-1" />
            Gerar novos códigos
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={unenroll}
            disabled={unenrolling}
          >
            <ShieldOff className="h-4 w-4 mr-1" />
            {unenrolling ? "Desativando..." : "Desativar 2FA"}
          </Button>
        </div>
      </div>
    );
  }

  if (qrCode && secret) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escaneie o QR code abaixo com seu aplicativo autenticador (Google Authenticator, Authy, etc.)
        </p>
        <div className="flex justify-center">
          <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-lg border" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Ou copie o código manualmente:</p>
          <div className="flex items-center gap-2">
            <code className="bg-secondary px-3 py-1.5 rounded text-xs font-mono flex-1 break-all">
              {secret}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(secret);
                toast.success("Código copiado!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Digite o código de 6 dígitos do app:</label>
          <Input
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="text-center text-lg tracking-widest font-mono"
          />
          <Button
            onClick={verifyEnrollment}
            disabled={verifying || verifyCode.length !== 6}
            className="w-full"
          >
            {verifying ? "Verificando..." : "Verificar e Ativar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-5 w-5" />
        <span>Autenticação de dois fatores não está ativa</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Adicione uma camada extra de segurança à sua conta. Você precisará de um aplicativo autenticador como Google Authenticator ou Authy.
      </p>
      <Button onClick={startEnroll} disabled={enrolling}>
        <ShieldCheck className="h-4 w-4 mr-1" />
        {enrolling ? "Configurando..." : "Ativar 2FA"}
      </Button>
    </div>
  );
};

export default TwoFactorSetup;
