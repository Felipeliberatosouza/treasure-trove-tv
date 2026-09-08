import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { toast } from "sonner";

export interface StudySlide {
  titulo: string;
  bullets: string[];
  narracao: string;
}

interface Props {
  topico: string;
  slides: StudySlide[];
}

const ttsUrl = (texto: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-tts`;

const NarratedSlidesPlayer = ({ topico, slides }: Props) => {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef<string>("");

  // token atual (busca sob demanda ao tocar)
  const getToken = useCallback(async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const loadSlideAudio = useCallback(
    async (index: number) => {
      const slide = slides[index];
      if (!slide?.narracao) return null;
      setLoading(true);
      try {
        if (!tokenRef.current) tokenRef.current = await getToken();
        const resp = await fetch(ttsUrl(slide.narracao), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ texto: slide.narracao }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Falha (${resp.status})`);
        }
        const blob = await resp.blob();
        return URL.createObjectURL(blob);
      } catch (e: any) {
        toast.error(e?.message || "Falha ao gerar narração");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [slides, getToken],
  );

  const playFrom = useCallback(
    async (index: number) => {
      const url = await loadSlideAudio(index);
      if (!url) {
        setPlaying(false);
        return;
      }
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPlaying(true);
    },
    [loadSlideAudio],
  );

  // quando o áudio do slide termina, avança
  const handleEnded = useCallback(() => {
    setCurrent((c) => {
      const next = c + 1;
      if (next < slides.length) {
        void playFrom(next);
        return next;
      }
      setPlaying(false);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return c;
    });
  }, [slides.length, playFrom]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    el.src = audioUrl;
    if (playing) void el.play().catch(() => setPlaying(false));
    return () => {};
  }, [audioUrl, playing]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const slide = slides[current];

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/60 backdrop-blur">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="h-5 w-5 text-primary" />
          Aula narrada: {topico}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          Slide {current + 1} de {slides.length}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* slide */}
        <div className="flex min-h-[200px] flex-col justify-center rounded-lg border bg-background/60 p-6">
          {slide && (
            <>
              <h4 className="mb-3 text-xl font-semibold">{slide.titulo}</h4>
              <ul className="space-y-2">
                {slide.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <audio ref={audioRef} onEnded={handleEnded} className="hidden" />

        <div className="flex items-center gap-2">
          {!playing ? (
            <Button onClick={() => playFrom(current)} disabled={loading} size="sm">
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
              {loading ? "Gerando narração..." : "Tocar narração"}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setPlaying(false);
                audioRef.current?.pause();
              }}
              size="sm"
              variant="outline"
            >
              <Pause className="mr-1 h-4 w-4" /> Pausar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={current === 0}
            onClick={() => {
              setPlaying(false);
              setCurrent((c) => Math.max(0, c - 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={current >= slides.length - 1}
            onClick={() => {
              setPlaying(false);
              setCurrent((c) => Math.min(slides.length - 1, c + 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NarratedSlidesPlayer;
