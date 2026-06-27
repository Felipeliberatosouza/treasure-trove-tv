import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Phone, Loader2, CheckCircle2 } from "lucide-react";

interface PhoneVerificationProps {
  phone: string;
  onPhoneChange: (value: string) => void;
  onVerified: (phone: string) => void;
  verified?: boolean;
  className?: string;
}

const PhoneVerification = ({ phone, onPhoneChange, onVerified, verified = false, className = "" }: PhoneVerificationProps) => {
  const [step, setStep] = useState<"input" | "code">(verified ? "input" : "input");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendCooldown, setSendCooldown] = useState(0);
  const [isVerified, setIsVerified] = useState(verified);
  const originalPhone = useRef(phone);

  useEffect(() => {
    setIsVerified(verified);
    originalPhone.current = phone;
  }, [verified]);

  // Reset verification if phone changes
  useEffect(() => {
    if (phone !== originalPhone.current && isVerified) {
      setIsVerified(false);
      setStep("input");
      setCode("");
    }
  }, [phone, isVerified]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Send cooldown timer (initial send button)
  useEffect(() => {
    if (sendCooldown <= 0) return;
    const timer = setTimeout(() => setSendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [sendCooldown]);

  const sendCode = useCallback(async (targetChannel?: "sms" | "whatsapp") => {
    if (!isValidBrazilianPhone(phone)) {
      toast.error("Informe um celular válido com DDD (11 dígitos)");
      return;
    }
    const effectiveChannel = targetChannel || channel;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-phone-code", {
        body: { phone, channel: effectiveChannel },
      });

      if (error) {
        toast.error(error.message || "Erro ao enviar código");
        setSendCooldown(60);
        return;
      }

      if (!data?.ok) {
        toast.error(data?.error || "Erro ao enviar código");
        if (data?.diagnostics?.rateLimit) {
          setSendCooldown(60);
        }
        return;
      }

      toast.success(`Código enviado via ${effectiveChannel === "sms" ? "SMS" : "WhatsApp"}!`);
      setStep("code");
      setCountdown(60);
      setSendCooldown(60);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar código");
    } finally {
      setSending(false);
    }
  }, [phone, channel]);

  const verifyCode = useCallback(async () => {
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-phone-code", {
        body: { phone, code: cleanCode },
      });

      if (error) {
        toast.error(error.message || "Erro ao verificar código");
        return;
      }

      if (!data?.ok) {
        toast.error(data?.error || "Erro ao verificar código");
        return;
      }

      if (data?.verified) {
        toast.success("Celular verificado com sucesso!");
        setIsVerified(true);
        originalPhone.current = phone;
        onVerified(phone);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar código");
    } finally {
      setVerifying(false);
    }
  }, [phone, code, onVerified]);

  const handleCodeChange = useCallback((value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, 6));
  }, []);

  const handleChangeNumber = useCallback(() => {
    setStep("input");
    setCode("");
    onPhoneChange("");
  }, [onPhoneChange]);

  const sendVia = useCallback(async (targetChannel: "sms" | "whatsapp") => {
    setChannel(targetChannel);
    await sendCode(targetChannel);
  }, [sendCode]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          Celular <span className="text-destructive">*</span>
          {isVerified && (
            <span className="inline-flex items-center gap-1 ml-2 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Verificado
            </span>
          )}
        </label>
        <PhoneInput value={phone} onChange={onPhoneChange} placeholder="(00) 00000-0000" required />
      </div>

      {!isVerified && isValidBrazilianPhone(phone) && step === "input" && (
        <div className="space-y-2" key="input-step">
          <p className="text-xs text-muted-foreground">Enviar código de verificação via:</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={channel === "sms" ? "default" : "outline"}
              size="sm"
              onClick={() => sendVia("sms")}
              disabled={sending || sendCooldown > 0}
              className="flex-1 gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" /> SMS
            </Button>
            <Button
              type="button"
              variant={channel === "whatsapp" ? "default" : "outline"}
              size="sm"
              onClick={() => sendVia("whatsapp")}
              disabled={sending || sendCooldown > 0}
              className="flex-1 gap-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
          </div>
        </div>
      )}

      {!isVerified && step === "code" && (
        <div className="space-y-3" key="code-step">
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Código enviado para o celular via {channel === "sms" ? "SMS" : "WhatsApp"}
          </div>
          <p className="text-xs text-muted-foreground">
            Digite o código de 6 dígitos:
          </p>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => handleCodeChange(event.target.value)}
            onPaste={(event) => handleCodeChange(event.clipboardData.getData("text"))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && code.length === 6 && !verifying) {
                event.preventDefault();
                verifyCode();
              }
            }}
            aria-label="Código de verificação recebido por SMS ou WhatsApp"
            placeholder="000000"
            className="h-12 bg-secondary text-center font-mono text-2xl font-semibold tracking-[0.35em] text-foreground placeholder:text-muted-foreground/40"
          />
          <Button
            type="button"
            onClick={verifyCode}
            disabled={verifying || code.length !== 6}
            size="sm"
            className="w-full"
          >
            {verifying ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Verificando...</> : "Verificar código"}
          </Button>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleChangeNumber}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Alterar número
            </button>
            {countdown > 0 || sendCooldown > 0 ? (
              <span className="text-xs text-muted-foreground">Reenviar em {Math.max(countdown, sendCooldown)}s</span>
            ) : null}
          </div>

          {countdown <= 0 && sendCooldown <= 0 && (
            <div className="space-y-2 rounded-md border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Não recebeu? Reenviar via:</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={channel === "sms" ? "default" : "outline"}
                  size="sm"
                  onClick={() => sendVia("sms")}
                  disabled={sending}
                  className="flex-1 gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5" /> SMS
                </Button>
                <Button
                  type="button"
                  variant={channel === "whatsapp" ? "default" : "outline"}
                  size="sm"
                  onClick={() => sendVia("whatsapp")}
                  disabled={sending}
                  className="flex-1 gap-1.5"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhoneVerification;
