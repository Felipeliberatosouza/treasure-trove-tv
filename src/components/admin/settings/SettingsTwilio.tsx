import { useEffect, useState } from "react";
import { usePlatformSettings, TwilioConfigSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Smartphone } from "lucide-react";

type TwilioConfig = TwilioConfigSettings;
  sms_from_number: string;
  whatsapp_from_number: string;
}

const defaultConfig: TwilioConfig = {
  sms_from_number: "",
  whatsapp_from_number: "",
};

const SettingsTwilio = () => {
  const { data, loading, update } = usePlatformSettings("twilio_config");
  const [form, setForm] = useState<TwilioConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({ ...defaultConfig, ...(data as unknown as TwilioConfig) });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form as any);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">Verificação de Celular (Twilio)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure os números de origem do Twilio para envio de códigos de verificação por SMS e WhatsApp.
        Os números devem estar no formato internacional (ex: +5511999999999).
      </p>

      <div className="space-y-4">
        <div>
          <Label>Número de SMS (From)</Label>
          <Input
            value={form.sms_from_number}
            onChange={(e) => setForm({ ...form, sms_from_number: e.target.value })}
            placeholder="+5511999999999"
            className="bg-secondary"
          />
          <p className="text-xs text-muted-foreground mt-1">Número comprado no Twilio para envio de SMS</p>
        </div>

        <div>
          <Label>Número de WhatsApp (From)</Label>
          <Input
            value={form.whatsapp_from_number}
            onChange={(e) => setForm({ ...form, whatsapp_from_number: e.target.value })}
            placeholder="+14155238886"
            className="bg-secondary"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Número do WhatsApp Sandbox ou número comercial aprovado no Twilio
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : "Salvar configuração"}
      </Button>
    </div>
  );
};

export default SettingsTwilio;
