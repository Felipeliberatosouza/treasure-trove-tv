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
 * Professor(a) ilustrado(a) em estilo editorial adulto: rosto com proporções reais,
 * blazer, camisa, óculos e cabelos grisalhos opcionais. Boca articulada pelos
 * fonemas da ElevenLabs; braços como peça única presa ao ombro.
 */
const RiggedAvatar = ({ style, speaking, gestures = true, viseme }: RiggedAvatarProps) => {
  const shape = viseme ? VISEME_SHAPE[viseme] : VISEME_SHAPE.rest;
  const { skin, hair, outfit, outfitDark, hairStyle, shirt = "#f4f1ea", glasses, beard, gender } = style;
  const pose = useNaturalGestures(speaking && gestures, viseme);
  const ease = "transform 900ms cubic-bezier(.45,.05,.3,1)";
  const rot = (deg: number, cx: number, cy: number) =>
    ({ transform: `rotate(${deg}deg)`, transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box", transition: ease }) as React.CSSProperties;
  const shade = "rgba(60,30,20,0.18)";
  const lip = gender === "female" ? "#a5545b" : "#9a6a5e";
  const open = Math.max(0, shape.open);
  const mw = 10 * shape.sx;
  const mh = 1 + 7 * shape.sy;

  return (
    <svg viewBox="0 0 200 220" className={`rig ${speaking ? "is-speaking" : ""}`} role="img" aria-hidden="true">
      <g className="rig-body">
        {/* Braços (manga do blazer + mão) */}
        <g style={rot(pose.armL + pose.foreL * 0.5, 50, 146)}>
          <path d="M40 142q10-6 20 0l-2 66q-8 4-16 0z" fill={outfit} />
          <path d="M42 200h16v6h-16z" fill={shirt} />
          <ellipse cx="50" cy="212" rx="8" ry="9" fill={skin} />
        </g>
        <g style={rot(pose.armR + pose.foreR * 0.5, 150, 146)}>
          <path d="M140 142q10-6 20 0l-2 66q-8 4-16 0z" fill={outfit} />
          <path d="M142 200h16v6h-16z" fill={shirt} />
          <ellipse cx="150" cy="212" rx="8" ry="9" fill={skin} />
        </g>

        {/* Tronco: blazer, camisa e lapelas */}
        <path d="M46 220v-62c0-20 22-32 54-32s54 12 54 32v62z" fill={outfit} />
        <path d="M84 128l16 44 16-44q-16-4-32 0z" fill={shirt} />
        {gender === "male" ? (
          <path d="M97 136h6l3 30-6 8-6-8z" fill={outfitDark} />
        ) : (
          <circle cx="100" cy="146" r="2.4" fill="#d9c27a" />
        )}
        <path d="M84 128l-10 6 18 42 8-4z" fill={outfitDark} />
        <path d="M116 128l10 6-18 42-8-4z" fill={outfitDark} />

        {/* Pescoço */}
        <path d="M90 104h20v26q-10 6-20 0z" fill={skin} />
        <path d="M90 116q10 6 20 0v6q-10 5-20 0z" fill={shade} />

        {/* Cabeça */}
        <g style={rot(pose.head, 100, 112)}>
          <g className="rig-head">
            {/* Cabelo de trás */}
            {hairStyle === "longo" && <path d="M60 64c0-28 18-46 40-46s40 18 40 46v50q-6 8-14 2V70H74v46q-8 6-14-2z" fill={hair} />}
            {hairStyle === "coque" && <ellipse cx="100" cy="22" rx="14" ry="11" fill={hair} />}
            {hairStyle === "cacheado" && (
              <g fill={hair}>
                <circle cx="70" cy="56" r="17" /><circle cx="100" cy="40" r="20" /><circle cx="130" cy="56" r="17" />
                <circle cx="64" cy="82" r="12" /><circle cx="136" cy="82" r="12" />
              </g>
            )}

            {/* Orelhas e rosto (oval adulto, maxilar definido) */}
            <ellipse cx="68" cy="76" rx="5" ry="9" fill={skin} />
            <ellipse cx="132" cy="76" rx="5" ry="9" fill={skin} />
            <path d="M70 66c0-22 13-36 30-36s30 14 30 36v12c0 18-12 32-30 34-18-2-30-16-30-34z" fill={skin} />
            {/* Sombra lateral e do queixo para dar volume */}
            <path d="M122 60c6 8 8 18 7 28-2 12-10 22-20 24 10-8 15-26 13-52z" fill={shade} />
            <path d="M90 108q10 5 20 0q-10 6-20 0z" fill={shade} />

            {/* Barba curta */}
            {beard && <path d="M72 84c2 16 12 26 28 28 16-2 26-12 28-28-4 8-10 12-14 12q-14-6-28 0c-4 0-10-4-14-12z" fill={hair} opacity="0.85" />}

            {/* Sobrancelhas finas */}
            <path d="M78 63q8-4 15 0" stroke={hair} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M107 63q7-4 15 0" stroke={hair} strokeWidth="2.4" fill="none" strokeLinecap="round" />

            {/* Olhos com pálpebra, íris e brilho */}
            <g className="rig-eyes">
              <path d="M79 72q7-6 14 0q-7 4-14 0z" fill="#fbfaf7" />
              <path d="M107 72q7-6 14 0q-7 4-14 0z" fill="#fbfaf7" />
              <circle cx="86" cy="71.5" r="2.8" fill="#3d2a1e" />
              <circle cx="114" cy="71.5" r="2.8" fill="#3d2a1e" />
              <circle cx="86.8" cy="70.6" r="0.8" fill="#ffffff" />
              <circle cx="114.8" cy="70.6" r="0.8" fill="#ffffff" />
              <path d="M79 72q7-6 14 0" stroke="#2a1d16" strokeWidth="1.2" fill="none" />
              <path d="M107 72q7-6 14 0" stroke="#2a1d16" strokeWidth="1.2" fill="none" />
            </g>
            {/* Linhas de expressão suaves (maturidade) */}
            <path d="M77 76q2 2 5 2M123 76q-2 2-5 2" stroke={shade} strokeWidth="1" fill="none" />

            {/* Nariz */}
            <path d="M100 72v13q-3 2-6 1M100 85q3 2 6 1" stroke="rgba(80,40,30,0.45)" strokeWidth="1.3" fill="none" strokeLinecap="round" />

            {/* Boca articulada pelos fonemas */}
            <g>
              {open > 0.05 ? (
                <>
                  <ellipse cx="100" cy="96" rx={mw.toFixed(2)} ry={mh.toFixed(2)} fill="#4a1f22" />
                  {open > 0.3 && <rect x={(100 - mw * 0.75).toFixed(2)} y={(96 - mh + 0.6).toFixed(2)} width={(mw * 1.5).toFixed(2)} height="2.6" rx="1.2" fill="#f3efe8" />}
                  <path d={`M${100 - mw} 96q${mw} ${-mh - 2} ${mw * 2} 0`} stroke={lip} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  <path d={`M${100 - mw} 96q${mw} ${mh + 3} ${mw * 2} 0`} stroke={lip} strokeWidth="2.6" fill="none" strokeLinecap="round" />
                </>
              ) : (
                <path d="M90 96q10 4 20 0" stroke={lip} strokeWidth="2.6" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Óculos de armação fina */}
            {glasses && (
              <g stroke="#2b2b30" strokeWidth="1.6" fill="rgba(255,255,255,0.08)">
                <rect x="76" y="64" width="20" height="14" rx="5" />
                <rect x="104" y="64" width="20" height="14" rx="5" />
                <path d="M96 70q4-3 8 0M76 69l-7-2M124 69l7-2" fill="none" />
              </g>
            )}

            {/* Cabelo da frente */}
            {hairStyle === "curto" && <path d="M68 66c-2-26 14-40 32-40 20 0 34 12 32 38-4-12-14-20-30-20-12 4-24 8-34 22z" fill={hair} />}
            {hairStyle === "coque" && <path d="M68 64c0-22 14-34 32-34s32 12 32 34c-8-10-20-16-32-16s-24 6-32 16z" fill={hair} />}
            {hairStyle === "longo" && <path d="M68 70c0-26 14-40 32-40s32 14 32 40c-10-14-20-22-34-22-10 6-20 12-30 22z" fill={hair} />}
          </g>
        </g>
      </g>
    </svg>
  );
};

export default RiggedAvatar;
