import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CpfInput from "@/components/CpfInput";
import { isValidCPF } from "@/lib/cpfValidator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

interface CpfRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const CpfRequiredModal = ({ open, onClose, onComplete }: CpfRequiredModalProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const [cpf, setCpf] = useState(profile?.cpf || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    if (!isValidCPF(cpf)) {
      toast.error("Informe um CPF válido");
      return;
    }

    setSaving(true);
    const cleanedCpf = cpf.replace(/\D/g, "");
    const { error } = await supabase
      .from("profiles")
      .update({ cpf: cleanedCpf })
      .eq("user_id", user.id);

    if (error) {
      console.error("CPF save error:", error);
      toast.error("Erro ao salvar CPF");
    } else {
      toast.success("CPF salvo com sucesso!");
      await refreshProfile();
      onComplete();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-primary" />
            CPF Obrigatório
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Para prosseguir com a compra ou assinatura, precisamos do seu CPF para emissão de nota fiscal.
        </p>

        <div className="space-y-4 pt-2">
          <div>
            <CpfInput value={cpf} onChange={setCpf} className="bg-secondary border-border" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 font-display">
              {saving ? "Salvando..." : "Continuar"}
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

export default CpfRequiredModal;
