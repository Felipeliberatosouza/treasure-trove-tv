import { useEffect, useState } from "react";
import { usePlatformSettings, ContactSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

const SettingsContact = () => {
  const { data, loading, update } = usePlatformSettings("contact");
  const [form, setForm] = useState<ContactSettings>({
    email: "", phone: "", address: "", instagram: "", youtube: "", facebook: "", twitter: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Email de Contato</Label>
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <Label>Telefone</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <Label>Endereço</Label>
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Instagram</Label>
          <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" />
        </div>
        <div>
          <Label>YouTube</Label>
          <Input value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} placeholder="URL do canal" />
        </div>
        <div>
          <Label>Facebook</Label>
          <Input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="URL da página" />
        </div>
        <div>
          <Label>Twitter / X</Label>
          <Input value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} placeholder="@usuario" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsContact;
