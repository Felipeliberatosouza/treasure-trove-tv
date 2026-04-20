// Generates a default cover image (thumbnail or carousel) on the client using <canvas>.
// Returns a File ready to be uploaded to Supabase Storage.

interface GenerateCoverOptions {
  title: string;
  teacherName: string;
  date?: Date;
  width: number;
  height: number;
  /** "thumbnail" (16:9 vertical title) or "carousel" (wider banner) */
  variant?: "thumbnail" | "carousel";
}

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // Ellipsis on last line if title was truncated
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
};

export const generateDefaultCover = async ({
  title,
  teacherName,
  date = new Date(),
  width,
  height,
  variant = "thumbnail",
}: GenerateCoverOptions): Promise<File> => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context indisponível");

  // Read CSS HSL theme variables for brand consistency
  const root = getComputedStyle(document.documentElement);
  const primary = root.getPropertyValue("--primary").trim() || "0 84% 60%";
  const background = root.getPropertyValue("--background").trim() || "0 0% 4%";

  // Background gradient using brand colors
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${background})`);
  gradient.addColorStop(1, `hsl(${primary} / 0.85)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle diagonal accent
  ctx.fillStyle = `hsl(${primary} / 0.18)`;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  ctx.lineTo(width, height * 0.45);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Brand stamp top-left
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 ${Math.round(height * 0.035)}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText("Revisão Fácil", width * 0.05, height * 0.06);

  // Title
  const titleSize = variant === "carousel" ? Math.round(height * 0.12) : Math.round(height * 0.085);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${titleSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  const maxTitleWidth = width * 0.9;
  const titleLines = wrapText(ctx, title || "Aula sem título", maxTitleWidth, 3);
  const titleStartY = height * (variant === "carousel" ? 0.4 : 0.45);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, width * 0.05, titleStartY + i * titleSize * 1.1);
  });
  ctx.shadowBlur = 0;

  // Footer: teacher + date
  const footerSize = Math.round(height * 0.04);
  ctx.font = `500 ${footerSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const footerY = height * 0.92;
  ctx.fillText(`Prof. ${teacherName || "Revisão Fácil"}`, width * 0.05, footerY);
  const dateText = dateStr;
  const dateWidth = ctx.measureText(dateText).width;
  ctx.fillText(dateText, width * 0.95 - dateWidth, footerY);

  // To Blob -> File
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/jpeg", 0.88),
  );
  return new File([blob], `capa-${variant}-${Date.now()}.jpg`, { type: "image/jpeg" });
};
