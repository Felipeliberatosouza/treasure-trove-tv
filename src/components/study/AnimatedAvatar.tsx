import type { AiAvatarAnimation, AiAvatarSize } from "@/hooks/usePlatformSettings";

interface AnimatedAvatarProps {
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

/**
 * Avatar da professora/professor virtual que "fala": a parte inferior do rosto
 * se move como a boca, o corpo balança e as mãos gesticulam durante a narração.
 */
const AnimatedAvatar = ({ src, alt, speaking, animation = "gestos", size }: AnimatedAvatarProps) => {
  const active = speaking && animation !== "nenhuma";
  const gestures = active && animation === "gestos";

  return (
    <div className={`ai-avatar ${SIZE_CLASS[size]} ${active ? "is-speaking" : ""} ${gestures ? "has-gestures" : ""}`}>
      <div className="ai-avatar-body">
        <img src={src} alt={alt} className="ai-avatar-face" width={1024} height={1024} />
        <span className="ai-avatar-jaw" aria-hidden="true">
          <img src={src} alt="" className="ai-avatar-face" />
        </span>
      </div>

      {gestures && (
        <>
          <span className="ai-avatar-arm ai-avatar-arm-left" aria-hidden="true">
            <svg viewBox="0 0 32 48" className="h-full w-full">
              <path d="M16 4c-4 4-7 11-7 18 0 4 1 8 3 11" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none" />
              <circle cx="13" cy="38" r="6" fill="currentColor" />
            </svg>
          </span>
          <span className="ai-avatar-arm ai-avatar-arm-right" aria-hidden="true">
            <svg viewBox="0 0 32 48" className="h-full w-full">
              <path d="M16 4c4 4 7 11 7 18 0 4-1 8-3 11" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none" />
              <circle cx="19" cy="38" r="6" fill="currentColor" />
            </svg>
          </span>
        </>
      )}

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
