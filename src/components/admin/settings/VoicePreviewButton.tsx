import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Frase padrão usada para ouvir a voz do avatar. */
export const VOICE_SAMPLE_TEXT = "Olá! Como vai? Terá prova hoje?";

/** Botão que gera e reproduz um exemplo curto da voz selecionada. */
const VoicePreviewButton = ({ voice, gender }: { voice: string; gender: "male" | "female" }) => {
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async () => {
    if (loading) return;
    audioRef.current?.pause();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-tts", {
        body: { texto: VOICE_SAMPLE_TEXT, avatar_voice: voice, avatar_gender: gender },
      });
      if (error) throw error;
      const blob =
        data instanceof Blob
          ? data
          : data instanceof ArrayBuffer
            ? new Blob([data], { type: "audio/mpeg" })
            : null;
      if (!blob) throw new Error("Áudio não recebido");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      console.error("voice preview error", e);
      toast.error("Não foi possível ouvir a voz agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={play} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
      Ouvir exemplo
    </Button>
  );
};

export default VoicePreviewButton;
