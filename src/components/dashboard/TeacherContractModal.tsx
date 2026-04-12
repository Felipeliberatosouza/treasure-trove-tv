import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { isValidCPF, formatCPF } from "@/lib/cpfValidator";
import { toast } from "sonner";
import { FileSignature, CheckCircle } from "lucide-react";

interface TeacherContractModalProps {
  open: boolean;
  onClose: () => void;
  onSigned: () => void;
}

interface ContractTemplate {
  contract_title: string;
  contract_body: string;
  platform_percentage: number;
}

const TeacherContractModal = ({ open, onClose, onSigned }: TeacherContractModalProps) => {
  const { user, profile } = useAuth();
  const { data: brandingData } = usePlatformSettings("branding");
  const { data: contactData } = usePlatformSettings("contact");
  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signatureCpf, setSignatureCpf] = useState("");

  useEffect(() => {
    const fetchTemplate = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "teacher_contract_template")
        .maybeSingle();
      if (data) setTemplate(data.value as unknown as ContractTemplate);
    };
    if (open) fetchTemplate();
  }, [open]);

  const platformName = brandingData?.platform_name || "Revisão Fácil";
  const platformAddress = (contactData as any)?.platform_address || "";
  const razaoSocial = (contactData as any)?.razao_social || "";
  const nomeFantasia = (contactData as any)?.nome_fantasia || "";
  const cnpj = (contactData as any)?.cnpj || "";
  const teacherName = profile?.name || "";
  const teacherAddress = (profile as any)?.address || "";
  const teacherPercentage = template ? 100 - template.platform_percentage : 70;
  const platformPercentage = template?.platform_percentage || 30;

  const numberToText = (n: number) => {
    const texts: Record<number, string> = {
      10: "dez", 15: "quinze", 20: "vinte", 25: "vinte e cinco",
      30: "trinta", 35: "trinta e cinco", 40: "quarenta", 50: "cinquenta",
      60: "sessenta", 70: "setenta", 75: "setenta e cinco", 80: "oitenta", 90: "noventa",
    };
    return texts[n] || String(n);
  };

  const renderContract = () => {
    if (!template) return "";
    const now = new Date();
    return template.contract_body
      .replace(/\{\{platform_name\}\}/g, platformName)
      .replace(/\{\{razao_social\}\}/g, razaoSocial)
      .replace(/\{\{nome_fantasia\}\}/g, nomeFantasia)
      .replace(/\{\{cnpj\}\}/g, cnpj)
      .replace(/\{\{teacher_name\}\}/g, teacherName)
      .replace(/\{\{teacher_cpf\}\}/g, formatCPF(signatureCpf || (profile as any)?.cpf || ""))
      .replace(/\{\{teacher_address\}\}/g, teacherAddress)
      .replace(/\{\{platform_address\}\}/g, platformAddress)
      .replace(/\{\{teacher_percentage\}\}/g, String(teacherPercentage))
      .replace(/\{\{teacher_percentage_text\}\}/g, numberToText(teacherPercentage))
      .replace(/\{\{platform_percentage\}\}/g, String(platformPercentage))
      .replace(/\{\{platform_percentage_text\}\}/g, numberToText(platformPercentage))
      .replace(/\{\{data\}\}/g, now.toLocaleDateString("pt-BR"))
      .replace(/\{\{hora\}\}/g, now.toLocaleTimeString("pt-BR"));
  };

  const handleSign = async () => {
    if (!user || !template) return;
    const cpf = signatureCpf || (profile as any)?.cpf || "";
    if (!isValidCPF(cpf)) {
      toast.error("Informe um CPF válido para assinar o contrato");
      return;
    }
    if (!agreed) {
      toast.error("Você precisa concordar com os termos do contrato");
      return;
    }

    setSigning(true);
    try {
      // Get IP address
      let ipAddress = "";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ipAddress = data.ip || "";
      } catch { /* ignore */ }

      const deviceInfo = navigator.userAgent;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const contractText = renderContract() +
        `\n\n---\n\nEste contrato foi assinado digitalmente em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}, a partir do IP ${ipAddress}, dispositivo: ${deviceInfo}.`;

      // Save CPF to profile
      await supabase.from("profiles").update({ cpf: cpf }).eq("user_id", user.id);

      // Expire old contracts
      await supabase
        .from("teacher_contracts" as any)
        .update({ status: "expired" })
        .eq("teacher_id", user.id)
        .eq("status", "active");

      // Create contract
      const { error } = await supabase.from("teacher_contracts" as any).insert({
        teacher_id: user.id,
        contract_text: contractText,
        signature_name: teacherName,
        signature_cpf: cpf,
        ip_address: ipAddress,
        device_info: deviceInfo,
        signed_at: now,
        expires_at: expiresAt,
        status: "active",
      });

      if (error) throw error;

      // Send contract signed email to teacher
      const maskedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-$4');
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'contract-signed',
          recipientEmail: profile?.email || user.email,
          idempotencyKey: `contract-signed-${user.id}-${now}`,
          templateData: {
            name: teacherName,
            signedAt: `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
            expiresAt: new Date(expiresAt).toLocaleDateString("pt-BR"),
            ipAddress,
            deviceInfo,
            cpf: maskedCpf,
            contractText,
          },
        },
      });

      toast.success("Contrato assinado com sucesso! Uma cópia foi enviada para seu e-mail.");
      onSigned();
    } catch (err: any) {
      toast.error(err.message || "Erro ao assinar contrato");
    }
    setSigning(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileSignature className="h-5 w-5" />
            {template?.contract_title || "Contrato de Prestação de Serviços"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] rounded-lg border border-border p-4 bg-secondary/30">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-sm leading-relaxed">
            {renderContract().split("\n").map((line, i) => {
              if (line.startsWith("**") && line.endsWith("**")) {
                return <p key={i} className="font-bold mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
              }
              return <p key={i} className="my-0.5">{line.replace(/\*\*/g, "")}</p>;
            })}
          </div>
        </ScrollArea>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">CPF para assinatura</label>
            <Input
              value={formatCPF(signatureCpf || (profile as any)?.cpf || "")}
              onChange={(e) => setSignatureCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="bg-secondary"
            />
            {signatureCpf && signatureCpf.length === 11 && !isValidCPF(signatureCpf) && (
              <p className="text-xs text-destructive mt-1">CPF inválido</p>
            )}
          </div>

          <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">Assinatura Digital</p>
            <p className="text-xl italic font-serif text-foreground" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              {teacherName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">CPF: {formatCPF(signatureCpf || (profile as any)?.cpf || "")}</p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-muted-foreground">
              Declaro que li e concordo com todos os termos deste contrato. Confirmo que as informações fornecidas são verdadeiras.
            </span>
          </label>

          <div className="flex gap-2">
            <Button onClick={handleSign} disabled={signing || !agreed} className="flex-1 font-display gap-2">
              <CheckCircle className="h-4 w-4" />
              {signing ? "Assinando..." : "Assinar Contrato Digitalmente"}
            </Button>
            <Button variant="secondary" onClick={onClose} className="font-display">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeacherContractModal;
