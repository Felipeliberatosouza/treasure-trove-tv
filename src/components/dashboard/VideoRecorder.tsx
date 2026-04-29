import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Square, RotateCcw, Check, X, Camera, Loader2, Wand2, Sun, RefreshCcw, Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compositeVideo, ImpactWord } from "@/utils/videoCompositor";
import { shiftVtt } from "@/utils/vttSync";
import VideoPostEditor from "@/components/dashboard/VideoPostEditor";

interface VideoRecorderProps {
  maxMinutes: number;
  enableSubtitles?: boolean;
  enableBlackboard?: boolean;
  enableAutoCover?: boolean;
  enableWatermark?: boolean;
  watermarkText?: string;
  watermarkLogoUrl?: string;
  lessonTitle?: string;
  lessonArea?: string;
  teacherName?: string;
  onRecorded: (file: File, subtitlesVtt?: string) => void;
  onCancel: () => void;
}

type RecorderState = "idle" | "countdown" | "recording" | "preview" | "processing";

const VideoRecorder = ({
  maxMinutes,
  enableSubtitles = false,
  enableBlackboard = false,
  enableAutoCover = false,
  enableWatermark = false,
  watermarkText = "",
  watermarkLogoUrl = "",
  lessonTitle = "",
  lessonArea = "",
  teacherName = "",
  onRecorded,
  onCancel,
}: VideoRecorderProps) => {
  const [state, setState] = useState<RecorderState>("idle");
  const [countdown, setCountdown] = useState(5);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [processingStep, setProcessingStep] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveAnimRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subtitlesVttRef = useRef<string>("");

  // Ajustes ao vivo de imagem (gravados no vídeo final via canvas)
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [exposure, setExposure] = useState(0); // -50..+50 (gamma-like)
  // Auto contínuo: reanalisa periodicamente a iluminação durante a gravação
  const [autoContinuous, setAutoContinuous] = useState(false);
  const [autoIntervalSec, setAutoIntervalSec] = useState(5);
  const autoLightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoIntervalSecRef = useRef(5);
  useEffect(() => { autoIntervalSecRef.current = autoIntervalSec; }, [autoIntervalSec]);
  // Ref espelha o estado para o loop de render acessar sem re-criar callback
  const filterRef = useRef({ b: 100, c: 100, s: 100, e: 0 });
  useEffect(() => {
    filterRef.current = { b: brightness, c: contrast, s: saturation, e: exposure };
  }, [brightness, contrast, saturation, exposure]);

  const buildLiveFilter = () => {
    const { b, c, s, e } = filterRef.current;
    // Exposure: leve ajuste extra de brilho (multiplicativo)
    const expFactor = 100 + e; // -50..+50 -> 50..150
    return `brightness(${(b * expFactor) / 100}%) contrast(${c}%) saturate(${s}%)`;
  };

  const resetLightAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setExposure(0);
  };

  /**
   * Auto-luminosidade: amostra o frame atual da câmera para sugerir
   * brilho, contraste, exposição e saturação adequados à iluminação.
   *  - Calcula luminância média (Y) e desvio padrão como proxy de contraste.
   *  - Calcula saturação média (HSV-ish) para detectar imagem "lavada".
   */
  const applyAutoLight = (silent = false) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      if (!silent) toast.error("Aguarde a câmera carregar para usar o modo automático.");
      return;
    }
    const tmp = document.createElement("canvas");
    tmp.width = 96;
    tmp.height = 54;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    // Desenha o frame ATUAL bruto (sem filtros) para análise objetiva
    tctx.filter = "none";
    tctx.drawImage(v, 0, 0, tmp.width, tmp.height);
    const data = tctx.getImageData(0, 0, tmp.width, tmp.height).data;

    let sumY = 0;
    let sumY2 = 0;
    let sumSat = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminância Rec.709
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumY += y;
      sumY2 += y * y;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      sumSat += max === 0 ? 0 : (max - min) / max; // 0..1
    }
    const meanY = sumY / n; // 0..255
    const variance = Math.max(0, sumY2 / n - meanY * meanY);
    const stdY = Math.sqrt(variance); // 0..~127
    const meanSat = sumSat / n; // 0..1

    // Heurísticas — alvo: meanY ~ 130, stdY ~ 55, meanSat ~ 0.35
    const TARGET_Y = 130;
    const TARGET_STD = 55;
    const TARGET_SAT = 0.35;

    // Brilho: compensa proporcionalmente o quão escuro/claro está
    const yDelta = TARGET_Y - meanY; // negativo = imagem clara demais
    let bSuggest = 100 + yDelta * 0.35;
    bSuggest = Math.max(70, Math.min(140, Math.round(bSuggest)));

    // Exposição extra para casos extremos (muito escuro ou muito claro)
    let eSuggest = 0;
    if (meanY < 70) eSuggest = Math.round((70 - meanY) * 0.4);
    else if (meanY > 190) eSuggest = -Math.round((meanY - 190) * 0.4);
    eSuggest = Math.max(-40, Math.min(40, eSuggest));

    // Contraste: aumenta quando a imagem está "chapada" (stdY baixo)
    const stdDelta = TARGET_STD - stdY;
    let cSuggest = 100 + stdDelta * 0.6;
    cSuggest = Math.max(85, Math.min(135, Math.round(cSuggest)));

    // Saturação: leve correção quando a imagem está dessaturada
    const satDelta = TARGET_SAT - meanSat;
    let sSuggest = 100 + satDelta * 80; // satDelta ~ -0.3..+0.3
    sSuggest = Math.max(85, Math.min(140, Math.round(sSuggest)));

    setBrightness(bSuggest);
    setExposure(eSuggest);
    setContrast(cSuggest);
    setSaturation(sSuggest);

    let condicao = "iluminação adequada";
    if (meanY < 80) condicao = "ambiente muito escuro";
    else if (meanY < 110) condicao = "ambiente pouco iluminado";
    else if (meanY > 180) condicao = "ambiente muito claro";
    else if (stdY < 35) condicao = "imagem com pouco contraste";

    if (!silent) {
      toast.success(`Auto aplicado · ${condicao}`, {
        description: `Brilho ${bSuggest}% · Exposição ${eSuggest > 0 ? "+" : ""}${eSuggest} · Contraste ${cSuggest}% · Saturação ${sSuggest}%`,
        duration: 4500,
      });
    }
  };

  // Liga/desliga o ciclo de Auto contínuo. Faz uma análise imediata
  // e depois reanalisa a cada N segundos enquanto estiver ativo.
  useEffect(() => {
    if (autoLightIntervalRef.current) {
      clearInterval(autoLightIntervalRef.current);
      autoLightIntervalRef.current = null;
    }
    if (!autoContinuous) return;
    // análise imediata silenciosa
    applyAutoLight(true);
    autoLightIntervalRef.current = setInterval(() => {
      applyAutoLight(true);
    }, Math.max(1, autoIntervalSecRef.current) * 1000);
    return () => {
      if (autoLightIntervalRef.current) {
        clearInterval(autoLightIntervalRef.current);
        autoLightIntervalRef.current = null;
      }
    };
  }, [autoContinuous, autoIntervalSec]);

  // Garante limpeza ao desmontar
  useEffect(() => () => {
    if (autoLightIntervalRef.current) clearInterval(autoLightIntervalRef.current);
  }, []);

  const maxSeconds = maxMinutes * 60;
  const needsProcessing =
    enableSubtitles || enableBlackboard || enableAutoCover || enableWatermark;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (audioRecorderRef.current?.state === "recording") {
      audioRecorderRef.current.stop();
    }
    stopStream();
  }, [stopStream]);

  useEffect(() => () => cleanup(), [cleanup]);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      startLiveRender();
      setState("idle");
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  };

  // Loop de render do canvas ao vivo aplicando os filtros
  const startLiveRender = () => {
    if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
    const tick = () => {
      const v = videoRef.current;
      const c = liveCanvasRef.current;
      if (v && c && v.videoWidth) {
        if (c.width !== v.videoWidth) c.width = v.videoWidth;
        if (c.height !== v.videoHeight) c.height = v.videoHeight;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.filter = buildLiveFilter();
          ctx.drawImage(v, 0, 0, c.width, c.height);
        }
      }
      liveAnimRef.current = requestAnimationFrame(tick);
    };
    liveAnimRef.current = requestAnimationFrame(tick);
  };

  const startCountdown = () => {
    setState("countdown");
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = () => {
    if (!streamRef.current || !liveCanvasRef.current) return;
    chunksRef.current = [];
    audioChunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    // Captura o stream do canvas (com filtros ao vivo) + áudio do microfone
    const canvasStream = liveCanvasRef.current.captureStream(30);
    streamRef.current.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

    // Main video recorder (canvas com luminosidade aplicada)
    const recorder = new MediaRecorder(canvasStream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      stopStream();

      if (needsProcessing) {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processVideo(blob, audioBlob);
      } else {
        setState("preview");
        if (previewRef.current) {
          previewRef.current.src = URL.createObjectURL(blob);
        }
      }
    };

    // Separate audio recorder for transcription (smaller file)
    if (needsProcessing) {
      const audioStream = new MediaStream(streamRef.current.getAudioTracks());
      const audioRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
      audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      audioRecorder.start(1000);
      audioRecorderRef.current = audioRecorder;
    }

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setElapsed(0);
    setState("recording");

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= maxSeconds) {
          stopRecording();
          return maxSeconds;
        }
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRecorderRef.current?.state === "recording") {
      audioRecorderRef.current.stop();
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const processVideo = async (videoBlob: Blob, audioBlob: Blob) => {
    setState("processing");
    setProcessingProgress(0);

    try {
      let impactWords: ImpactWord[] = [];
      let subtitlesVtt = "";

      // Step 1: Send audio to AI for transcription
      if (enableSubtitles || enableBlackboard) {
        setProcessingStep("Transcrevendo áudio com IA...");
        setProcessingProgress(10);

        const audioBase64 = await blobToBase64(audioBlob);

        const { data: funcData, error: funcError } = await supabase.functions.invoke(
          "process-recorded-video",
          {
            body: {
              audioBase64,
              title: lessonTitle,
              mimeType: "audio/webm",
            },
          }
        );

        if (funcError) {
          console.error("Transcription function error:", funcError);
          toast.error("Erro na transcrição. O vídeo será salvo sem legendas/quadro negro.");
        } else if (funcData) {
          subtitlesVtt = funcData.subtitlesVtt || "";
          impactWords = funcData.impactWords || [];
          subtitlesVttRef.current = subtitlesVtt;
        }

        setProcessingProgress(40);
      }

      // Step 2: Composite video with blackboard/intro/watermark if needed
      const hasWatermark = enableWatermark && (watermarkText.trim() || watermarkLogoUrl.trim());
      const shouldComposite = enableBlackboard || enableAutoCover || !!hasWatermark;

      // Fallback: if blackboard is enabled but AI returned no impact words,
      // build a basic set from the lesson title so the chalkboard still renders.
      if (enableBlackboard && impactWords.length === 0 && lessonTitle) {
        const titleWords = lessonTitle
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 6);
        if (titleWords.length > 0) {
          // Estimate duration from blob size as a rough proxy if needed
          const estimatedDuration = Math.max(30, Math.min(600, audioBlob.size / 16000));
          const slice = estimatedDuration / titleWords.length;
          impactWords = titleWords.map((word, i) => ({
            word,
            timestamp: i * slice,
            duration: Math.max(5, slice * 0.9),
          }));
          console.log("[VideoRecorder] Using title fallback for impact words:", impactWords);
        }
      }

      if (shouldComposite) {
        setProcessingStep(
          enableBlackboard
            ? "Processando vídeo com quadro negro..."
            : enableAutoCover
              ? "Adicionando capa de introdução..."
              : "Aplicando marca d'água da plataforma...",
        );

        const compositedBlob = await compositeVideo(videoBlob, {
          impactWords: enableBlackboard ? impactWords : [],
          introTitle: enableAutoCover ? lessonTitle : undefined,
          introArea: enableAutoCover ? lessonArea : undefined,
          introTeacher: enableAutoCover ? teacherName : undefined,
          watermarkText: enableWatermark ? watermarkText || undefined : undefined,
          watermarkLogoUrl: enableWatermark ? watermarkLogoUrl || undefined : undefined,
          onProgress: (p) => {
            setProcessingProgress(40 + Math.round(p * 0.55));
          },
          onWatermarkStatus: (status) => {
            if (status.kind === "logo_failed") {
              if (status.fellBackToText) {
                toast.warning(
                  "Não foi possível carregar a logo da plataforma. Marca d'água aplicada apenas com o nome.",
                  { duration: 8000 },
                );
              } else {
                toast.error(
                  "Falha ao carregar a logo da plataforma. O vídeo será publicado sem marca d'água.",
                  { duration: 8000 },
                );
              }
            }
          },
        });

        // If an intro cover was prepended, shift VTT timestamps so that
        // subtitles stay aligned with the (delayed) audio track.
        if (enableAutoCover && subtitlesVtt) {
          const INTRO_SEC = 4; // matches compositeVideo default introDurationSec
          const result = shiftVtt(subtitlesVtt, INTRO_SEC);
          console.log("[VideoRecorder] VTT shifted for intro:", {
            cueCount: result.cueCount,
            offsetSec: result.offsetSec,
            samples: result.samples,
            valid: result.valid,
          });
          if (!result.valid) {
            console.warn("[VideoRecorder] VTT shift validation failed", result.samples);
          }
          subtitlesVtt = result.vtt;
          subtitlesVttRef.current = result.vtt;
        }

        setRecordedBlob(compositedBlob);
        if (previewRef.current) {
          previewRef.current.src = URL.createObjectURL(compositedBlob);
        }
      } else {
        // No compositing needed, use original video
        if (previewRef.current) {
          previewRef.current.src = URL.createObjectURL(videoBlob);
        }
      }

      setProcessingProgress(100);
      setProcessingStep("Processamento concluído!");
      setState("preview");
    } catch (err) {
      console.error("Video processing error:", err);
      toast.error("Erro ao processar vídeo. Usando vídeo original.");
      if (previewRef.current) {
        previewRef.current.src = URL.createObjectURL(videoBlob);
      }
      setState("preview");
    }
  };

  const reRecord = async () => {
    setRecordedBlob(null);
    setElapsed(0);
    subtitlesVttRef.current = "";
    setState("idle");
    await startCamera();
  };

  const approve = () => {
    if (!recordedBlob) return;
    const file = new File([recordedBlob], `gravacao-${Date.now()}.webm`, {
      type: recordedBlob.type,
    });
    onRecorded(file, subtitlesVttRef.current || undefined);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const remaining = maxSeconds - elapsed;

  useEffect(() => {
    startCamera();
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-3">
        <Camera className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
        <div className="flex gap-2 justify-center">
          <Button size="sm" onClick={startCamera}>Tentar novamente</Button>
          <Button size="sm" variant="secondary" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-w-lg">
        {/* Live camera feed (oculto: alimenta o canvas) */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />
        {/* Canvas com filtros de luminosidade aplicados (também é o que é gravado) */}
        <canvas
          ref={liveCanvasRef}
          className={`w-full h-full object-cover ${state === "preview" || state === "processing" ? "hidden" : ""}`}
        />

        {/* Preview of recorded video */}
        <video
          ref={previewRef}
          className={`w-full h-full object-cover ${state !== "preview" ? "hidden" : ""}`}
          playsInline
          controls
          crossOrigin="anonymous"
        >
          {state === "preview" && subtitlesVttRef.current && (
            <track
              kind="subtitles"
              src={URL.createObjectURL(
                new Blob([subtitlesVttRef.current], { type: "text/vtt" })
              )}
              srcLang="pt-BR"
              label="Português"
              default
            />
          )}
        </video>

        {/* Processing overlay */}
        {state === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 px-6">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-sm text-white font-medium mb-2">{processingStep}</p>
            <Progress value={processingProgress} className="w-full max-w-xs" />
            <p className="text-xs text-white/60 mt-2">{processingProgress}%</p>
          </div>
        )}

        {/* Countdown overlay */}
        {state === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <span className="text-7xl font-bold text-white animate-pulse">{countdown}</span>
          </div>
        )}

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-mono text-white bg-black/60 px-2 py-0.5 rounded">
              GRAVANDO
            </span>
          </div>
        )}

        {/* Remaining time */}
        {state === "recording" && (
          <div className="absolute top-3 right-3 z-10">
            <span
              className={`text-sm font-mono px-2 py-0.5 rounded ${
                remaining <= 60 ? "bg-destructive/80 text-white" : "bg-black/60 text-white"
              }`}
            >
              {formatTime(remaining)}
            </span>
          </div>
        )}

        {/* Elapsed time */}
        {state === "recording" && (
          <div className="absolute bottom-3 right-3 z-10">
            <span className="text-xs font-mono text-white bg-black/60 px-2 py-0.5 rounded">
              {formatTime(elapsed)} / {formatTime(maxSeconds)}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {state === "idle" && (
          <>
            <Button size="sm" onClick={startCountdown} className="gap-1">
              <Video className="h-4 w-4" /> Iniciar Gravação
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </>
        )}

        {state === "countdown" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (countdownRef.current) clearInterval(countdownRef.current);
              setState("idle");
            }}
          >
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
        )}

        {state === "recording" && (
          <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-1">
            <Square className="h-4 w-4" /> Parar Gravação
          </Button>
        )}

        {state === "processing" && (
          <p className="text-xs text-muted-foreground">
            Processando vídeo com IA... Não feche esta página.
          </p>
        )}

        {state === "preview" && (
          <>
            <Button size="sm" onClick={approve} className="gap-1">
              <Check className="h-4 w-4" /> Aprovar Vídeo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="gap-1"
            >
              <Wand2 className="h-4 w-4" /> Editar vídeo
            </Button>
            <Button size="sm" variant="secondary" onClick={reRecord} className="gap-1">
              <RotateCcw className="h-4 w-4" /> Regravar
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </>
        )}
      </div>

      {/* Painel de luminosidade ao vivo (visível antes/durante a gravação) */}
      {(state === "idle" || state === "countdown" || state === "recording") && (
        <div className="rounded-lg border bg-card p-3 max-w-lg space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-1">
              <Sun className="h-4 w-4 text-primary" /> Ajuste de luminosidade ao vivo
            </h4>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => applyAutoLight(false)}
                title="Sugere valores com base na iluminação atual da câmera"
              >
                <Sparkles className="h-3 w-3" /> Auto
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                onClick={resetLightAdjustments}
              >
                <RefreshCcw className="h-3 w-3" /> Redefinir
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Use <strong>Auto</strong> para sugerir valores conforme a iluminação detectada, ou ajuste manualmente. Tudo é gravado no vídeo final.
          </p>
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <Label htmlFor="auto-cont" className="text-xs font-medium cursor-pointer">
                  Auto contínuo
                </Label>
                {autoContinuous && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    ativo
                  </span>
                )}
              </div>
              <Switch
                id="auto-cont"
                checked={autoContinuous}
                onCheckedChange={setAutoContinuous}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Reanalisa a iluminação a cada poucos segundos e ajusta automaticamente os valores enquanto você grava.
            </p>
            <div className="space-y-1">
              <Label className="text-[10px]">Intervalo: {autoIntervalSec}s</Label>
              <Slider
                value={[autoIntervalSec]}
                min={2}
                max={20}
                step={1}
                onValueChange={([v]) => setAutoIntervalSec(v)}
                disabled={!autoContinuous}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Brilho: {brightness}%</Label>
              <Slider value={[brightness]} min={50} max={150} step={1} onValueChange={([v]) => setBrightness(v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Exposição: {exposure > 0 ? `+${exposure}` : exposure}</Label>
              <Slider value={[exposure]} min={-50} max={50} step={1} onValueChange={([v]) => setExposure(v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contraste: {contrast}%</Label>
              <Slider value={[contrast]} min={50} max={150} step={1} onValueChange={([v]) => setContrast(v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saturação: {saturation}%</Label>
              <Slider value={[saturation]} min={0} max={200} step={1} onValueChange={([v]) => setSaturation(v)} />
            </div>
          </div>
        </div>
      )}

      {/* Editor pós-gravação (efeitos: zoom, fundo, luz, beauty) */}
      {isEditing && recordedBlob && (
        <div className="rounded-lg border bg-card p-3 mt-2">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Wand2 className="h-4 w-4 text-primary" /> Editor de vídeo
          </h4>
          <VideoPostEditor
            sourceBlob={recordedBlob}
            onCancel={() => setIsEditing(false)}
            onApply={(editedBlob) => {
              setRecordedBlob(editedBlob);
              if (previewRef.current) {
                previewRef.current.src = URL.createObjectURL(editedBlob);
              }
              setIsEditing(false);
              toast.success("Edição aplicada! Confira o preview e aprove.");
            }}
          />
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Tempo máximo de gravação: {maxMinutes} minuto{maxMinutes > 1 ? "s" : ""}</p>
        {needsProcessing && (
          <p className="text-primary/80">
            ✦ Após gravação: {[
              enableSubtitles && "legendas automáticas",
              enableBlackboard && "quadro negro com palavras-chave",
              enableAutoCover && "capa de introdução",
              enableWatermark && "marca d'água da plataforma",
            ].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
};

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // Remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default VideoRecorder;
