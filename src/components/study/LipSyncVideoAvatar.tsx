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
  /** Frase sendo dita agora (legenda) — define sorriso e ênfase. */
  phrase?: string;
}

const FRIENDLY = /\b(ol[áa]|oi|bem[- ]vind|vamos|juntos|[óo]tim|parab[ée]ns|legal|incr[íi]vel|f[áa]cil|sucesso|show|bacana|lindo|maravilh|divert|gost|ador|feliz|conseg|bora|voc[êe] vai|tranquil|simples|obrigad|at[ée] a pr[óo]xima|boa)/i;
const EMPHASIS = /\b(importante|aten[çc][ãa]o|cuidado|nunca|sempre|principal|essencial|lembre|repare|veja|observe)/i;

/** 0..1: quanto a frase pede simpatia (sorriso). */
export const phraseMood = (text = "") => {
  if (!text) return 0.15;
  let m = 0.1;
  if (FRIENDLY.test(text)) m += 0.6;
  if (/!/.test(text)) m += 0.25;
  if (/\?/.test(text)) m += 0.1;
  if (EMPHASIS.test(text)) m -= 0.2;
  return Math.max(0, Math.min(1, m));
};

/**
 * Pessoa real em vídeo com a boca articulada pela fala da ElevenLabs.
 * O vídeo base foi gravado com a boca fechada (respiração, piscadas e gestos
 * naturais). A cada quadro, a posição da boca vem do mapa pré-calculado e o
 * queixo real é deslocado conforme o visema, revelando o interior da boca.
 */
const LipSyncVideoAvatar = ({ url, trackKey, alt, speaking, viseme, phrase }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<{ open: number; sx: number }>({ open: 0, sx: 1 });
  const speakingRef = useRef(speaking);
  const moodRef = useRef({ smile: 0.15, emphasis: false });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    moodRef.current = { smile: phraseMood(phrase), emphasis: EMPHASIS.test(phrase || "") };
  }, [phrase]);

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
    let smile = 0;
    let nod = 0;
    let tilt = 0;
    let prevOpen = 0;
    const corner = document.createElement("canvas");
    const cctx = corner.getContext("2d");

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (video.readyState < 2) return;
      const S = video.videoWidth || 512;
      if (canvas.width !== S) {
        canvas.width = canvas.height = S;
        jaw.width = jaw.height = S;
        corner.width = corner.height = S;
      }
      const t = targetRef.current;
      // Suaviza a transição entre sílabas (abre rápido, fecha um pouco mais devagar).
      open += (t.open - open) * (t.open > open ? 0.45 : 0.3);
      sx += (t.sx - sx) * 0.35;

      // Expressão: sorriso quando a frase pede simpatia; leve sorriso nas pausas.
      const mood = moodRef.current;
      const smileTarget = speakingRef.current ? mood.smile * (1 - Math.min(1, open * 1.4)) : 0.35;
      smile += (smileTarget - smile) * 0.06;
      // Cabeça acompanha a fala: aceno no início das sílabas fortes, inclinação no sorriso.
      const onset = Math.max(0, open - prevOpen);
      prevOpen = open;
      nod += (onset * (mood.emphasis ? 9 : 5) - nod) * 0.25;
      tilt += ((smile - 0.2) * 2.2 - tilt) * 0.04;
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translateY(${(nod * 1.6).toFixed(2)}%) rotate(${tilt.toFixed(2)}deg) scale(${(1.05 + nod * 0.01).toFixed(4)})`;
      }
      // Ritmo dos gestos do vídeo base acompanha a energia da fala.
      const rate = speakingRef.current ? 0.85 + Math.min(0.3, open * 0.5) : 0.7;
      if (Math.abs(video.playbackRate - rate) > 0.04) video.playbackRate = rate;

      ctx.drawImage(video, 0, 0, S, S);

      const idx = Math.floor(video.currentTime * track.fps) % track.frames.length;
      const [mx, my, mw, chin, ang] = track.frames[idx];
      const cx = mx * S;
      const cy0 = my * S;

      // Sorriso: levanta e afasta os cantos da boca com bordas difusas.
      if (smile > 0.03 && cctx) {
        const lift = smile * mw * S * 0.09;
        const r = mw * S * 0.42;
        for (const side of [-1, 1]) {
          const px = cx + side * mw * S * 0.5 * Math.cos(ang);
          const py = cy0 + side * mw * S * 0.5 * Math.sin(ang);
          cctx.setTransform(1, 0, 0, 1, 0, 0);
          cctx.globalCompositeOperation = "source-over";
          cctx.clearRect(0, 0, S, S);
          cctx.drawImage(video, side * lift * 0.35, -lift, S, S);
          cctx.globalCompositeOperation = "destination-in";
          const rg = cctx.createRadialGradient(px, py, 0, px, py, r);
          rg.addColorStop(0, "rgba(0,0,0,1)");
          rg.addColorStop(0.45, "rgba(0,0,0,0.75)");
          rg.addColorStop(1, "rgba(0,0,0,0)");
          cctx.fillStyle = rg;
          cctx.fillRect(px - r, py - r, r * 2, r * 2);
          ctx.drawImage(corner, 0, 0);
        }
      }

      // Lábios fechados: nada de risco escuro entre eles.
      if (open < 0.07) return;
      const vis = Math.min(1, (open - 0.07) / 0.12);
      // A linha entre os lábios fica praticamente na altura dos cantos.
      const cy = cy0 + mw * S * 0.025;
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
      ctx.globalAlpha = vis;
      ctx.filter = `blur(${Math.max(0.8, S / 400).toFixed(1)}px)`;
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
        ctx.filter = "none";
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
      m.addColorStop(0, "rgba(0,0,0,0.35)");
      m.addColorStop(0.06, "rgba(0,0,0,1)");
      m.addColorStop(0.7, "rgba(0,0,0,1)");
      m.addColorStop(1, "rgba(0,0,0,0)");
      jctx.fillStyle = m;
      jctx.fillRect(-jawHalf, 0, jawHalf * 2, jawH);
      ctx.save();
      ctx.globalAlpha = Math.max(0.4, vis);
      ctx.drawImage(jaw, 0, 0);
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    video.play().catch(() => {});
    return () => cancelAnimationFrame(raf);
  }, [trackKey, url]);

  return (
    <div className={`photo-rig ${speaking ? "is-speaking" : ""}`} role="img" aria-label={alt}>
      <video ref={videoRef} src={url} muted loop playsInline autoPlay preload="auto" aria-hidden="true" className="opacity-0" />
      <div ref={wrapRef} className="absolute inset-0 origin-[50%_85%] will-change-transform">
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
      </div>
    </div>
  );
};

export default LipSyncVideoAvatar;
