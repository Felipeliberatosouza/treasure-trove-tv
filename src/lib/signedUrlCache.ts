// In-memory cache de URLs assinadas para vídeos.
// Reduz o TTFB do play: ao passar o mouse em um card ou ao card entrar
// na viewport, geramos a URL assinada antecipadamente e guardamos aqui.
// A página VideoPage consulta o cache antes de gerar a URL novamente.

import { supabase } from "@/integrations/supabase/client";

type Entry = { url: string; expiresAt: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

const SIGNED_TTL_SECONDS = 60 * 60; // 1h — mesmo TTL usado em VideoPage
const SAFETY_WINDOW_MS = 60 * 1000; // expira 1 min antes para evitar borda

function extractStoragePath(stored: string): string {
  const marker = "/videos/";
  const idx = stored.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(stored.slice(idx + marker.length).split("?")[0]);
  }
  return stored.replace(/^\/+/, "");
}

export async function getSignedVideoUrl(storedVideoUrl: string): Promise<string | null> {
  if (!storedVideoUrl) return null;

  const key = storedVideoUrl;
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt - SAFETY_WINDOW_MS > now) {
    return cached.url;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const path = extractStoragePath(storedVideoUrl);
  if (!path) return /^https?:\/\//.test(storedVideoUrl) ? storedVideoUrl : null;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(path, SIGNED_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        return /^https?:\/\//.test(storedVideoUrl) ? storedVideoUrl : null;
      }
      cache.set(key, {
        url: data.signedUrl,
        expiresAt: now + SIGNED_TTL_SECONDS * 1000,
      });
      return data.signedUrl;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

// Pré-busca a partir de um lessonId/examId: consulta o video_url em ambas as
// tabelas (sem privilegios extras — depende das RLS atuais) e popula o cache.
const lessonLookupInflight = new Map<string, Promise<void>>();

export function prefetchSignedUrlForContent(contentId: string): void {
  if (!contentId || lessonLookupInflight.has(contentId)) return;

  const promise = (async () => {
    try {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("video_url")
        .eq("id", contentId)
        .maybeSingle();
      if (lesson?.video_url) {
        await getSignedVideoUrl(lesson.video_url);
        return;
      }
      const { data: exam } = await supabase
        .from("exam_solutions")
        .select("video_url")
        .eq("id", contentId)
        .maybeSingle();
      if (exam?.video_url) {
        await getSignedVideoUrl(exam.video_url);
      }
    } catch {
      /* prefetch silencioso */
    } finally {
      lessonLookupInflight.delete(contentId);
    }
  })();

  lessonLookupInflight.set(contentId, promise);
}