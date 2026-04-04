import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const LoginDataTab = () => {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Erro ao atualizar senha");
    } else {
      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4">Dados de Login</h2>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">E-mail de acesso</label>
          <Input value={user?.email || ""} disabled className="bg-secondary opacity-60" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Nova senha</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-secondary"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Confirmar nova senha</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-secondary"
          />
        </div>
        <Button onClick={handleChangePassword} disabled={saving} className="font-display">
          {saving ? "Atualizando..." : "Alterar senha"}
        </Button>
      </div>
    </div>
  );
};

export default LoginDataTab;
