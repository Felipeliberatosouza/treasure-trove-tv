import {
  usePlatformSettings,
  AI_AVATAR_VOICES,
  defaultVoiceForGender,
  type AiAvatarSettings,
} from "@/hooks/usePlatformSettings";
import { elevenVoicesFor } from "@/lib/elevenVoices";
import VoicePreviewButton from "./VoicePreviewButton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Seletor de voz do avatar que acompanha o provedor ativo em Gestão de IA. */
const AvatarVoiceField = ({
  avatar,
  onChange,
  hint,
}: {
  avatar: Pick<AiAvatarSettings, "gender" | "voice" | "el_voice">;
  onChange: (changes: Partial<AiAvatarSettings>) => void;
  hint?: React.ReactNode;
}) => {
  const { data: voiceCfg } = usePlatformSettings("ai_voice_config");
  const eleven = voiceCfg?.provider === "elevenlabs";
  const list = elevenVoicesFor(avatar.gender);
  const globalEl = avatar.gender === "male" ? voiceCfg?.male_voice_id : voiceCfg?.female_voice_id;
  const elValue = list.some((v) => v.id === avatar.el_voice)
    ? avatar.el_voice!
    : list.some((v) => v.id === globalEl) ? globalEl! : list[0].id;
  const openaiValue = avatar.voice || defaultVoiceForGender(avatar.gender);

  return (
    <div className="space-y-2">
      <Label>Voz da narração {eleven ? "(ElevenLabs)" : "(voz padrão)"}</Label>
      {eleven ? (
        <Select value={elValue} onValueChange={(v) => onChange({ el_voice: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {list.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Select value={openaiValue} onValueChange={(v) => onChange({ voice: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {AI_AVATAR_VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <VoicePreviewButton voice={openaiValue} elVoice={eleven ? elValue : undefined} gender={avatar.gender} />
      <p className="text-xs text-muted-foreground">
        A lista segue a voz escolhida em Gestão de IA. {hint}
      </p>
    </div>
  );
};

export default AvatarVoiceField;
