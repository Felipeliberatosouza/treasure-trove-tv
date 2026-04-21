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
import { Input } from "@/components/ui/input";
import { BellRing, Loader2, Plus, Save, Smartphone, X } from "lucide-react";

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
  // Merge with defaults so partial admin configs (older rows missing the
  // reminder_windows_hours field) still surface the platform defaults.
  const cfg: AulaParticularConfigSettings = {
    ...DEFAULT_AULA_PARTICULAR_CONFIG,
    ...(cfgRaw ?? {}),
  };

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
  const [customHourInput, setCustomHourInput] = useState<string>("");
  /** When true, the user has not yet customised the windows for this session,
   *  so we keep them in sync with the admin defaults. As soon as they edit
   *  anything (add / remove a chip) we stop overwriting. */
  const [usingAdminDefaults, setUsingAdminDefaults] = useState(true);
  /** Set to true on any user edit (channel, phone, windows). Used by the
   *  auto-save-on-close handler so we don't persist when nothing changed. */
  const [isDirty, setIsDirty] = useState(false);
  /** Diagnostic info shown in the modal so the user (and us in console) can
   *  quickly tell where the pre-filled windows came from. */
  const [diagnostic, setDiagnostic] = useState<{
    source: "saved" | "admin" | "fallback-defaults" | "empty";
    hasPrefsRow: boolean;
    adminCount: number;
  } | null>(null);

  const profilePhoneDigits = String((profile as any)?.phone ?? "").replace(/\D/g, "");

  // Load current preferences when the modal opens.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      console.log("[LessonReminderPrefs] Opening modal", {
        userId: user.id,
        adminWindows,
        cfgLoaded: cfgRaw !== null,
        profilePhoneDigits,
      });
      const { data, error } = await supabase
        .from("lesson_reminder_preferences")
        .select("channel, alternate_phone, preferred_windows_hours")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load reminder prefs", error);
      }
      console.log("[LessonReminderPrefs] Loaded prefs row:", data);
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
        const savedWindows = Array.isArray(data.preferred_windows_hours)
          ? (data.preferred_windows_hours as number[])
          : [];
        if (savedWindows.length > 0) {
          setSelectedWindows([...savedWindows].sort((a, b) => b - a));
          setUsingAdminDefaults(false);
          setDiagnostic({
            source: "saved",
            hasPrefsRow: true,
            adminCount: adminWindows.length,
          });
          console.log("[LessonReminderPrefs] Using SAVED windows", savedWindows);
        } else {
          // Empty saved list = "use everything the admin offers".
          setSelectedWindows([...adminWindows]);
          setUsingAdminDefaults(true);
          setDiagnostic({
            source: adminWindows.length > 0 ? "admin" : "empty",
            hasPrefsRow: true,
            adminCount: adminWindows.length,
          });
          console.log(
            "[LessonReminderPrefs] Saved row had empty windows; using ADMIN defaults",
            adminWindows,
          );
        }
      } else {
        setChannel("whatsapp_sms_fallback");
        setAlternatePhone(profilePhoneDigits);
        setUsingProfilePhone(Boolean(profilePhoneDigits));
        // Brand-new users start with the admin defaults preselected.
        setSelectedWindows([...adminWindows]);
        setUsingAdminDefaults(true);
        setDiagnostic({
          source: adminWindows.length > 0 ? "admin" : "fallback-defaults",
          hasPrefsRow: false,
          adminCount: adminWindows.length,
        });
        console.log(
          "[LessonReminderPrefs] No prefs row; pre-filling with ADMIN windows",
          adminWindows,
        );
      }
      setLoading(false);
      setIsDirty(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, profilePhoneDigits, adminWindows, cfgRaw]);

  // While the user has not touched the windows, mirror admin updates live.
  useEffect(() => {
    if (open && usingAdminDefaults) {
      setSelectedWindows([...adminWindows]);
    }
  }, [open, usingAdminDefaults, adminWindows]);

  const phoneDigits = alternatePhone.replace(/\D/g, "");
  const phoneInvalid = phoneDigits.length > 0 && !isValidBrazilianPhone(alternatePhone);

  const removeWindow = (h: number) => {
    setUsingAdminDefaults(false);
    setSelectedWindows((prev) => prev.filter((w) => w !== h));
    setIsDirty(true);
  };

  const addCustomHour = () => {
    const n = Math.round(Number(customHourInput));
    if (!Number.isFinite(n) || n <= 0 || n > 168) {
      toast({
        title: "Valor inválido",
        description: "Informe um número inteiro entre 1 e 168 horas.",
        variant: "destructive",
      });
      return;
    }
    setUsingAdminDefaults(false);
    setSelectedWindows((prev) =>
      prev.includes(n) ? prev : [...prev, n].sort((a, b) => b - a),
    );
    setCustomHourInput("");
    setIsDirty(true);
  };

  /** Persists current state. Returns true on success. When `silent` is true,
   *  no success toast is shown (used by the explicit-button flow that already
   *  surfaces feedback differently). */
  const persistPreferences = async (
    options: { silent?: boolean } = {},
  ): Promise<boolean> => {
    if (!user) return false;
    if (phoneInvalid) {
      toast({
        title: "Número inválido",
        description: "Confira o telefone alternativo (DDD + 9 dígitos).",
        variant: "destructive",
      });
      return false;
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
      console.error("[LessonReminderPrefs] Save failed", error);
      toast({
        title: "Erro ao salvar",
        description:
          "Não conseguimos salvar suas preferências de lembrete. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
    setIsDirty(false);
    if (!options.silent) {
      toast({
        title: "Preferências salvas",
        description:
          channel === "disabled"
            ? "Lembretes desativados."
            : "Você receberá lembretes de acordo com a sua preferência.",
      });
    }
    return true;
  };

  const handleSave = async () => {
    const ok = await persistPreferences();
    if (ok) setOpen(false);
  };

  /** Wraps Dialog's onOpenChange so that closing the modal with pending edits
   *  triggers an automatic save (with toast feedback). If validation fails we
   *  keep the modal open so the user can fix the issue. */
  const handleOpenChange = async (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    if (saving) return; // ignore close while a save is in flight
    if (isDirty && !loading) {
      if (phoneInvalid) {
        // Don't silently drop edits with an invalid phone — keep the modal
        // open and let the user fix it.
        toast({
          title: "Número inválido",
          description:
            "Corrija o telefone antes de fechar para salvarmos suas alterações.",
          variant: "destructive",
        });
        return;
      }
      const ok = await persistPreferences({ silent: true });
      if (!ok) return; // toast already shown by persistPreferences; keep open
      toast({
        title: "Alterações salvas",
        description: "Suas preferências de lembrete foram atualizadas.",
      });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            {diagnostic && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  diagnostic.source === "saved"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : diagnostic.source === "admin"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : diagnostic.source === "fallback-defaults"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
                role="status"
              >
                <strong className="block mb-0.5">Diagnóstico:</strong>
                {diagnostic.source === "saved" &&
                  "Carregamos as suas preferências salvas anteriormente."}
                {diagnostic.source === "admin" &&
                  `Sem preferências salvas — pré-preenchemos com a configuração do administrador (${diagnostic.adminCount} ${diagnostic.adminCount === 1 ? "horário" : "horários"}).`}
                {diagnostic.source === "fallback-defaults" &&
                  "Sem preferências salvas e o administrador não definiu horários — usando os valores padrão do sistema."}
                {diagnostic.source === "empty" &&
                  "Suas preferências estavam vazias e o administrador não definiu horários. Adicione manualmente abaixo."}
              </div>
            )}
            <div className="space-y-2">
              <Label>Método de envio</Label>
              <Select
                value={channel}
                onValueChange={(v) => {
                  setChannel(v as ChannelOption);
                  setIsDirty(true);
                }}
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
                  setIsDirty(true);
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
              {selectedWindows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum horário definido. Adicione abaixo para receber lembretes.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedWindows.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs text-primary"
                    >
                      {h}h antes
                      <button
                        type="button"
                        onClick={() => removeWindow(h)}
                        className="rounded-full p-0.5 hover:bg-primary/20"
                        aria-label={`Remover ${h}h`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  step={1}
                  inputMode="numeric"
                  placeholder="Ex.: 6"
                  value={customHourInput}
                  onChange={(e) => setCustomHourInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomHour();
                    }
                  }}
                  className="bg-secondary"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomHour}
                  className="gap-1 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {usingAdminDefaults && adminWindows.length > 0
                  ? `Pré-preenchido com a configuração do admin (${adminWindows
                      .map((h) => `${h}h`)
                      .join(", ")}). Adicione ou remova como preferir.`
                  : "Você receberá um lembrete em cada antecedência listada (até 168h)."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              // Explicit "discard": skip autosave and close immediately.
              setIsDirty(false);
              setOpen(false);
            }}
            disabled={saving}
          >
            Descartar
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