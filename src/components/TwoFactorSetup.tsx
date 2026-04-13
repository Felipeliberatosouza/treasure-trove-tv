import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldOff, Copy, Loader2 } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";

const TwoFactorSetup = () => {
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
  const { logAction } = useAuditLog();

  const checkEnrollment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totpFactors = data.totp.filter((f) => f.status === "verified");
      setIsEnrolled(totpFactors.length > 0);
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

      // Create challenge for verification
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

  const unenroll = async () => {
    setUnenrolling(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactors = data?.totp.filter((f) => f.status === "verified") ?? [];
      for (const factor of totpFactors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      toast.success("2FA desativado com sucesso");
      await logAction("mfa_disabled");
      setIsEnrolled(false);
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
