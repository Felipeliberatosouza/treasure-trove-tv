import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePlatformSettings, DEFAULT_AI_AVATAR, type AiAvatarSettings } from "@/hooks/usePlatformSettings";

/** Liga/desliga a imagem do avatar em todos os vídeos e slides. A voz continua sempre. */
const SettingsAvatarVisibility = () => {
  const { data, loading, update } = usePlatformSettings("ai_avatar");
  const current = { ...DEFAULT_AI_AVATAR, ...((data as AiAvatarSettings) || {}) };
  const on = current.show_image === true;

  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-center gap-3">
        <Switch
          id="show-avatar-image"
          checked={on}
          disabled={loading}
          onCheckedChange={(v) => void update({ ...current, show_image: v })}
        />
        <Label htmlFor="show-avatar-image" className="cursor-pointer font-semibold">
          Mostrar a imagem do avatar nos vídeos e slides
        </Label>
      </div>
      <p className="text-xs text-muted-foreground pl-12">
        {on
          ? "Ligado: o avatar aparece e narra os materiais."
          : "Desligado: todos os materiais (novos e já existentes) têm só a voz do avatar, sem a imagem."}
      </p>
    </div>
  );
};

export default SettingsAvatarVisibility;
