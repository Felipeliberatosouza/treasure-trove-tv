import { useRef, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ForensicWatermark from "@/components/ForensicWatermark";
import { useContentProtection } from "@/hooks/useContentProtection";

interface VideoPlayerProps {
  videoUrl: string;
  contentId: string;
  contentType?: string;
  viewId: string | null;
  onProgressMilestone?: (percentage: number) => void;
  poster?: string;
  previewLimit?: number;
  onPreviewLimitReached?: () => void;
  logoUrl?: string;
  subtitlesVttUrl?: string;
}

const VideoPlayer = ({
  videoUrl,
  contentId,
  contentType = "lesson",
  viewId,
  onProgressMilestone,
  poster,
  previewLimit,
  onPreviewLimitReached,
  logoUrl,
  subtitlesVttUrl,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  // Protege a sessão enquanto o player está montado (atalhos, copy, devtools, prints).
  useContentProtection({ context: `video:${contentType}:${contentId}` });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [maxPercentage, setMaxPercentage] = useState(0);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedPercentage = useRef(0);

  const saveProgress = useCallback(
    async (pct: number) => {
      if (!user || !viewId || pct <= lastSavedPercentage.current) return;
      lastSavedPercentage.current = pct;
      await supabase
        .from("video_views")
        .update({ watch_percentage: pct })
        .eq("id", viewId);
    },
    [user, viewId]
  );

  useEffect(() => {
    const roundedPct = Math.floor(percentage);
    if (roundedPct > maxPercentage) {
      setMaxPercentage(roundedPct);
      if (roundedPct % 5 === 0 || roundedPct === 70 || roundedPct === 100) {
        saveProgress(roundedPct);
      }
      if (roundedPct >= 70) {
        onProgressMilestone?.(roundedPct);
      }
    }
  }, [percentage, maxPercentage, saveProgress, onProgressMilestone]);

  useEffect(() => {
    return () => {
      if (maxPercentage > lastSavedPercentage.current) {
        saveProgress(maxPercentage);
      }
    };
  }, [maxPercentage, saveProgress]);

  // Manage subtitle track visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = subtitlesEnabled ? "showing" : "hidden";
    }
  }, [subtitlesEnabled, subtitlesVttUrl]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    setCurrentTime(video.currentTime);
    setPercentage(pct);

    if (previewLimit && pct >= previewLimit) {
      video.pause();
      video.currentTime = (previewLimit / 100) * video.duration;
      setIsPlaying(false);
      onPreviewLimitReached?.();
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * duration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play();
    setIsPlaying(true);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        className="h-full w-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          saveProgress(100);
          onProgressMilestone?.(100);
        }}
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        crossOrigin="anonymous"
      >
        {/* Subtitle track */}
        {subtitlesVttUrl && (
          <track
            kind="subtitles"
            src={subtitlesVttUrl}
            srcLang="pt-BR"
            label="Português"
            default
          />
        )}
      </video>

      {/* Marca d'água forense — sobre o vídeo, baixa opacidade, identifica o usuário */}
      <ForensicWatermark variant="video" />

      {/* Big play overlay when paused */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/30 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="rounded-full bg-primary p-4 transition-transform hover:scale-110">
            <Play className="h-8 w-8 text-primary-foreground" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Seek bar */}
        <div
          className="relative mb-2 h-1.5 w-full cursor-pointer rounded-full bg-muted-foreground/30 group/seek"
          onClick={handleSeek}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-md transition-all"
            style={{ left: `${percentage}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={restart}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={toggleMute}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            {subtitlesVttUrl && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 hover:bg-white/20 ${
                  subtitlesEnabled ? "text-primary" : "text-white/50"
                }`}
                onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                title={subtitlesEnabled ? "Desativar legendas" : "Ativar legendas"}
              >
                <Subtitles className="h-4 w-4" />
              </Button>
            )}
            <span className="ml-1 text-xs text-white/80 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-white/80 font-semibold mr-1">{Math.floor(percentage)}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Logo watermark */}
      {logoUrl && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <img src={logoUrl} alt="Logo" className="h-6 sm:h-8 w-auto opacity-60" />
        </div>
      )}

      {/* Progress milestone indicator */}
      {maxPercentage >= 70 && (
        <div className="absolute top-2 right-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          ✓ 70% assistido
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
