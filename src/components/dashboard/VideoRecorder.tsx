import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Video, Square, RotateCcw, Check, X, Camera } from "lucide-react";

interface VideoRecorderProps {
  maxMinutes: number;
  onRecorded: (file: File) => void;
  onCancel: () => void;
}

type RecorderState = "idle" | "countdown" | "recording" | "preview";

const VideoRecorder = ({ maxMinutes, onRecorded, onCancel }: VideoRecorderProps) => {
  const [state, setState] = useState<RecorderState>("idle");
  const [countdown, setCountdown] = useState(5);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxSeconds = maxMinutes * 60;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
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
      setState("idle");
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
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
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setState("preview");
      stopStream();
      if (previewRef.current) {
        previewRef.current.src = URL.createObjectURL(blob);
      }
    };

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
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const reRecord = async () => {
    setRecordedBlob(null);
    setElapsed(0);
    setState("idle");
    await startCamera();
  };

  const approve = () => {
    if (!recordedBlob) return;
    const file = new File([recordedBlob], `gravacao-${Date.now()}.webm`, { type: recordedBlob.type });
    onRecorded(file);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const remaining = maxSeconds - elapsed;

  // Init camera on mount
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
        {/* Live camera feed */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${state === "preview" ? "hidden" : ""}`}
          playsInline
          muted
        />

        {/* Preview of recorded video */}
        <video
          ref={previewRef}
          className={`w-full h-full object-cover ${state !== "preview" ? "hidden" : ""}`}
          playsInline
          controls
        />

        {/* Countdown overlay */}
        {state === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <span className="text-7xl font-bold text-white animate-pulse">{countdown}</span>
          </div>
        )}

        {/* Recording indicator + remaining time */}
        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-mono text-white bg-black/60 px-2 py-0.5 rounded">
              GRAVANDO
            </span>
          </div>
        )}

        {/* Countdown timer (remaining) - visible to teacher only */}
        {state === "recording" && (
          <div className="absolute top-3 right-3 z-10">
            <span className={`text-sm font-mono px-2 py-0.5 rounded ${
              remaining <= 60 ? "bg-destructive/80 text-white" : "bg-black/60 text-white"
            }`}>
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
          <Button size="sm" variant="secondary" onClick={() => {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setState("idle");
          }}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
        )}

        {state === "recording" && (
          <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-1">
            <Square className="h-4 w-4" /> Parar Gravação
          </Button>
        )}

        {state === "preview" && (
          <>
            <Button size="sm" onClick={approve} className="gap-1">
              <Check className="h-4 w-4" /> Aprovar Vídeo
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

      <p className="text-xs text-muted-foreground">
        Tempo máximo de gravação: {maxMinutes} minuto{maxMinutes > 1 ? "s" : ""}
      </p>
    </div>
  );
};

export default VideoRecorder;
