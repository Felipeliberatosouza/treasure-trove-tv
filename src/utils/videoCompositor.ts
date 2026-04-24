/**
 * Video Compositor - Embeds blackboard overlay with impact words
 * and optional intro cover into recorded video using Canvas API.
 */

export interface ImpactWord {
  word: string;
  timestamp: number;
  duration: number;
}

export interface CompositeOptions {
  impactWords: ImpactWord[];
  introTitle?: string;
  introArea?: string;
  introTeacher?: string;
  logoUrl?: string;
  introDurationSec?: number;
  /** Texto da marca d'água persistente (ex: nome da plataforma). */
  watermarkText?: string;
  /** URL pública opcional de uma logomarca PNG/JPG para exibir junto/no lugar do texto. */
  watermarkLogoUrl?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Composites a video blob with blackboard overlay and optional intro.
 * Uses Canvas + MediaRecorder to re-encode the video.
 * Processing happens at real-time speed.
 */
export async function compositeVideo(
  videoBlob: Blob,
  options: CompositeOptions
): Promise<Blob> {
  const {
    impactWords,
    introTitle,
    introArea,
    introTeacher,
    introDurationSec = 4,
    watermarkText,
    watermarkLogoUrl,
    onProgress,
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(videoBlob);
    video.muted = false;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";

    video.onloadedmetadata = async () => {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const videoDuration = video.duration;
      const totalDuration = videoDuration + (introTitle ? introDurationSec : 0);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      // Pré-carregar logomarca da plataforma (se houver) para a marca d'água.
      let watermarkImg: HTMLImageElement | null = null;
      if (watermarkLogoUrl) {
        try {
          watermarkImg = await loadImage(watermarkLogoUrl);
        } catch (err) {
          console.warn("[Compositor] Failed to load watermark logo", err);
          watermarkImg = null;
        }
      }

      // Set up audio from original video using Web Audio API
      const AudioCtx =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx!();
      try {
        if (audioCtx.state === "suspended") await audioCtx.resume();
      } catch (err) {
        console.warn("AudioContext resume failed", err);
      }
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      // Do NOT connect to destination to avoid feedback during processing

      // Combine canvas video + original audio
      const canvasStream = canvas.captureStream(30);
      const audioTracks = dest.stream.getAudioTracks();
      console.log("[Compositor] Audio tracks captured:", audioTracks.length);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(video.src);
        audioCtx.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.onerror = (e) => reject(e);
      recorder.start(500);

      // Phase 1: Draw intro cover if enabled
      if (introTitle) {
        await drawIntroCover(ctx, w, h, introTitle, introArea, introTeacher, introDurationSec, onProgress, totalDuration);
      }

      // Phase 2: Play video and draw frames with blackboard overlay
      // IMPORTANT: do not mute the source video here — muting the element
      // also silences the MediaElementSource, removing audio from the output.
      video.volume = 0; // keeps it inaudible to user but audio still flows through Web Audio
      try {
        await video.play();
      } catch (err) {
        console.error("[Compositor] video.play() failed", err);
        reject(err);
        return;
      }

      const introOffset = introTitle ? introDurationSec : 0;

      const drawFrame = () => {
        if (video.ended || video.paused) {
          setTimeout(() => recorder.stop(), 200);
          return;
        }

        // Draw video frame
        ctx.drawImage(video, 0, 0, w, h);

        // Draw blackboard overlay for active impact words
        const currentTime = video.currentTime;
        const activeWords = impactWords.filter(
          (iw) => currentTime >= iw.timestamp && currentTime < iw.timestamp + iw.duration
        );

        if (activeWords.length > 0) {
          drawBlackboard(ctx, w, h, activeWords);
        }

        // Report progress
        const elapsed = introOffset + currentTime;
        onProgress?.(Math.min(99, Math.round((elapsed / totalDuration) * 100)));

        requestAnimationFrame(drawFrame);
      };

      drawFrame();
    };

    video.onerror = () => reject(new Error("Failed to load video for compositing"));
  });
}

function drawBlackboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  activeWords: ImpactWord[]
) {
  const boardH = h * 0.12;
  const boardY = h * 0.06;
  const boardX = w * 0.04;
  const boardW = w * 0.92;
  const radius = 12;

  // Dark green chalkboard background
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(boardX, boardY, boardW, boardH, radius);
  ctx.fillStyle = "rgba(25, 50, 32, 0.88)";
  ctx.fill();

  // Subtle border (chalk tray)
  ctx.strokeStyle = "rgba(180, 160, 120, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Impact word text
  const fontSize = Math.round(h * 0.04);
  ctx.font = `bold ${fontSize}px "Georgia", serif`;
  ctx.fillStyle = "#F5F5DC"; // beige/chalk color
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 4;

  const text = activeWords.map((w) => w.word.toUpperCase()).join("   •   ");
  ctx.fillText(text, w / 2, boardY + boardH / 2, boardW - 40);

  ctx.restore();
}

async function drawIntroCover(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  area?: string,
  teacher?: string,
  durationSec: number = 4,
  onProgress?: (percent: number) => void,
  totalDuration?: number
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const durationMs = durationSec * 1000;

    const draw = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Dark gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(0.5, "#1e293b");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Decorative line
      ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.35);
      ctx.lineTo(w * 0.8, h * 0.35);
      ctx.stroke();

      // Title
      const titleSize = Math.round(w * 0.045);
      ctx.font = `bold ${titleSize}px "Georgia", serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapText(ctx, title, w / 2, h * 0.48, w * 0.7, titleSize * 1.3);

      // Area badge
      if (area) {
        const areaSize = Math.round(w * 0.022);
        ctx.font = `${areaSize}px sans-serif`;
        ctx.fillStyle = "rgba(99, 102, 241, 0.9)";
        const areaText = area.toUpperCase();
        const areaMetrics = ctx.measureText(areaText);
        const badgeX = w / 2 - areaMetrics.width / 2 - 16;
        const badgeY = h * 0.62;

        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, areaMetrics.width + 32, areaSize + 16, 6);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(areaText, w / 2, badgeY + (areaSize + 16) / 2);
      }

      // Teacher name
      if (teacher) {
        const teacherSize = Math.round(w * 0.025);
        ctx.font = `${teacherSize}px sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillText(`Prof. ${teacher}`, w / 2, h * 0.75);
      }

      // Bottom decorative line
      ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.82);
      ctx.lineTo(w * 0.8, h * 0.82);
      ctx.stroke();

      // Fade in effect
      if (progress < 0.15) {
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - progress / 0.15})`;
        ctx.fillRect(0, 0, w, h);
      }
      // Fade out effect
      if (progress > 0.85) {
        ctx.fillStyle = `rgba(0, 0, 0, ${(progress - 0.85) / 0.15})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (totalDuration) {
        onProgress?.(Math.round((elapsed / 1000 / totalDuration) * 100));
      }

      if (elapsed < durationMs) {
        requestAnimationFrame(draw);
      } else {
        resolve();
      }
    };

    draw();
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight, maxWidth);
  });
}
