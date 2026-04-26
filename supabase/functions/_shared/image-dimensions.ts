// Lê dimensões intrínsecas (width/height) de uma imagem remota a partir
// dos primeiros bytes do arquivo. Suporta PNG e JPEG (formatos usados pela
// plataforma). Não decodifica a imagem inteira — só faz parse de cabeçalho.
//
// Uso típico (edge functions):
//   const dims = await fetchImageDimensions(logoUrl).catch(() => null);
//   buildEmailLogoHtml({ ..., logoNaturalWidth: dims?.width, logoNaturalHeight: dims?.height });

export interface ImageDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function parsePngDimensions(bytes: Uint8Array): ImageDimensions | null {
  // PNG: signature(8) + IHDR length(4) + "IHDR"(4) + width(4) + height(4)
  if (bytes.length < 24) return null;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false); // big-endian
  const height = view.getUint32(20, false);
  if (!width || !height) return null;
  return { width, height };
}

function parseJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  // JPEG: 0xFF 0xD8 ... segmentos 0xFF Sn [len(2)] [...]
  // Procuramos o SOFn (Start Of Frame): 0xC0..0xC3, 0xC5..0xC7, 0xC9..0xCB, 0xCD..0xCF
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    // Pula marcadores de preenchimento 0xFF 0xFF
    while (i < bytes.length && bytes[i] === 0xff) i++;
    const marker = bytes[i];
    i++;
    // Marcadores sem payload (RST*, SOI, EOI, TEM)
    if (
      (marker >= 0xd0 && marker <= 0xd9) ||
      marker === 0x01
    ) {
      continue;
    }
    if (i + 1 >= bytes.length) return null;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
    // SOFn: contém [precision(1)][height(2)][width(2)]...
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (i + 7 >= bytes.length) return null;
      const height = (bytes[i + 3] << 8) | bytes[i + 4];
      const width = (bytes[i + 5] << 8) | bytes[i + 6];
      if (!width || !height) return null;
      return { width, height };
    }
    i += segLen;
  }
  return null;
}

/** Tenta extrair (width, height) dos primeiros bytes de uma imagem. */
export function parseImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return parsePngDimensions(bytes) || parseJpegDimensions(bytes);
}

/**
 * Faz fetch dos primeiros 64KB de uma imagem e retorna as dimensões.
 * Retorna null em qualquer falha (não lança) para nunca quebrar o fluxo de
 * envio de e-mail por causa de um problema de assets.
 */
export async function fetchImageDimensions(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<ImageDimensions | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, {
      // Pega só o suficiente para o cabeçalho. CDNs podem ignorar Range e
      // devolver o arquivo inteiro — está ok, ainda lemos só o início.
      headers: { Range: "bytes=0-65535" },
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return parseImageDimensions(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}