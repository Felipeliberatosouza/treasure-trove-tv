import { useEffect, useRef } from "react";
import type { AiAvatarAnimation, AiAvatarSize } from "@/hooks/usePlatformSettings";
import { findCatalogAvatar } from "./avatarCatalog";
import RiggedAvatar from "./RiggedAvatar";

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
}

const SIZE_CLASS: Record<AiAvatarSize, string> = {
  pequeno: "h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20",
  medio: "h-16 w-16 sm:h-24 sm:w-24 md:h-28 md:w-28",
  grande: "h-24 w-24 sm:h-40 sm:w-40 md:h-48 md:w-48",
};

/** Avatar em vídeo: toca em looping enquanto a narração acontece e congela ao parar. */
const VideoAvatar = ({ url, alt, speaking }: { url: string; alt: string; speaking: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (speaking) void el.play().catch(() => undefined);
    else el.pause();
  }, [speaking]);

  return (
    <video
      ref={ref}
      src={url}
      aria-label={alt}
      className={`rig-video ${speaking ? "is-speaking" : ""}`}
      muted
      loop
      playsInline
      preload="auto"
    />
  );
};

/**
 * Professor(a) virtual que fala: personagem ilustrado articulado (boca, cabeça,
 * tronco, braços e mãos), avatar em vídeo ou, por compatibilidade, uma foto animada.
 */
const AnimatedAvatar = ({ avatarId, src, alt, speaking, animation = "gestos", size }: AnimatedAvatarProps) => {
  const active = speaking && animation !== "nenhuma";
  const gestures = active && animation === "gestos";
  const catalog = findCatalogAvatar(avatarId);

  if (catalog?.kind === "video" && catalog.videoUrl) {
    return (
      <div className={SIZE_CLASS[size]}>
        <VideoAvatar url={catalog.videoUrl} alt={alt} speaking={active} />
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
        <RiggedAvatar style={catalog.style} speaking={active} gestures={gestures} />
      </div>
    );
  }

  return (
    <div className={`ai-avatar ${SIZE_CLASS[size]} ${active ? "is-speaking" : ""} ${gestures ? "has-gestures" : ""}`}>
      <div className="ai-avatar-body">
        <img src={src} alt={alt} className="ai-avatar-face" width={1024} height={1024} />
        <span className="ai-avatar-jaw" aria-hidden="true">
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
