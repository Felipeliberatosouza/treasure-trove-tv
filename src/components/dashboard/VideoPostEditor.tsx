import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Wand2,
  ZoomIn,
  Image as ImageIcon,
  Sun,
  Sparkles,
  Plus,
  Trash2,
  Play,
  Pause,
  Loader2,
  X,
  Check,
} from "lucide-react";

/**
 * VideoPostEditor — editor pós-gravação que aplica efeitos via Canvas
 * + MediaRecorder e exporta um novo Blob WebM.
 *
 * Recursos:
 *  - Brilho / contraste / saturação / temperatura
 *  - Suavização de pele (beauty) — blur leve seletivo
 *  - Correção automática de iluminação (auto-levels por amostragem do 1º frame)
 *  - Fundos: original | desfoque | cor sólida | imagem (predefinida ou upload)
 *    via MediaPipe Selfie Segmentation carregado por CDN
 *  - Zoom manual com keyframes na timeline + zoom automático no rosto
 */

const PRESET_BACKGROUNDS = [
  { id: "classroom", label: "Sala de aula", url: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1280&q=80" },
  { id: "blackboard", label: "Lousa verde", url: "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=1280&q=80" },
  { id: "office", label: "Escritório", url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80" },
  { id: "gradient", label: "Gradiente azul", url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1280&q=80" },
  { id: "library", label: "Biblioteca", url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1280&q=80" },
];

type BgMode = "original" | "blur" | "color" | "image";

interface ZoomKeyframe {
  t: number; // segundos
  scale: number; // 1.0 - 3.0
  cx: number; // 0..1
  cy: number; // 0..1
}

interface VideoPostEditorProps {
  sourceBlob: Blob;
  onCancel: () => void;
  onApply: (editedBlob: Blob) => void;
}

// Carrega MediaPipe Selfie Segmentation por CDN (não adiciona ao bundle)
let segmenterPromise: Promise<any> | null = null;
const loadSegmenter = (): Promise<any> => {
  if (segmenterPromise) return segmenterPromise;
  segmenterPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.SelfieSegmentation) return resolve(w.SelfieSegmentation);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve((window as any).SelfieSegmentation);
    script.onerror = () => reject(new Error("Falha ao carregar segmentação"));
    document.head.appendChild(script);
  });
  return segmenterPromise;
};

// Carrega MediaPipe Face Detection por CDN
let faceDetectorPromise: Promise<any> | null = null;
const loadFaceDetector = (): Promise<any> => {
  if (faceDetectorPromise) return faceDetectorPromise;
  faceDetectorPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.FaceDetection) return resolve(w.FaceDetection);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve((window as any).FaceDetection);
    script.onerror = () => reject(new Error("Falha ao carregar detector de rosto"));
    document.head.appendChild(script);
  });
  return faceDetectorPromise;
};

const VideoPostEditor = ({ sourceBlob, onCancel, onApply }: VideoPostEditorProps) => {
  const sourceUrl = useMemo(() => URL.createObjectURL(sourceBlob), [sourceBlob]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const segmenterRef = useRef<any>(null);
  const lastMaskRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Controles de imagem
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [temperature, setTemperature] = useState(0); // -50 frio .. +50 quente
  const [beauty, setBeauty] = useState(0); // 0..100
  const [autoLight, setAutoLight] = useState(false);

  // Fundo
  const [bgMode, setBgMode] = useState<BgMode>("original");
  const [bgColor, setBgColor] = useState("#0f172a");
  const [bgImageUrl, setBgImageUrl] = useState<string>("");
  const [bgLoading, setBgLoading] = useState(false);

  // Zoom
  const [zoomMode, setZoomMode] = useState<"manual" | "auto">("manual");
  const [keyframes, setKeyframes] = useState<ZoomKeyframe[]>([]);
  const [currentScale, setCurrentScale] = useState(1);
  const [currentCx, setCurrentCx] = useState(0.5);
  const [currentCy, setCurrentCy] = useState(0.5);
  const [autoZoomIntensity, setAutoZoomIntensity] = useState(60); // 0..100
  const [faceDetected, setFaceDetected] = useState(false);
  // Suavização: 0 = muito suave/lento, 100 = responde imediatamente
  const [autoSmoothing, setAutoSmoothing] = useState(40);
  // Refs para o loop (sem causar re-render)
  const autoTrackRef = useRef({ cx: 0.5, cy: 0.5, scale: 1, hasFace: false });
  const faceDetectorRef = useRef<any>(null);
  const lastFaceBoxRef = useRef<{ cx: number; cy: number; size: number } | null>(null);
  const faceLossFramesRef = useRef(0);
  const autoIntensityRef = useRef(60);
  useEffect(() => { autoIntensityRef.current = autoZoomIntensity; }, [autoZoomIntensity]);
  const autoSmoothingRef = useRef(40);
  useEffect(() => { autoSmoothingRef.current = autoSmoothing; }, [autoSmoothing]);

  // Auto-light cache
  const autoLightAdjustRef = useRef<{ b: number; c: number } | null>(null);

  // Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Export
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Carrega imagem de fundo
  useEffect(() => {
    if (bgMode !== "image" || !bgImageUrl) {
      bgImageRef.current = null;
      return;
    }
    setBgLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImageRef.current = img;
      setBgLoading(false);
    };
    img.onerror = () => {
      toast.error("Falha ao carregar imagem de fundo.");
      setBgLoading(false);
    };
    img.src = bgImageUrl;
  }, [bgMode, bgImageUrl]);

  // Carrega segmentador quando precisar
  useEffect(() => {
    if (bgMode === "original") return;
    let cancelled = false;
    setBgLoading(true);
    loadSegmenter()
      .then((SelfieSegmentation) => {
        if (cancelled) return;
        const seg = new SelfieSegmentation({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });
        seg.setOptions({ modelSelection: 1, selfieMode: false });
        seg.onResults((results: any) => {
          if (!results.segmentationMask) return;
          const mask = lastMaskRef.current ?? document.createElement("canvas");
          mask.width = results.segmentationMask.width;
          mask.height = results.segmentationMask.height;
          const mctx = mask.getContext("2d")!;
          mctx.clearRect(0, 0, mask.width, mask.height);
          mctx.drawImage(results.segmentationMask, 0, 0);
          lastMaskRef.current = mask;
        });
        segmenterRef.current = seg;
        setBgLoading(false);
      })
      .catch(() => {
        toast.error("Não foi possível carregar o módulo de segmentação. Usando fundo original.");
        setBgMode("original");
        setBgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bgMode]);

  // Auto-light: amostra o 1º frame para sugerir brilho/contraste
  const computeAutoLight = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    const tmp = document.createElement("canvas");
    tmp.width = 64;
    tmp.height = 36;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(v, 0, 0, 64, 36);
    const data = ctx.getImageData(0, 0, 64, 36).data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      count++;
    }
    const avg = sum / count; // 0..255
    // alvo ~128. compensa brilho proporcionalmente
    const b = Math.max(70, Math.min(140, 100 + (128 - avg) * 0.3));
    const c_ = avg < 80 || avg > 180 ? 115 : 105;
    autoLightAdjustRef.current = { b, c: c_ };
  }, []);

  // Carrega detector de rosto quando o modo auto for ativado
  useEffect(() => {
    if (zoomMode !== "auto") return;
    if (faceDetectorRef.current) return;
    let cancelled = false;
    loadFaceDetector()
      .then((FaceDetection) => {
        if (cancelled) return;
        const fd = new FaceDetection({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });
        fd.setOptions({ model: "short", minDetectionConfidence: 0.55 });
        fd.onResults((results: any) => {
          const dets = results?.detections;
          if (dets && dets.length > 0) {
            // Pega o rosto de maior área
            let best = dets[0];
            let bestArea = 0;
            for (const d of dets) {
              const bb = d.boundingBox;
              const area = bb.width * bb.height;
              if (area > bestArea) {
                bestArea = area;
                best = d;
              }
            }
            const bb = best.boundingBox;
            // MediaPipe retorna cx/cy normalizados (centro) e width/height normalizados
            const cx = bb.xCenter ?? bb.x + bb.width / 2;
            const cy = bb.yCenter ?? bb.y + bb.height / 2;
            const size = Math.max(bb.width, bb.height);
            lastFaceBoxRef.current = { cx, cy, size };
            faceLossFramesRef.current = 0;
            if (!autoTrackRef.current.hasFace) setFaceDetected(true);
            autoTrackRef.current.hasFace = true;
          } else {
            faceLossFramesRef.current += 1;
            if (faceLossFramesRef.current > 30) {
              lastFaceBoxRef.current = null;
              if (autoTrackRef.current.hasFace) setFaceDetected(false);
              autoTrackRef.current.hasFace = false;
            }
          }
        });
        faceDetectorRef.current = fd;
      })
      .catch(() => {
        toast.error("Não foi possível carregar o detector de rosto. Usando zoom centralizado.");
      });
    return () => {
      cancelled = true;
    };
  }, [zoomMode]);

  // Interpola keyframes para o tempo atual
  const interpolateZoom = useCallback(
    (t: number): { scale: number; cx: number; cy: number } => {
      if (zoomMode === "auto") {
        // Usa o tracking suavizado calculado no renderFrame
        return {
          scale: autoTrackRef.current.scale,
          cx: autoTrackRef.current.cx,
          cy: autoTrackRef.current.cy,
        };
      }
      if (zoomMode !== "manual" || keyframes.length === 0) {
        return { scale: 1, cx: 0.5, cy: 0.5 };
      }
      const sorted = [...keyframes].sort((a, b) => a.t - b.t);
      if (t <= sorted[0].t) return { scale: sorted[0].scale, cx: sorted[0].cx, cy: sorted[0].cy };
      const last = sorted[sorted.length - 1];
      if (t >= last.t) return { scale: last.scale, cx: last.cx, cy: last.cy };
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (t >= a.t && t <= b.t) {
          const k = (t - a.t) / (b.t - a.t);
          // easing suave
          const e = k * k * (3 - 2 * k);
          return {
            scale: a.scale + (b.scale - a.scale) * e,
            cx: a.cx + (b.cx - a.cx) * e,
            cy: a.cy + (b.cy - a.cy) * e,
          };
        }
      }
      return { scale: 1, cx: 0.5, cy: 0.5 };
    },
    [keyframes, zoomMode]
  );

  // Aplica filtros CSS de cor
  const buildFilter = useCallback(() => {
    let b = brightness;
    let c = contrast;
    if (autoLight && autoLightAdjustRef.current) {
      b = (b * autoLightAdjustRef.current.b) / 100;
      c = (c * autoLightAdjustRef.current.c) / 100;
    }
    const sat = saturation;
    // temperatura via hue-rotate sutil + sepia: simples e rápido
    const hue = temperature * 0.4; // -20..+20 graus
    const sepia = temperature > 0 ? Math.min(20, temperature * 0.3) : 0;
    return `brightness(${b}%) contrast(${c}%) saturate(${sat}%) hue-rotate(${hue}deg) sepia(${sepia}%)`;
  }, [brightness, contrast, saturation, temperature, autoLight]);

  // Loop de renderização
  const renderFrame = useCallback(async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) {
      animationRef.current = requestAnimationFrame(renderFrame);
      return;
    }
    if (c.width !== v.videoWidth) c.width = v.videoWidth;
    if (c.height !== v.videoHeight) c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;

    setCurrentTime(v.currentTime);

    // Detecção de rosto (modo auto): roda a cada frame quando playing
    if (zoomMode === "auto" && faceDetectorRef.current && !v.paused) {
      try {
        await faceDetectorRef.current.send({ image: v });
      } catch {
        // ignora
      }
    }

    // Atualiza tracking suavizado para o modo auto
    if (zoomMode === "auto") {
      const intensity = autoIntensityRef.current / 100; // 0..1
      if (lastFaceBoxRef.current) {
        const fb = lastFaceBoxRef.current;
        // Zoom alvo: rosto pequeno => mais zoom. Tamanho do rosto ideal ~ 0.35 da altura
        const targetSize = 0.35;
        const ratio = targetSize / Math.max(0.05, fb.size);
        // Limitado por intensidade
        const maxScale = 1 + intensity * 1.5; // até 2.5x
        const targetScale = Math.max(1, Math.min(maxScale, ratio));
        // Suavização (lerp com fator baixo)
        const lerp = 0.08;
        autoTrackRef.current.scale += (targetScale - autoTrackRef.current.scale) * lerp;
        autoTrackRef.current.cx += (fb.cx - autoTrackRef.current.cx) * lerp;
        autoTrackRef.current.cy += (fb.cy - autoTrackRef.current.cy) * lerp;
      } else {
        // Sem rosto: volta para enquadramento neutro suavemente
        const lerp = 0.05;
        autoTrackRef.current.scale += (1 - autoTrackRef.current.scale) * lerp;
        autoTrackRef.current.cx += (0.5 - autoTrackRef.current.cx) * lerp;
        autoTrackRef.current.cy += (0.5 - autoTrackRef.current.cy) * lerp;
      }
    } else {
      // Reset rápido se não estiver em auto
      autoTrackRef.current.scale = 1;
      autoTrackRef.current.cx = 0.5;
      autoTrackRef.current.cy = 0.5;
    }

    const z = interpolateZoom(v.currentTime);
    setCurrentScale(z.scale);
    setCurrentCx(z.cx);
    setCurrentCy(z.cy);

    // 1. Fundo (se necessário, segmenta)
    let useSegmented = false;
    if (bgMode !== "original" && segmenterRef.current && !v.paused) {
      try {
        await segmenterRef.current.send({ image: v });
        useSegmented = !!lastMaskRef.current;
      } catch {
        // ignora
      }
    } else if (bgMode !== "original" && segmenterRef.current && lastMaskRef.current) {
      useSegmented = true;
    }

    ctx.save();
    ctx.filter = "none";

    // Aplica zoom: desenha região ampliada
    const sw = c.width / z.scale;
    const sh = c.height / z.scale;
    const sx = Math.max(0, Math.min(c.width - sw, z.cx * c.width - sw / 2));
    const sy = Math.max(0, Math.min(c.height - sh, z.cy * c.height - sh / 2));

    if (useSegmented && lastMaskRef.current) {
      // Desenha fundo
      if (bgMode === "blur") {
        ctx.filter = "blur(18px) brightness(95%)";
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
        ctx.filter = "none";
      } else if (bgMode === "color") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, c.width, c.height);
      } else if (bgMode === "image" && bgImageRef.current) {
        const img = bgImageRef.current;
        // cover
        const ar = img.width / img.height;
        const car = c.width / c.height;
        let dw = c.width, dh = c.height, dx = 0, dy = 0;
        if (ar > car) {
          dh = c.height;
          dw = dh * ar;
          dx = (c.width - dw) / 2;
        } else {
          dw = c.width;
          dh = dw / ar;
          dy = (c.height - dh) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, c.width, c.height);
      }

      // Recorta a pessoa via máscara e desenha por cima com filtros
      const personCanvas = document.createElement("canvas");
      personCanvas.width = c.width;
      personCanvas.height = c.height;
      const pctx = personCanvas.getContext("2d")!;
      pctx.filter = buildFilter();
      pctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      pctx.filter = "none";
      // Aplica máscara
      pctx.globalCompositeOperation = "destination-in";
      pctx.drawImage(lastMaskRef.current, 0, 0, c.width, c.height);
      pctx.globalCompositeOperation = "source-over";

      // Beauty: blur seletivo (desenha versão suavizada por baixo)
      if (beauty > 0) {
        const blurAmount = (beauty / 100) * 4;
        const soft = document.createElement("canvas");
        soft.width = c.width;
        soft.height = c.height;
        const sctx = soft.getContext("2d")!;
        sctx.filter = `blur(${blurAmount}px)`;
        sctx.drawImage(personCanvas, 0, 0);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(soft, 0, 0);
        ctx.globalAlpha = 1;
      }

      ctx.drawImage(personCanvas, 0, 0);
    } else {
      // Sem segmentação: só filtros + zoom
      ctx.filter = buildFilter();
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      if (beauty > 0) {
        const blurAmount = (beauty / 100) * 4;
        ctx.filter = `${buildFilter()} blur(${blurAmount}px)`;
        ctx.globalAlpha = 0.4;
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    animationRef.current = requestAnimationFrame(renderFrame);
  }, [bgMode, bgColor, beauty, buildFilter, interpolateZoom]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [renderFrame]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(sourceUrl);
      if (segmenterRef.current?.close) {
        try { segmenterRef.current.close(); } catch { /* noop */ }
      }
      if (faceDetectorRef.current?.close) {
        try { faceDetectorRef.current.close(); } catch { /* noop */ }
      }
    };
  }, [sourceUrl]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
  };

  const addKeyframe = () => {
    const v = videoRef.current;
    if (!v) return;
    const kf: ZoomKeyframe = {
      t: v.currentTime,
      scale: currentScale < 1.05 ? 1.6 : currentScale,
      cx: currentCx,
      cy: currentCy,
    };
    setKeyframes((prev) => [...prev, kf]);
    toast.success(`Keyframe adicionado em ${kf.t.toFixed(1)}s (zoom ${kf.scale.toFixed(1)}x)`);
  };

  const removeKeyframe = (i: number) => {
    setKeyframes((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Click no preview define o centro do próximo zoom
  const handlePreviewClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    setCurrentCx(cx);
    setCurrentCy(cy);
    toast.info(`Centro do zoom definido. Use "Adicionar keyframe" para fixar.`);
  };

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setBgImageUrl(url);
  };

  // Exportação
  const exportVideo = async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    setIsExporting(true);
    setExportProgress(0);
    v.pause();
    setIsPlaying(false);
    v.currentTime = 0;

    try {
      const canvasStream = c.captureStream(30);
      // Áudio: pega do video element via captureStream se disponível
      const audioStream = (v as any).captureStream
        ? (v as any).captureStream()
        : null;
      if (audioStream) {
        audioStream.getAudioTracks().forEach((t: MediaStreamTrack) => {
          canvasStream.addTrack(t);
        });
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start(500);
      v.muted = false;
      await v.play();

      const onTime = () => {
        if (duration > 0) {
          setExportProgress(Math.min(99, Math.round((v.currentTime / duration) * 100)));
        }
      };
      v.addEventListener("timeupdate", onTime);

      await new Promise<void>((resolve) => {
        const onEnd = () => {
          v.removeEventListener("ended", onEnd);
          resolve();
        };
        v.addEventListener("ended", onEnd);
      });

      v.removeEventListener("timeupdate", onTime);
      recorder.stop();
      const blob = await done;
      setExportProgress(100);
      onApply(blob);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Falha ao exportar o vídeo editado.");
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* Preview */}
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              src={sourceUrl}
              className="hidden"
              playsInline
              crossOrigin="anonymous"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  computeAutoLight();
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            <canvas
              ref={canvasRef}
              onClick={handlePreviewClick}
              className="w-full h-full object-contain cursor-crosshair"
            />
            {(bgLoading || isExporting) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                {isExporting ? (
                  <>
                    <p className="text-sm text-white mb-2">Exportando vídeo editado...</p>
                    <Progress value={exportProgress} className="w-48" />
                    <p className="text-xs text-white/70 mt-1">{exportProgress}%</p>
                  </>
                ) : (
                  <p className="text-sm text-white">Carregando módulo de fundo...</p>
                )}
              </div>
            )}
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={togglePlay} disabled={isExporting}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-xs font-mono text-muted-foreground w-20">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.1}
              onValueChange={([t]) => seek(t)}
              disabled={isExporting}
              className="flex-1"
            />
          </div>
        </div>

        {/* Sidebar de controles */}
        <Tabs defaultValue="image" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="image" className="text-xs">
              <Sun className="h-3 w-3 mr-1" /> Imagem
            </TabsTrigger>
            <TabsTrigger value="bg" className="text-xs">
              <ImageIcon className="h-3 w-3 mr-1" /> Fundo
            </TabsTrigger>
            <TabsTrigger value="zoom" className="text-xs">
              <ZoomIn className="h-3 w-3 mr-1" /> Zoom
            </TabsTrigger>
          </TabsList>

          {/* IMAGEM */}
          <TabsContent value="image" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Correção automática
              </Label>
              <Switch checked={autoLight} onCheckedChange={(v) => { setAutoLight(v); if (v) computeAutoLight(); }} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Brilho: {brightness}%</Label>
              <Slider value={[brightness]} min={50} max={150} step={1} onValueChange={([v]) => setBrightness(v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contraste: {contrast}%</Label>
              <Slider value={[contrast]} min={50} max={150} step={1} onValueChange={([v]) => setContrast(v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saturação: {saturation}%</Label>
              <Slider value={[saturation]} min={0} max={200} step={1} onValueChange={([v]) => setSaturation(v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Temperatura: {temperature > 0 ? `+${temperature} (quente)` : temperature < 0 ? `${temperature} (frio)` : "neutro"}
              </Label>
              <Slider value={[temperature]} min={-50} max={50} step={1} onValueChange={([v]) => setTemperature(v)} />
            </div>
            <div className="space-y-1 pt-2 border-t">
              <Label className="text-xs flex items-center gap-1">
                <Wand2 className="h-3 w-3" /> Suavização de pele: {beauty}%
              </Label>
              <Slider value={[beauty]} min={0} max={100} step={1} onValueChange={([v]) => setBeauty(v)} />
              <p className="text-[10px] text-muted-foreground">Reduz imperfeições com desfoque seletivo.</p>
            </div>
          </TabsContent>

          {/* FUNDO */}
          <TabsContent value="bg" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              {(["original", "blur", "color", "image"] as BgMode[]).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={bgMode === m ? "default" : "outline"}
                  onClick={() => setBgMode(m)}
                  className="text-xs"
                >
                  {m === "original" && "Original"}
                  {m === "blur" && "Desfoque"}
                  {m === "color" && "Cor sólida"}
                  {m === "image" && "Imagem"}
                </Button>
              ))}
            </div>

            {bgMode === "color" && (
              <div className="space-y-1">
                <Label className="text-xs">Cor de fundo</Label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-full rounded border border-border bg-transparent cursor-pointer"
                />
              </div>
            )}

            {bgMode === "image" && (
              <div className="space-y-2">
                <Label className="text-xs">Fundos pré-definidos</Label>
                <div className="grid grid-cols-3 gap-1">
                  {PRESET_BACKGROUNDS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setBgImageUrl(p.url)}
                      className={`relative aspect-video rounded overflow-hidden border-2 transition-all ${
                        bgImageUrl === p.url ? "border-primary" : "border-transparent hover:border-muted-foreground"
                      }`}
                      title={p.label}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <Label className="text-xs">Ou enviar imagem</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                  className="text-xs w-full"
                />
              </div>
            )}

            {bgMode !== "original" && (
              <p className="text-[10px] text-muted-foreground">
                A segmentação roda no seu navegador. Pode reduzir o desempenho durante a edição.
              </p>
            )}
          </TabsContent>

          {/* ZOOM */}
          <TabsContent value="zoom" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={zoomMode === "manual" ? "default" : "outline"}
                onClick={() => setZoomMode("manual")}
                className="text-xs"
              >
                Manual
              </Button>
              <Button
                size="sm"
                variant={zoomMode === "auto" ? "default" : "outline"}
                onClick={() => {
                  setZoomMode("auto");
                  toast.info("Modo automático: zoom acompanha o rosto detectado.");
                }}
                className="text-xs"
              >
                Automático
              </Button>
            </div>

            {zoomMode === "manual" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Nível: {currentScale.toFixed(2)}x</Label>
                  <Slider
                    value={[currentScale]}
                    min={1}
                    max={3}
                    step={0.05}
                    onValueChange={([v]) => {
                      setCurrentScale(v);
                      // adiciona keyframe no ponto atual se nenhum existir
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Clique no preview para definir o centro do zoom, depois adicione um keyframe.
                </p>
                <Button size="sm" onClick={addKeyframe} className="w-full gap-1">
                  <Plus className="h-3 w-3" /> Adicionar keyframe
                </Button>

                {keyframes.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    <Label className="text-xs">Keyframes</Label>
                    {[...keyframes]
                      .map((k, i) => ({ ...k, _i: i }))
                      .sort((a, b) => a.t - b.t)
                      .map((k) => (
                        <div
                          key={k._i}
                          className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1"
                        >
                          <button
                            onClick={() => seek(k.t)}
                            className="flex-1 text-left hover:text-primary"
                          >
                            {k.t.toFixed(1)}s — {k.scale.toFixed(1)}x
                          </button>
                          <button
                            onClick={() => removeKeyframe(k._i)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}

            {zoomMode === "auto" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Status do rosto</Label>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      faceDetected
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {faceDetected ? "● Rastreando rosto" : "○ Procurando rosto..."}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Intensidade do zoom: {autoZoomIntensity}%</Label>
                  <Slider
                    value={[autoZoomIntensity]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => setAutoZoomIntensity(v)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    0% = sem zoom · 100% = aproximação máxima (até 2,5x).
                  </p>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t">
                  <p>• O detector encontra seu rosto a cada frame e ajusta centro + nível de zoom em tempo real.</p>
                  <p>• Quando o rosto sai do quadro, o enquadramento volta suavemente ao normal.</p>
                  <p>• Reproduza o vídeo para ver o rastreamento em ação. Os ajustes serão aplicados na exportação.</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Ações finais */}
      <div className="flex gap-2 flex-wrap pt-2 border-t">
        <Button size="sm" onClick={exportVideo} disabled={isExporting} className="gap-1">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Exportando {exportProgress}%
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Aplicar e salvar
            </>
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isExporting}>
          <X className="h-4 w-4 mr-1" /> Cancelar edição
        </Button>
      </div>
    </div>
  );
};

export default VideoPostEditor;