import type React from "react";
import type { RiggedAvatarStyle } from "./avatarCatalog";
import { VISEME_SHAPE, type Viseme } from "@/utils/phonemeLipSync";
import { useNaturalGestures } from "./useNaturalGestures";

interface RiggedAvatarProps {
  style: RiggedAvatarStyle;
  /** Verdadeiro enquanto a narração está tocando. */
  speaking: boolean;
  /** Quando falso, o personagem fica parado (apenas piscando). */
  gestures?: boolean;
  /** Formato da boca sincronizado com a fala (quando há tempos da narração). */
  viseme?: Viseme | null;
}

/**
 * Personagem ilustrado articulado: cabeça, boca, tronco, braços, antebraços e mãos
 * são grupos independentes animados por CSS enquanto a narração acontece.
 */
const RiggedAvatar = ({ style, speaking, gestures = true, viseme }: RiggedAvatarProps) => {
  const shape = viseme ? VISEME_SHAPE[viseme] : null;
  const { skin, hair, outfit, outfitDark, hairStyle } = style;
  const pose = useNaturalGestures(speaking && gestures, viseme);
  const ease = "transform 900ms cubic-bezier(.45,.05,.3,1)";
  const rot = (deg: number, cx: number, cy: number) =>
    ({ transform: `rotate(${deg}deg)`, transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box", transition: ease }) as React.CSSProperties;

  return (
    <svg
      viewBox="0 0 200 220"
      className={`rig ${speaking ? "is-speaking" : ""}`}
      role="img"
      aria-hidden="true"
    >
      <g className="rig-body">
        {/* Braço esquerdo — peça única (braço + antebraço + mão) presa ao ombro */}
        <g style={rot(pose.armL + pose.foreL * 0.5, 54, 138)}>
          <rect x="44" y="132" width="20" height="78" rx="10" fill={outfit} />
          <circle cx="54" cy="208" r="11" fill={skin} />
        </g>

        {/* Braço direito */}
        <g style={rot(pose.armR + pose.foreR * 0.5, 146, 138)}>
          <rect x="136" y="132" width="20" height="78" rx="10" fill={outfit} />
          <circle cx="146" cy="208" r="11" fill={skin} />
        </g>

        {/* Tronco */}
        <path d="M60 220V158c0-22 18-34 40-34s40 12 40 34v62z" fill={outfit} />
        <path d="M100 124l-16 10 16 34 16-34z" fill={outfitDark} />

        {/* Pescoço */}
        <rect x="90" y="104" width="20" height="26" rx="10" fill={skin} />

        {/* Cabeça */}
        <g style={rot(pose.head, 100, 110)}>
        <g className="rig-head">
          {hairStyle === "longo" && <path d="M58 58c0-26 19-44 42-44s42 18 42 44v58c0 8-10 10-14 4V66H72v54c-4 6-14 4-14-4z" fill={hair} />}
          {hairStyle === "cacheado" && (
            <g fill={hair}>
              <circle cx="72" cy="52" r="20" />
              <circle cx="100" cy="38" r="22" />
              <circle cx="128" cy="52" r="20" />
              <circle cx="62" cy="76" r="14" />
              <circle cx="138" cy="76" r="14" />
            </g>
          )}
          {hairStyle === "coque" && (
            <g fill={hair}>
              <circle cx="100" cy="20" r="14" />
              <path d="M62 62c0-24 17-40 38-40s38 16 38 40v6H62z" />
            </g>
          )}
          {hairStyle === "curto" && <path d="M62 64c0-24 17-42 38-42s38 18 38 42v4c-8-12-22-16-38-16s-30 4-38 16z" fill={hair} />}

          {/* Rosto */}
          <ellipse cx="100" cy="72" rx="34" ry="40" fill={skin} />
          <ellipse cx="66" cy="76" rx="6" ry="9" fill={skin} />
          <ellipse cx="134" cy="76" rx="6" ry="9" fill={skin} />

          {/* Sobrancelhas */}
          <rect x="78" y="58" width="16" height="4" rx="2" fill={hair} />
          <rect x="106" y="58" width="16" height="4" rx="2" fill={hair} />

          {/* Olhos */}
          <g className="rig-eyes">
            <ellipse cx="86" cy="70" rx="5" ry="6" fill="#20232b" />
            <ellipse cx="114" cy="70" rx="5" ry="6" fill="#20232b" />
          </g>

          {/* Boca articulada */}
          {shape ? (
            <g>
              <ellipse cx="100" cy="92" rx={(12 * shape.sx).toFixed(2)} ry={Math.max(1, 8 * shape.sy).toFixed(2)} fill="#8d3b46" />
              {shape.open > 0.3 && <ellipse cx="100" cy={(92 - 8 * shape.sy + 3).toFixed(2)} rx={(9 * shape.sx).toFixed(2)} ry="2.5" fill="#ffffff" opacity="0.85" />}
            </g>
          ) : (
            <g className="rig-mouth">
              <ellipse cx="100" cy="92" rx="12" ry="8" fill="#8d3b46" />
              <ellipse cx="100" cy="88" rx="9" ry="3" fill="#ffffff" opacity="0.85" />
            </g>
          )}

          {hairStyle === "curto" && <path d="M62 66c6-16 22-24 38-24s32 8 38 24c2-30-16-46-38-46S60 36 62 66z" fill={hair} />}
        </g>
        </g>
      </g>
    </svg>
  );
};

export default RiggedAvatar;
