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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            texto: VOICE_SAMPLE_TEXT,
            avatar_voice: voice,
            avatar_gender: gender,
          }),
        },
      );
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(detail || `Falha ${resp.status}`);
      }
      const blob = await resp.blob();
      if (!blob.size) throw new Error("Áudio não recebido");
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
