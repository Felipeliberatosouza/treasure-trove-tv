import { useEffect, useRef } from "react";
import { VISEME_SHAPE, type Viseme } from "@/utils/phonemeLipSync";
import { MOUTH_TRACKS } from "./avatarMouthTracks";

interface Props {
  url: string;
  /** Chave do mapa da boca (ana, bia, helena, lucas, tiago, rafael). */
  trackKey: string;
  alt: string;
  speaking: boolean;
  viseme?: Viseme | null;
}

/**
 * Pessoa real em vídeo com a boca articulada pela fala da ElevenLabs.
 * O vídeo base foi gravado com a boca fechada (respiração, piscadas e gestos
 * naturais). A cada quadro, a posição da boca vem do mapa pré-calculado e o
 * queixo real é deslocado conforme o visema, revelando o interior da boca.
 */
const LipSyncVideoAvatar = ({ url, trackKey, alt, speaking, viseme }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<{ open: number; sx: number }>({ open: 0, sx: 1 });
  const speakingRef = useRef(speaking);

  useEffect(() => {
    speakingRef.current = speaking;
    const shape = speaking && viseme ? VISEME_SHAPE[viseme] : VISEME_SHAPE.rest;
    targetRef.current = { open: shape.open, sx: shape.sx };
  }, [speaking, viseme]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const track = MOUTH_TRACKS[trackKey];
    if (!video || !canvas || !track) return;
    const ctx = canvas.getContext("2d");
    const jaw = document.createElement("canvas");
    const jctx = jaw.getContext("2d");
    if (!ctx || !jctx) return;

    let raf = 0;
    let open = 0;
    let sx = 1;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (video.readyState < 2) return;
      const S = video.videoWidth || 512;
      if (canvas.width !== S) {
        canvas.width = canvas.height = S;
        jaw.width = jaw.height = S;
      }
      const t = targetRef.current;
      // Suaviza a transição entre sílabas (abre rápido, fecha um pouco mais devagar).
      open += (t.open - open) * (t.open > open ? 0.45 : 0.3);
      sx += (t.sx - sx) * 0.35;

      ctx.drawImage(video, 0, 0, S, S);
      if (open < 0.02) return;

      const idx = Math.floor(video.currentTime * track.fps) % track.frames.length;
      const [mx, my, mw, chin, ang] = track.frames[idx];
      const cx = mx * S;
      // O mapa marca os cantos da boca; a linha entre os lábios fica um pouco abaixo.
      const cy = my * S + mw * S * 0.07;
      const mouthW = mw * S * 1.1 * sx;
      const chinH = chin * S;
      const drop = open * chinH * 0.3;
      const jawW = mouthW * 2.6;
      const jawH = chinH * 1.25;

      // Interior da boca.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, 0, drop);
      g.addColorStop(0, "#3a1418");
      g.addColorStop(1, "#140507");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, drop / 2, mouthW / 2, drop / 2 + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      if (open > 0.3) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = "rgba(240,236,228,0.92)";
        ctx.fillRect(-mouthW * 0.32, -1, mouthW * 0.64, Math.min(drop * 0.28, S * 0.012) + 1);
        ctx.restore();
      }
      ctx.restore();

      // Queixo real deslocado para baixo, com bordas suavizadas.
      jctx.setTransform(1, 0, 0, 1, 0, 0);
      jctx.globalCompositeOperation = "source-over";
      jctx.clearRect(0, 0, S, S);
      jctx.translate(cx, cy);
      jctx.rotate(ang);
      jctx.save();
      jctx.translate(0, drop);
      jctx.beginPath();
      jctx.rect(-jawW, 0, jawW * 2, jawH * 2);
      jctx.clip();
      jctx.rotate(-ang);
      jctx.drawImage(video, -cx, -cy, S, S);
      jctx.restore();
      jctx.globalCompositeOperation = "destination-in";
      jctx.save();
      jctx.translate(0, drop);
      jctx.scale(jawW / 2, jawH);
      const m = jctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      m.addColorStop(0, "rgba(0,0,0,1)");
      m.addColorStop(0.6, "rgba(0,0,0,1)");
      m.addColorStop(1, "rgba(0,0,0,0)");
      jctx.fillStyle = m;
      jctx.fillRect(-1, -1, 2, 2);
      jctx.restore();
      ctx.drawImage(jaw, 0, 0);
    };
    raf = requestAnimationFrame(draw);
    video.play().catch(() => {});
    return () => cancelAnimationFrame(raf);
  }, [trackKey, url]);

  return (
    <div className={`photo-rig ${speaking ? "is-speaking" : ""}`} role="img" aria-label={alt}>
      <video ref={videoRef} src={url} muted loop playsInline autoPlay preload="auto" aria-hidden="true" className="opacity-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
};

export default LipSyncVideoAvatar;
