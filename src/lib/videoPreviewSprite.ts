// Gerador de sprite de pré-visualização (estilo YouTube/Netflix) executado
// no navegador no momento do upload. Recebe o arquivo de vídeo original,
// extrai N frames usando <video> + <canvas>, monta um único sprite JPEG e
// um arquivo WebVTT que referencia cada thumb via fragmento `#xywh=`.
//
// Vantagens vs. fazer no servidor:
//  - sem dependência de ffmpeg no edge runtime
//  - usa o arquivo que o professor já tem em memória (sem re-download)
//  - não bloqueia o UI: o submit do form completa antes; este passo roda
//    em background e atualiza a linha no banco quando termina.

import { supabase } from "@/integrations/supabase/client";

const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const COLUMNS = 8;
const TARGET_FRAMES = 40; // limite superior; intervalo derivado da duração
const MIN_INTERVAL_SEC = 2;
const JPEG_QUALITY = 0.7;

function formatVttTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const sFixed = s.toFixed(3).padStart(6, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sFixed}`;
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.1));
  });
}

function loadMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
      resolve();
      return;
    }
    const onLoaded = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error("invalid duration"));
      } else {
        resolve();
      }
    };
    const onError = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      reject(new Error("metadata load failed"));
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
}

export interface PreviewSpriteResult {
  spriteUrl: string;
  vttUrl: string;
}

/**
 * Gera o sprite e o VTT a partir do `File` original do vídeo e faz upload
 * para o bucket `thumbnails` sob o prefixo `previews/{contentId}/`.
 * Atualiza a linha indicada (`table` em {"lessons","exam_solutions"}) com
 * `preview_sprite_url`, `preview_vtt_url` e `preview_status`.
 */
export async function generateAndUploadPreviewSprite(params: {
  videoFile: File;
  contentId: string;
  table: "lessons" | "exam_solutions";
}): Promise<PreviewSpriteResult | null> {
  const { videoFile, contentId, table } = params;

  const objectUrl = URL.createObjectURL(videoFile);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = objectUrl;

  try {
    await loadMetadata(video);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration < 1) {
      throw new Error("video too short");
    }

    const interval = Math.max(MIN_INTERVAL_SEC, duration / TARGET_FRAMES);
    const frameCount = Math.min(TARGET_FRAMES, Math.max(1, Math.floor(duration / interval)));
    const rows = Math.ceil(frameCount / COLUMNS);

    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH * COLUMNS;
    canvas.height = THUMB_HEIGHT * rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");

    const cues: { start: number; end: number; col: number; row: number }[] = [];

    for (let i = 0; i < frameCount; i++) {
      const t = Math.min(duration - 0.05, i * interval + interval / 2);
      await seekTo(video, t);
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      ctx.drawImage(video, col * THUMB_WIDTH, row * THUMB_HEIGHT, THUMB_WIDTH, THUMB_HEIGHT);
      const cueStart = i * interval;
      const cueEnd = i === frameCount - 1 ? duration : (i + 1) * interval;
      cues.push({ start: cueStart, end: cueEnd, col, row });
    }

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });

    const folder = `previews/${contentId}`;
    const spritePath = `${folder}/sprite.jpg`;
    const vttPath = `${folder}/thumbs.vtt`;

    const { error: spriteErr } = await supabase.storage
      .from("thumbnails")
      .upload(spritePath, blob, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
    if (spriteErr) throw spriteErr;

    const spriteUrl = supabase.storage.from("thumbnails").getPublicUrl(spritePath).data.publicUrl;

    // Monta WebVTT
    const vttLines: string[] = ["WEBVTT", ""];
    cues.forEach((cue) => {
      vttLines.push(`${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}`);
      vttLines.push(
        `${spriteUrl}#xywh=${cue.col * THUMB_WIDTH},${cue.row * THUMB_HEIGHT},${THUMB_WIDTH},${THUMB_HEIGHT}`,
      );
      vttLines.push("");
    });
    const vttBlob = new Blob([vttLines.join("\n")], { type: "text/vtt" });

    const { error: vttErr } = await supabase.storage
      .from("thumbnails")
      .upload(vttPath, vttBlob, {
        upsert: true,
        contentType: "text/vtt",
        cacheControl: "31536000",
      });
    if (vttErr) throw vttErr;

    const vttUrl = supabase.storage.from("thumbnails").getPublicUrl(vttPath).data.publicUrl;

    await (supabase as any)
      .from(table)
      .update({
        preview_sprite_url: spriteUrl,
        preview_vtt_url: vttUrl,
        preview_status: "ready",
      })
      .eq("id", contentId);

    return { spriteUrl, vttUrl };
  } catch (err) {
    console.warn("[preview-sprite] falha ao gerar:", err);
    try {
      await (supabase as any)
        .from(table)
        .update({ preview_status: "failed" })
        .eq("id", contentId);
    } catch {
      /* ignore */
    }
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

// Parser leve de WebVTT no formato gerado acima.
// Retorna a lista de cues e o URL base do sprite (sem o fragment).
export interface ThumbCue {
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParsedThumbVtt {
  spriteUrl: string;
  cues: ThumbCue[];
}

function parseVttTime(s: string): number {
  // hh:mm:ss.mmm OR mm:ss.mmm
  const parts = s.trim().split(":");
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

export async function fetchAndParseThumbVtt(vttUrl: string): Promise<ParsedThumbVtt | null> {
  try {
    const res = await fetch(vttUrl, { cache: "force-cache" });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    const cues: ThumbCue[] = [];
    let spriteUrl = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const arrowMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})/);
      if (!arrowMatch) continue;
      const start = parseVttTime(arrowMatch[1]);
      const end = parseVttTime(arrowMatch[2]);
      const payload = (lines[i + 1] || "").trim();
      const xywh = payload.match(/#xywh=(\d+),(\d+),(\d+),(\d+)/);
      if (!xywh) continue;
      if (!spriteUrl) spriteUrl = payload.split("#")[0];
      cues.push({
        start,
        end,
        x: parseInt(xywh[1], 10),
        y: parseInt(xywh[2], 10),
        w: parseInt(xywh[3], 10),
        h: parseInt(xywh[4], 10),
      });
    }

    if (!spriteUrl || cues.length === 0) return null;
    return { spriteUrl, cues };
  } catch {
    return null;
  }
}