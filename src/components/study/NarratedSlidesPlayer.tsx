import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, ChevronLeft, ChevronRight, Volume2, Captions, CaptionsOff } from "lucide-react";
import { toast } from "sonner";
import professoraIa from "@/assets/professora-ia.jpg";
import { usePlatformSettings, DEFAULT_AI_AVATAR, resolveAiAvatar, resolveLogoForBackground, aiRoleLabel } from "@/hooks/usePlatformSettings";
import visualCiencia from "@/assets/slide-visual-ciencia.jpg";
import visualHumanas from "@/assets/slide-visual-humanas.jpg";
import visualExatas from "@/assets/slide-visual-exatas.jpg";
import logoRevisaoFacil from "@/assets/logo-revisao-facil.png";
import type { AgeGroup, KitBoardStep, KitKeyword } from "@/lib/revisionKit";

export interface StudySlide {
  titulo: string;
  bullets: string[];
  narracao: string;
  imagem_prompt?: string;
  frase_didatica?: string;
  palavras_chave?: KitKeyword[];
  modo_visual?: "conteudo" | "lousa" | "avatar";
  lousa_passos?: KitBoardStep[];
}

interface Props {
  topico: string;
  slides: StudySlide[];
  canonicalId?: string | null;
  disciplina?: string;
  /** Áreas de curso vinculadas ao material — definem o avatar quando cadastrado por área. */
  areas?: string[];
  faixaEtaria?: AgeGroup;
}

const ttsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-tts`;
const imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-slide-image`;

const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const anchorProgress = (narration: string, anchor: string, fallback: number) => {
  const text = normalizeText(narration);
  const needle = normalizeText(anchor).trim();
  const index = needle ? text.indexOf(needle) : -1;
  return index >= 0 ? index / Math.max(1, text.length) : fallback;
};

const HighlightedText = ({ text, terms, activeTerm }: { text: string; terms: string[]; activeTerm?: string }) => {
  const cleanTerms = terms.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!cleanTerms.length) return <>{text}</>;
  const escaped = cleanTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return <>{parts.map((part, index) => {
    const match = cleanTerms.find((term) => normalizeText(term) === normalizeText(part));
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    const active = activeTerm && normalizeText(activeTerm) === normalizeText(match);
    return <mark key={`${part}-${index}`} className={`ai-keyword ${active ? "is-active" : ""}`}>{part}</mark>;
  })}</>;
};

const NarratedSlidesPlayer = ({ topico, slides, canonicalId, disciplina, areas, faixaEtaria }: Props) => {
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
  const [slideProgress, setSlideProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  // Duração de cada slide (estimada pela narração e corrigida quando o áudio carrega),
  // usada para montar uma barra de tempo única para toda a apresentação.
  const [durations, setDurations] = useState<number[]>(() =>
    slides.map((s) => Math.max(3, (s?.narracao || "").split(/\s+/).filter(Boolean).length / 2.6)),
  );
  const pendingSeekRef = useRef<number | null>(null);
  const { data: avatarSettings } = usePlatformSettings("ai_avatar");
  const { data: aiParams } = usePlatformSettings("ai_generation_params");
  const { data: branding } = usePlatformSettings("branding");
  const brandLogo = resolveLogoForBackground(branding as any) || logoRevisaoFacil;
  const resolved = resolveAiAvatar(
    aiParams,
    { ...DEFAULT_AI_AVATAR, ...(avatarSettings || {}) },
    { disciplina, areas, contentType: "apresentacao" },
  );
  const avatar = { ...resolved, role_label: aiRoleLabel(resolved.gender) };
  const avatarImage = avatar.image_url || professoraIa;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef<string>("");
  const cacheRef = useRef<Map<number, string>>(new Map());

  const getToken = useCallback(async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const fetchSlideAudio = useCallback(
    async (index: number, silent = false): Promise<string | null> => {
      const slide = slides[index];
      if (!slide?.narracao) return null;
      const cached = cacheRef.current.get(index);
      if (cached) return cached;
      try {
        if (!tokenRef.current) tokenRef.current = await getToken();
        const resp = await fetch(ttsUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(canonicalId
            ? { canonical_id: canonicalId, slide_index: index, avatar_gender: avatar.gender, faixa_etaria: faixaEtaria }
            : { texto: slide.narracao, avatar_gender: avatar.gender, faixa_etaria: faixaEtaria }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Falha (${resp.status})`);
        }
        let url: string | null = null;
        if (canonicalId) {
          const payload = await resp.json();
          url = typeof payload.audio_url === "string" ? payload.audio_url : null;
        } else {
          url = URL.createObjectURL(await resp.blob());
        }
        if (url) cacheRef.current.set(index, url);
        return url;
      } catch (e: any) {
        if (!silent) toast.error(e?.message || "Falha ao gerar narração");
        return null;
      }
    },
    [slides, getToken, canonicalId, avatar.gender, faixaEtaria],
  );

  const prefetch = useCallback(
    (index: number) => {
      if (index < slides.length && !cacheRef.current.has(index)) void fetchSlideAudio(index, true);
    },
    [fetchSlideAudio, slides.length],
  );

  const playFrom = useCallback(
    async (index: number) => {
      const cached = cacheRef.current.get(index);
      if (!cached) setLoading(true);
      const url = cached ?? (await fetchSlideAudio(index));
      setLoading(false);
      if (!url) {
        setPlaying(false);
        return;
      }
      setAudioUrl(url);
      setPlaying(true);
      setStarted(true);
      prefetch(index + 1);
    },
    [fetchSlideAudio, prefetch],
  );

  const handleEnded = useCallback(() => {
    setCurrent((c) => {
      const next = c + 1;
      if (next < slides.length) {
        void playFrom(next);
        return next;
      }
      setPlaying(false);
      return c;
    });
  }, [slides.length, playFrom]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (el.src !== audioUrl) el.src = audioUrl;
    if (playing) void el.play().catch(() => setPlaying(false));
  }, [audioUrl, playing]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      cache.clear();
    };
  }, []);

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

  useEffect(() => {
    if (!canonicalId || !slide?.imagem_prompt || generatedImages[current]) return;
    let active = true;
    void (async () => {
      try {
        if (!tokenRef.current) tokenRef.current = await getToken();
        const response = await fetch(imageUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json" },
          body: JSON.stringify({ canonical_id: canonicalId, slide_index: current }),
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (active && typeof payload.image_url === "string") {
          setGeneratedImages((images) => ({ ...images, [current]: payload.image_url }));
        }
      } catch {
        // Mantém a imagem temática local se a geração ainda não estiver pronta.
      }
    })();
    return () => { active = false; };
  }, [canonicalId, current, generatedImages, getToken, slide?.imagem_prompt]);

  const effectiveSlideImage = generatedImages[current] || slideImage;

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const m = Math.floor(value / 60);
    const s = Math.floor(value % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const updateCaption = useCallback(() => {
    const audio = audioRef.current;
    const text = slides[current]?.narracao || "";
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
    const real = Number.isFinite(audio.duration) ? audio.duration : 0;
    setDuration(real);
    if (real > 0) {
      setDurations((list) => {
        if (Math.abs((list[current] ?? 0) - real) < 0.05) return list;
        const next = [...list];
        next[current] = real;
        return next;
      });
      if (pendingSeekRef.current != null) {
        audio.currentTime = Math.min(pendingSeekRef.current, real - 0.1);
        pendingSeekRef.current = null;
      }
    }
    if (!text || !audio.duration) return;
    const words = text.split(/\s+/).filter(Boolean);
    const wordsPerCaption = 9;
    const progress = Math.min(audio.currentTime / audio.duration, 0.999);
    setSlideProgress(progress);
    const start = Math.floor((progress * words.length) / wordsPerCaption) * wordsPerCaption;
    setCaption(words.slice(start, start + wordsPerCaption).join(" "));
  }, [current, slides]);

  if (!slides.length) {
    return <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">Aula com professor virtual indisponível.</div>;
  }

  const isIntro = current === 0;
  const isOutro = current === slides.length - 1 && slides.length > 1;
  const avatarOnly = isIntro || isOutro;
  const keywords = slide?.palavras_chave ?? [];
  const activeKeyword = keywords
    .map((item, index) => ({ ...item, at: anchorProgress(slide?.narracao || "", item.ancora, (index + 1) / (keywords.length + 1)) }))
    .filter((item) => slideProgress >= item.at)
    .at(-1)?.termo;
  const visibleBoardSteps = (slide?.lousa_passos ?? []).filter((step, index, list) =>
    slideProgress >= anchorProgress(slide?.narracao || "", step.ancora, (index + 1) / (list.length + 1)),
  );
  const boardMode = slide?.modo_visual === "lousa" && (slide.lousa_passos?.length ?? 0) > 0;
  const oneBoardStep = faixaEtaria === "criancas_0_9";

  // Barra de tempo única: soma as durações de todos os slides.
  const slideDurations = slides.map(
    (s, i) => durations[i] || Math.max(3, (s?.narracao || "").split(/\s+/).filter(Boolean).length / 2.6),
  );
  const offsets = slideDurations.reduce<number[]>((acc, d, i) => {
    acc[i] = i === 0 ? 0 : acc[i - 1] + slideDurations[i - 1];
    return acc;
  }, []);
  const totalDuration = slideDurations.reduce((sum, d) => sum + d, 0);
  const globalTime = Math.min(offsets[current] + currentTime, totalDuration);

  const seekGlobal = (value: number) => {
    let index = 0;
    for (let i = 0; i < slides.length; i += 1) {
      if (value >= offsets[i]) index = i;
    }
    const offset = Math.max(0, value - offsets[index]);
    if (index === current) {
      if (audioRef.current) audioRef.current.currentTime = offset;
      setCurrentTime(offset);
      return;
    }
    pendingSeekRef.current = offset;
    setCurrent(index);
    setCurrentTime(offset);
    void playFrom(index);
  };

  const brandOverlay = (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex flex-col items-end gap-0.5 sm:bottom-3 sm:right-3">
      <img src={brandLogo} alt="Revisão Fácil" className="h-5 w-auto opacity-90 sm:h-7" />
      <span className="text-[8px] text-muted-foreground sm:text-[10px]">revisaofacil.com.br</span>
    </div>
  );

  const legalNotice = (
    <p className="border-t border-border bg-background/90 px-2 py-1 text-center text-[9px] text-muted-foreground sm:text-[10px]">
      Conteúdo produzido com apoio de IA: são tópicos prioritários e questões para praticar, não uma previsão da prova. Agende uma aula com um professor.
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
          <p className="text-[10px] text-muted-foreground sm:text-xs">Aula com professor virtual em {slides.length} slides</p>
          <Button size="lg" onClick={() => playFrom(0)} disabled={loading} className="ai-slide-btn pointer-events-auto rounded-full">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
            Assistir aula com professor virtual
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-slide-player w-full bg-muted">
      <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-video">
        <img
          src={effectiveSlideImage}
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
                {slide?.frase_didatica && (
                  <p className="ai-didactic-phrase mt-2 max-w-xl text-sm font-semibold leading-snug sm:mt-4 sm:text-xl">
                    <HighlightedText text={slide.frase_didatica} terms={keywords.map((item) => item.termo)} activeTerm={activeKeyword} />
                  </p>
                )}
                {boardMode ? (
                  <div className={`ai-virtual-board mt-2 sm:mt-4 ${faixaEtaria === "criancas_0_9" ? "is-child" : ""}`} aria-label="Lousa virtual com explicação passo a passo">
                    {(oneBoardStep ? visibleBoardSteps.slice(-1) : visibleBoardSteps).map((step, index) => (
                      <div key={`${step.conteudo}-${index}`} className={`ai-board-step ai-board-${step.tipo}`}>
                        {step.tipo === "seta" && <span aria-hidden="true">→</span>}
                        <HighlightedText text={step.conteudo} terms={step.destaque ? [step.destaque] : []} activeTerm={step.destaque} />
                      </div>
                    ))}
                  </div>
                ) : slide && (
                  <ul className="mt-2 space-y-1 sm:mt-5 sm:space-y-2">
                    {slide.bullets.slice(0, 4).map((bullet, index) => (
                      <li key={index} className="flex items-start gap-2 text-[11px] leading-snug sm:text-sm md:text-base">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span><HighlightedText text={bullet} terms={keywords.map((item) => item.termo)} activeTerm={activeKeyword} /></span>
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
              <HighlightedText text={caption} terms={keywords.map((item) => item.termo)} activeTerm={activeKeyword} />
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
        onLoadedMetadata={updateCaption}
        className="hidden"
      />
      <div className="flex items-center gap-2 border-t border-border bg-background/90 px-2 pb-1 pt-2">
        <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{formatTime(globalTime)}</span>
        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={totalDuration || 0}
            step={0.1}
            value={Math.min(globalTime, totalDuration || 0)}
            onChange={(event) => seekGlobal(Number(event.target.value))}
            aria-label="Barra de progresso da apresentação"
            className="ai-slide-progress h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <div className="pointer-events-none absolute inset-x-0 -bottom-2 h-1">
            {slides.map((_, index) => (
              <span
                key={index}
                style={{ left: `${totalDuration ? (offsets[index] / totalDuration) * 100 : 0}%` }}
                className={`absolute h-1 w-1 -translate-x-1/2 rounded-full ${index <= current ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
            ))}
          </div>
        </div>
        <span className="w-9 shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatTime(totalDuration)}</span>
      </div>
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
            aria-label="Slide anterior"
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
            aria-label="Próximo slide"
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
