import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePlatformSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
  type AulaParticularConfigSettings,
} from "@/hooks/usePlatformSettings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import { BellRing, Loader2, Save, Smartphone } from "lucide-react";

type ChannelOption =
  | "whatsapp_sms_fallback"
  | "whatsapp_only"
  | "sms_only"
  | "disabled";

interface ReminderPreferenceRow {
  id?: string;
  user_id: string;
  channel: ChannelOption;
  alternate_phone: string | null;
  preferred_windows_hours: number[];
}

const CHANNEL_LABEL: Record<ChannelOption, string> = {
  whatsapp_sms_fallback: "WhatsApp (com SMS de reserva)",
  whatsapp_only: "Somente WhatsApp",
  sms_only: "Somente SMS",
  disabled: "Desativar lembretes",
};

/** Self-service modal where the logged user can pick how, where and when they
 *  want to receive lesson reminders. The available windows are constrained to
 *  the ones the admin enabled platform-wide. */
const LessonReminderPreferences = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { data: cfgRaw } = usePlatformSettings("aula_particular_config");
  const cfg: AulaParticularConfigSettings =
    cfgRaw ?? DEFAULT_AULA_PARTICULAR_CONFIG;

  const adminWindows = useMemo(
    () =>
      Array.from(new Set((cfg.reminder_windows_hours ?? []).filter((n) => n > 0))).sort(
        (a, b) => b - a,
      ),
    [cfg.reminder_windows_hours],
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<ChannelOption>("whatsapp_sms_fallback");
  const [alternatePhone, setAlternatePhone] = useState<string>("");
  const [selectedWindows, setSelectedWindows] = useState<number[]>([]);
  const [usingProfilePhone, setUsingProfilePhone] = useState(false);

  const profilePhoneDigits = String((profile as any)?.phone ?? "").replace(/\D/g, "");

  // Load current preferences when the modal opens.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lesson_reminder_preferences")
        .select("channel, alternate_phone, preferred_windows_hours")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load reminder prefs", error);
      }
      if (data) {
        setChannel((data.channel as ChannelOption) ?? "whatsapp_sms_fallback");
        const savedPhone = data.alternate_phone
          ? String(data.alternate_phone).replace(/\D/g, "")
          : "";
        if (savedPhone) {
          setAlternatePhone(savedPhone);
          setUsingProfilePhone(false);
        } else if (profilePhoneDigits) {
          // Pre-fill with the phone from "Dados Pessoais" so the user does not
          // have to retype it. It will only be persisted if they hit save.
          setAlternatePhone(profilePhoneDigits);
          setUsingProfilePhone(true);
        } else {
          setAlternatePhone("");
          setUsingProfilePhone(false);
        }
        setSelectedWindows(
          Array.isArray(data.preferred_windows_hours)
            ? (data.preferred_windows_hours as number[])
            : [],
        );
      } else {
        setChannel("whatsapp_sms_fallback");
        setAlternatePhone(profilePhoneDigits);
        setUsingProfilePhone(Boolean(profilePhoneDigits));
        setSelectedWindows([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, profilePhoneDigits]);

  const phoneDigits = alternatePhone.replace(/\D/g, "");
  const phoneInvalid = phoneDigits.length > 0 && !isValidBrazilianPhone(alternatePhone);

  const toggleWindow = (h: number) => {
    setSelectedWindows((prev) =>
      prev.includes(h) ? prev.filter((w) => w !== h) : [...prev, h].sort((a, b) => b - a),
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (phoneInvalid) {
      toast({
        title: "Número inválido",
        description: "Confira o telefone alternativo (DDD + 9 dígitos).",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      channel,
      alternate_phone: phoneDigits.length === 11 ? phoneDigits : null,
      preferred_windows_hours: selectedWindows,
    };
    const { error } = await supabase
      .from("lesson_reminder_preferences")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar preferências.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Preferências salvas",
      description:
        channel === "disabled"
          ? "Lembretes desativados."
          : "Você receberá lembretes de acordo com a sua preferência.",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BellRing className="h-4 w-4" />
          Preferências de lembrete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Lembretes de aula
          </DialogTitle>
          <DialogDescription>
            Escolha como, onde e quando deseja ser avisado antes de cada aula
            particular.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Método de envio</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as ChannelOption)}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANNEL_LABEL) as ChannelOption[]).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {CHANNEL_LABEL[opt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                "WhatsApp com SMS de reserva" tenta o WhatsApp primeiro e, se falhar,
                envia por SMS.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Telefone para lembretes</Label>
              <PhoneInput
                value={alternatePhone}
                onChange={(v) => {
                  setAlternatePhone(v);
                  setUsingProfilePhone(false);
                }}
                placeholder="(00) 00000-0000"
              />
              <p className="text-xs text-muted-foreground">
                {usingProfilePhone
                  ? "Preenchido automaticamente com o telefone dos seus Dados Pessoais. Edite aqui se quiser receber em outro número."
                  : "Os lembretes serão enviados para este número."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Antecedência preferida</Label>
              {adminWindows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  A plataforma não tem janelas de lembrete configuradas no momento.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {adminWindows.map((h) => {
                      const active = selectedWindows.includes(h);
                      return (
                        <button
                          type="button"
                          key={h}
                          onClick={() => toggleWindow(h)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                          aria-pressed={active}
                        >
                          {h}h antes
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marque as antecedências em que quer receber. Se nenhuma for
                    marcada, você recebe em todas ({adminWindows.map((h) => `${h}h`).join(", ")}).
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || phoneInvalid}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LessonReminderPreferences;