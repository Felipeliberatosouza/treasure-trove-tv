import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CpfInput from "@/components/CpfInput";
import { isValidCPF } from "@/lib/cpfValidator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

interface TeacherDataModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TeacherDataModal = ({ open, onClose, onComplete }: TeacherDataModalProps) => {
  const { user, profile } = useAuth();
  const [cpf, setCpf] = useState((profile as any)?.cpf || "");
  const [address, setAddress] = useState((profile as any)?.address || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    if (!isValidCPF(cpf)) {
      toast.error("Informe um CPF válido");
      return;
    }
    if (!address.trim()) {
      toast.error("Informe seu endereço completo");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ cpf, address: address.trim() })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar dados");
    } else {
      toast.success("Dados salvos com sucesso!");
      onComplete();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <UserCheck className="h-5 w-5" />
            Dados Obrigatórios
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Antes de publicar conteúdo, precisamos de algumas informações para o contrato de prestação de serviços.
        </p>

        <div className="space-y-4 pt-2">
          <div>
            <Label>CPF *</Label>
            <CpfInput value={cpf} onChange={setCpf} className="bg-secondary border-border" />
          </div>

          <div>
            <Label>Endereço Completo *</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF, CEP"
              className="bg-secondary border-border"
            />
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

export default TeacherDataModal;
