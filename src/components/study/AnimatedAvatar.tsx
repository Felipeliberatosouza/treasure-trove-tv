import { useEffect, useRef } from "react";
import type { AiAvatarAnimation, AiAvatarSize } from "@/hooks/usePlatformSettings";
import { findCatalogAvatar } from "./avatarCatalog";
import RiggedAvatar from "./RiggedAvatar";
import LipSyncVideoAvatar from "./LipSyncVideoAvatar";
import { VISEME_SHAPE, type Viseme } from "@/utils/phonemeLipSync";

interface AnimatedAvatarProps {
  /** Avatar escolhido na galeria (Configurações → Gestão de IA). */
  avatarId?: string;
  /** Imagem própria, usada apenas quando nenhum avatar da galeria foi escolhido. */
  src: string;
  alt: string;
  /** Verdadeiro enquanto a narração está tocando. */
  speaking: boolean;
  animation?: AiAvatarAnimation;
  size: AiAvatarSize;
  /** Formato da boca sincronizado com a fala (ElevenLabs). */
  viseme?: Viseme | null;
}

const SIZE_CLASS: Record<AiAvatarSize, string> = {
  pequeno: "h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20",
  medio: "h-16 w-16 sm:h-24 sm:w-24 md:h-28 md:w-28",
  grande: "h-24 w-24 sm:h-40 sm:w-40 md:h-48 md:w-48",
};

/**
 * Avatar de pessoa real: o vídeo roda com movimento natural enquanto há fala
 * e pausa nos silêncios (pausas detectadas pelos tempos da ElevenLabs).
 */
const PhotoRigAvatar = ({ url, alt, speaking, viseme }: { url: string; alt: string; speaking: boolean; viseme?: Viseme | null }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const silentSince = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!speaking) {
      el.pause();
      silentSince.current = null;
      return;
    }
    if (viseme === "rest") {
      if (silentSince.current == null) silentSince.current = Date.now();
      const t = window.setTimeout(() => el.pause(), 350);
      return () => window.clearTimeout(t);
    }
    silentSince.current = null;
    if (el.paused) el.play().catch(() => {});
  }, [speaking, viseme]);

  return (
    <div className={`photo-rig ${speaking ? "is-speaking" : ""}`} role="img" aria-label={alt}>
      <div className="photo-rig-body">
        <video ref={ref} src={url} muted loop playsInline preload="auto" aria-hidden="true" />
      </div>
    </div>
  );
};

/**
 * Professor(a) virtual que fala: personagem ilustrado articulado (boca, cabeça,
 * tronco, braços e mãos), pessoa real articulada ou, por compatibilidade, uma foto animada.
 */
const AnimatedAvatar = ({ avatarId, src, alt, speaking, animation = "gestos", size, viseme }: AnimatedAvatarProps) => {
  const active = speaking && animation !== "nenhuma";
  const gestures = active && animation === "gestos";
  const catalog = findCatalogAvatar(avatarId);

  if (catalog?.kind === "video" && catalog.videoUrl) {
    return (
      <div className={SIZE_CLASS[size]}>
        {catalog.mouthTrack ? (
          <LipSyncVideoAvatar url={catalog.videoUrl} trackKey={catalog.mouthTrack} alt={alt} speaking={active} viseme={active ? viseme : null} />
        ) : (
          <PhotoRigAvatar url={catalog.videoUrl} alt={alt} speaking={active} viseme={active ? viseme : null} />
        )}
      </div>
    );
  }

  if (catalog?.kind === "ilustrado" && catalog.style) {
    return (
      <div
        className={`${SIZE_CLASS[size]} flex items-end justify-center overflow-hidden rounded-full border-2 border-primary bg-secondary ${
          active ? "shadow-[0_0_0_6px_hsl(var(--primary)/0.3)]" : ""
        }`}
      >
        <RiggedAvatar style={catalog.style} speaking={active} gestures={gestures} viseme={active ? viseme : null} />
      </div>
    );
  }

  return (
    <div className={`ai-avatar ${SIZE_CLASS[size]} ${active ? "is-speaking" : ""} ${gestures ? "has-gestures" : ""}`}>
      <div className="ai-avatar-body">
        <img src={src} alt={alt} className="ai-avatar-face" width={1024} height={1024} />
        <span
          className="ai-avatar-jaw"
          aria-hidden="true"
          style={active && viseme ? { animation: "none", transform: `translateY(${(VISEME_SHAPE[viseme].open * 4).toFixed(1)}%)`, transition: "transform 70ms ease-out" } : undefined}
        >
          <img src={src} alt="" className="ai-avatar-face" />
        </span>
      </div>

      {active && (
        <span className="ai-avatar-voice" aria-hidden="true">
          <i className="avatar-voice-bar" />
          <i className="avatar-voice-bar" />
          <i className="avatar-voice-bar" />
        </span>
      )}
    </div>
  );
};

export default AnimatedAvatar;
