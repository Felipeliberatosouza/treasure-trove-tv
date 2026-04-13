import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Phone, Loader2, CheckCircle2, RotateCcw } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Scroll container into view when switching to code step (prevents auto-focus scroll jump)
  useEffect(() => {
    if (step === "code" && containerRef.current) {
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [step]);

  const sendCode = async () => {
    if (!isValidBrazilianPhone(phone)) {
      toast.error("Informe um celular válido com DDD (11 dígitos)");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-phone-code", {
        body: { phone, channel },
      });
      if (error) {
        // Handle non-2xx (e.g. 429 rate-limit) gracefully
        let errorMsg = "Erro ao enviar código";
        try {
          if (typeof error === "object" && "context" in error) {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) errorMsg = body.error;
            }
          } else if (error.message) {
            errorMsg = error.message;
          }
        } catch {
          // ignore parse errors
        }
        toast.error(errorMsg);
        setSendCooldown(60);
        setSending(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Código enviado via ${channel === "sms" ? "SMS" : "WhatsApp"}!`);
        setStep("code");
        setCountdown(60);
        setSendCooldown(60);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar código");
    }
    setSending(false);
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-phone-code", {
        body: { phone, code },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.verified) {
        toast.success("Celular verificado com sucesso!");
        setIsVerified(true);
        originalPhone.current = phone;
        onVerified(phone);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar código");
    }
    setVerifying(false);
  };

  return (
    <div className={`space-y-3 ${className}`} ref={containerRef}>
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Enviar código de verificação via:</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={channel === "sms" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannel("sms")}
              className="flex-1 gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" /> SMS
            </Button>
            <Button
              type="button"
              variant={channel === "whatsapp" ? "default" : "outline"}
              size="sm"
              onClick={() => setChannel("whatsapp")}
              className="flex-1 gap-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
          </div>
          <Button
            type="button"
            onClick={sendCode}
            disabled={sending || sendCooldown > 0}
            size="sm"
            className="w-full"
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Enviando...</>
            ) : sendCooldown > 0 ? (
              `Aguarde ${sendCooldown}s para reenviar`
            ) : (
              "Enviar código"
            )}
          </Button>
        </div>
      )}

      {!isVerified && step === "code" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Digite o código de 6 dígitos enviado via {channel === "sms" ? "SMS" : "WhatsApp"}:
          </p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus={false} data-no-autofocus>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
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
              onClick={() => { setStep("input"); setCode(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Alterar número
            </button>
            {countdown > 0 ? (
              <span className="text-xs text-muted-foreground">Reenviar em {countdown}s</span>
            ) : (
              <button
                type="button"
                onClick={sendCode}
                disabled={sending}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reenviar código
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneVerification;
