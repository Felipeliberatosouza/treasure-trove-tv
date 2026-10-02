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
      const mouthW = mw * S * 0.95 * sx;
      const hw = mouthW / 2;
      const chinH = chin * S;
      const drop = open * chinH * 0.22;
      const jawHalf = hw * 2.4;
      const jawH = chinH * 1.3;
      // Quanto cada faixa vertical do queixo desce: total no centro da boca,
      // diminuindo suavemente até as bochechas (sem emendas visíveis).
      const dropAt = (x: number) => {
        const u = Math.abs(x) / jawHalf;
        if (u >= 1) return 0;
        const k = Math.cos((u * Math.PI) / 2);
        return drop * k * k;
      };

      // Interior da boca em formato de lente entre os cantos dos lábios.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.quadraticCurveTo(0, -drop * 0.08, hw, 0);
      ctx.quadraticCurveTo(0, dropAt(0) * 2.1, -hw, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, drop);
      g.addColorStop(0, "#24100f");
      g.addColorStop(0.6, "#1a0608");
      g.addColorStop(1, "#33171a");
      ctx.fillStyle = g;
      ctx.fill();
      if (open > 0.35) {
        ctx.save();
        ctx.clip();
        const tg = ctx.createLinearGradient(0, 0, 0, drop * 0.3);
        tg.addColorStop(0, "rgba(232,226,214,0.85)");
        tg.addColorStop(1, "rgba(200,190,178,0)");
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.ellipse(0, 0, hw * 0.55, drop * 0.3, 0, 0, Math.PI);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Queixo real deslocado em faixas finas, acompanhando a abertura.
      jctx.setTransform(1, 0, 0, 1, 0, 0);
      jctx.globalCompositeOperation = "source-over";
      jctx.clearRect(0, 0, S, S);
      jctx.translate(cx, cy);
      jctx.rotate(ang);
      const strip = Math.max(2, S / 160);
      for (let x = -jawHalf; x < jawHalf; x += strip) {
        const d = dropAt(x + strip / 2);
        jctx.save();
        jctx.beginPath();
        jctx.rect(x, d, strip + 0.6, jawH);
        jctx.clip();
        jctx.translate(0, d);
        jctx.rotate(-ang);
        jctx.drawImage(video, -cx, -cy, S, S);
        jctx.restore();
      }
      // Suaviza a parte de baixo (pescoço) para não marcar emenda.
      jctx.globalCompositeOperation = "destination-in";
      const m = jctx.createLinearGradient(0, 0, 0, jawH);
      m.addColorStop(0, "rgba(0,0,0,1)");
      m.addColorStop(0.7, "rgba(0,0,0,1)");
      m.addColorStop(1, "rgba(0,0,0,0)");
      jctx.fillStyle = m;
      jctx.fillRect(-jawHalf, 0, jawHalf * 2, jawH);
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
