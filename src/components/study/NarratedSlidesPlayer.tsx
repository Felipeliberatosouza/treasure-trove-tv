import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, ChevronLeft, ChevronRight, Volume2, Captions, CaptionsOff } from "lucide-react";
import { toast } from "sonner";
import professoraIa from "@/assets/professora-ia.jpg";
import { usePlatformSettings, DEFAULT_AI_AVATAR, resolveAiAvatar, resolveLogoForBackground } from "@/hooks/usePlatformSettings";
import visualCiencia from "@/assets/slide-visual-ciencia.jpg";
import visualHumanas from "@/assets/slide-visual-humanas.jpg";
import visualExatas from "@/assets/slide-visual-exatas.jpg";
import logoRevisaoFacil from "@/assets/logo-revisao-facil.png";

export interface StudySlide {
  titulo: string;
  bullets: string[];
  narracao: string;
  imagem_prompt?: string;
}

interface Props {
  topico: string;
  slides: StudySlide[];
  canonicalId?: string | null;
  disciplina?: string;
}

const ttsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-tts`;

const NarratedSlidesPlayer = ({ topico, slides, canonicalId, disciplina }: Props) => {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  const [caption, setCaption] = useState("");
  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { data: avatarSettings } = usePlatformSettings("ai_avatar");
  const { data: aiParams } = usePlatformSettings("ai_generation_params");
  const { data: branding } = usePlatformSettings("branding");
  const brandLogo = resolveLogoForBackground(branding as any) || logoRevisaoFacil;
  const avatar = resolveAiAvatar(
    aiParams,
    { ...DEFAULT_AI_AVATAR, ...(avatarSettings || {}) },
    { disciplina, contentType: "apresentacao" },
  );
  const avatarImage = avatar.image_url || professoraIa;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef<string>("");

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
        const resp = await fetch(ttsUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(canonicalId
            ? { canonical_id: canonicalId, slide_index: index, avatar_gender: avatar.gender }
            : { texto: slide.narracao, avatar_gender: avatar.gender }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Falha (${resp.status})`);
        }
        if (canonicalId) {
          const payload = await resp.json();
          return typeof payload.audio_url === "string" ? payload.audio_url : null;
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
    [slides, getToken, canonicalId, avatar.gender],
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
      setStarted(true);
    },
    [loadSlideAudio],
  );

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

  const themeImages = useMemo(() => {
    const value = `${disciplina || ""} ${topico}`.toLowerCase();
    if (/matem|físic|fisic|engenh|estat|cálc|calc|tecnolog|comput/.test(value)) {
      return [visualExatas, visualCiencia, visualHumanas];
    }
    if (/hist|direito|filos|soci|letras|geograf|admin|econom/.test(value)) {
      return [visualHumanas, visualCiencia, visualExatas];
    }
    return [visualCiencia, visualExatas, visualHumanas];
  }, [disciplina, topico]);

  const coverImage = themeImages[0];
  const slideImage = themeImages[current % themeImages.length];

  const updateCaption = useCallback(() => {
    const audio = audioRef.current;
    const text = slides[current]?.narracao || "";
    if (!audio || !text || !audio.duration) return;
    const words = text.split(/\s+/).filter(Boolean);
    const wordsPerCaption = 9;
    const progress = Math.min(audio.currentTime / audio.duration, 0.999);
    const start = Math.floor((progress * words.length) / wordsPerCaption) * wordsPerCaption;
    setCaption(words.slice(start, start + wordsPerCaption).join(" "));
  }, [current, slides]);

  if (!slides.length) {
    return <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">Apresentação indisponível.</div>;
  }

  const isIntro = current === 0;
  const isOutro = current === slides.length - 1 && slides.length > 1;
  const avatarOnly = isIntro || isOutro;

  const brandOverlay = (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex flex-col items-end gap-0.5 sm:bottom-3 sm:right-3">
      <img src={logoRevisaoFacil} alt="Revisão Fácil" className="h-5 w-auto opacity-90 sm:h-7" />
      <span className="text-[8px] text-muted-foreground sm:text-[10px]">revisaofacil.com.br</span>
    </div>
  );

  const legalNotice = (
    <p className="border-t border-border bg-background/90 px-2 py-1 text-center text-[9px] text-muted-foreground sm:text-[10px]">
      Conteúdo de responsabilidade do professor, de acordo com a Lei 12.965/2014.
    </p>
  );

  // Capa da apresentação (equivalente à capa do vídeo do professor)
  if (!started) {
    return (
      <div className="ai-slide-player relative aspect-[4/5] w-full overflow-hidden bg-muted sm:aspect-video">
        <img src={coverImage} alt={`Capa da apresentação sobre ${topico}`} className="absolute inset-0 h-full w-full object-cover" width={1536} height={864} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        {brandOverlay}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center sm:gap-3 sm:p-6">
          <img
            src={avatarImage}
            alt={`${avatar.name}, ${avatar.role_label.toLowerCase()} da Revisão Fácil`}
            className="h-16 w-16 rounded-full border-2 border-primary object-cover shadow-lg sm:h-28 sm:w-28"
            width={1024}
            height={1024}
          />
          <div>
            <p className="text-xs font-semibold sm:text-sm">{avatar.name}</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">{avatar.role_label}</p>
          </div>
          <h2 className="max-w-3xl font-display text-lg font-bold leading-tight sm:text-4xl">{topico}</h2>
          {disciplina && <p className="text-xs text-muted-foreground sm:text-sm">{disciplina}</p>}
          <p className="text-[10px] text-muted-foreground sm:text-xs">Apresentação narrada em {slides.length} slides</p>
          <Button size="lg" onClick={() => playFrom(0)} disabled={loading} className="ai-slide-btn pointer-events-auto rounded-full">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            Assistir apresentação
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-slide-player w-full bg-muted">
      <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-video">
        <img
          src={slideImage}
          alt="Ilustração didática da apresentação"
          className={`absolute inset-0 h-full w-full object-cover ${avatarOnly ? "scale-110 blur-lg" : ""}`}
          width={1536}
          height={864}
        />
        <div className={`absolute inset-0 ${avatarOnly ? "bg-background/70" : "bg-gradient-to-b from-background via-background/85 to-background/40 sm:bg-gradient-to-r sm:from-background sm:via-background/80 sm:to-background/10"}`} />
        {brandOverlay}
        <div className="absolute inset-0 flex flex-col justify-between gap-2 p-3 sm:p-7 md:p-10">
          {avatarOnly ? (
            <div className="pointer-events-none flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
              <div className={`relative inline-block ${speaking ? "avatar-speaking-stage" : ""}`}>
                <img
                  src={avatarImage}
                  alt={`${avatar.name}, ${avatar.role_label.toLowerCase()} da Revisão Fácil`}
                  className={`h-24 w-24 rounded-full border-2 border-primary object-cover shadow-xl sm:h-40 sm:w-40 md:h-48 md:w-48 ${speaking ? "avatar-talking" : ""}`}
                  width={1024}
                  height={1024}
                />
                {speaking && (
                  <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-0.5 rounded-full bg-background/90 px-1.5 py-1 shadow" aria-hidden="true">
                    <i className="avatar-voice-bar" />
                    <i className="avatar-voice-bar" />
                    <i className="avatar-voice-bar" />
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold sm:text-sm">{avatar.name}</span>
              <span className="text-[10px] text-muted-foreground sm:text-xs">{avatar.role_label}</span>
              <h2 className="max-w-2xl font-display text-base font-bold leading-tight sm:text-2xl md:text-3xl">{slide?.titulo}</h2>
            </div>
          ) : (
            <div className="pointer-events-none flex min-h-0 flex-1 items-start justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1 overflow-y-auto sm:max-w-[76%] sm:flex-none">
                <p className="mb-1 text-[10px] font-semibold uppercase text-primary sm:mb-2 sm:text-xs">Revisão Fácil IA</p>
                <h2 className="font-display text-base font-bold leading-tight sm:text-3xl md:text-4xl">
                  {slide?.titulo}
                </h2>
                {slide && (
                  <ul className="mt-2 space-y-1 sm:mt-5 sm:space-y-2">
                    {slide.bullets.slice(0, 4).map((bullet, index) => (
                      <li key={index} className="flex items-start gap-2 text-[11px] leading-snug sm:text-sm md:text-base">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="shrink-0 text-center">
                <div className={`relative inline-block ${speaking ? "avatar-speaking-stage" : ""}`}>
                  <img
                    src={avatarImage}
                    alt={`${avatar.name}, ${avatar.role_label.toLowerCase()} da Revisão Fácil`}
                    className={`h-12 w-12 rounded-full border-2 border-primary object-cover shadow-lg sm:h-20 sm:w-20 md:h-24 md:w-24 ${speaking ? "avatar-talking" : ""}`}
                    width={1024}
                    height={1024}
                  />
                  {speaking && (
                    <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-0.5 rounded-full bg-background/90 px-1.5 py-1 shadow" aria-hidden="true">
                      <i className="avatar-voice-bar" />
                      <i className="avatar-voice-bar" />
                      <i className="avatar-voice-bar" />
                    </span>
                  )}
                </div>
                <span className="mt-2 block text-[10px] font-medium sm:text-xs">{avatar.name}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:block">{avatar.role_label}</span>
              </div>
            </div>
          )}

          {showCaptions && caption && (
            <div className="pointer-events-none mx-auto max-w-2xl shrink-0 rounded bg-background/90 px-2 py-1 text-center text-[11px] shadow-lg sm:px-3 sm:py-1.5 sm:text-sm">
              {caption}
            </div>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        onEnded={() => {
          setSpeaking(false);
          handleEnded();
        }}
        onPlay={() => setSpeaking(true)}
        onPause={() => setSpeaking(false)}
        onTimeUpdate={updateCaption}
        className="hidden"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border bg-background/90 p-2 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          {!playing ? (
            <Button onClick={() => playFrom(current)} disabled={loading} size="icon" className="ai-slide-btn" aria-label="Reproduzir apresentação">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setPlaying(false);
                audioRef.current?.pause();
              }}
              size="icon"
              variant="outline"
              className="ai-slide-btn"
              aria-label="Pausar apresentação"
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ai-slide-btn"
            disabled={current === 0}
            onClick={() => {
              setPlaying(false);
              audioRef.current?.pause();
              setCurrent((c) => Math.max(0, c - 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ai-slide-btn"
            disabled={current >= slides.length - 1}
            onClick={() => {
              setPlaying(false);
              audioRef.current?.pause();
              setCurrent((c) => Math.min(slides.length - 1, c + 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Volume2 className="ml-1 hidden h-4 w-4 text-muted-foreground sm:block" />
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">Slide {current + 1} de {slides.length}</span>
        <Button variant="ghost" size="icon" className="ai-slide-btn" onClick={() => setShowCaptions((value) => !value)} aria-label={showCaptions ? "Ocultar legendas" : "Mostrar legendas"}>
          {showCaptions ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
        </Button>
      </div>
      {legalNotice}
    </div>
  );
};

export default NarratedSlidesPlayer;
