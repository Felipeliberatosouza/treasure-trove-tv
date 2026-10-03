import anaVideo from "@/assets/avatars/lipsync-ana.mp4.asset.json";
import biaVideo from "@/assets/avatars/lipsync-bia.mp4.asset.json";
import helenaVideo from "@/assets/avatars/lipsync-helena.mp4.asset.json";
import lucasVideo from "@/assets/avatars/lipsync-lucas.mp4.asset.json";
import tiagoVideo from "@/assets/avatars/lipsync-tiago.mp4.asset.json";
import rafaelVideo from "@/assets/avatars/lipsync-rafael.mp4.asset.json";

export interface RiggedAvatarStyle {
  skin: string;
  hair: string;
  outfit: string;
  outfitDark: string;
  hairStyle: "longo" | "curto" | "cacheado" | "coque";
  gender?: "female" | "male";
  shirt?: string;
  glasses?: boolean;
  beard?: boolean;
}

export interface CatalogAvatar {
  id: string;
  /** Nome sugerido ao escolher o avatar (o administrador pode trocar). */
  label: string;
  gender: "female" | "male";
  kind: "ilustrado" | "video";
  /** Vídeo base em looping, quando kind = "video". */
  videoUrl?: string;
  /** Chave do mapa de posição da boca (legado). */
  mouthTrack?: string;
  /** Estilo do personagem ilustrado, quando kind = "ilustrado". */
  style?: RiggedAvatarStyle;
}

/** Galeria: 6 professores ilustrados (padrão, boca sincronizada) e 6 pessoas reais em vídeo (uso especial). */
export const AVATAR_CATALOG: CatalogAvatar[] = [
  {
    id: "ilu-ana",
    label: "Ana",
    gender: "female",
    kind: "ilustrado",
    style: { gender: "female", skin: "#e9bf9f", hair: "#3b2a22", outfit: "#1f3a5f", outfitDark: "#162b47", hairStyle: "longo", glasses: true },
  },
  {
    id: "ilu-bia",
    label: "Bia",
    gender: "female",
    kind: "ilustrado",
    style: { gender: "female", skin: "#8d5a3b", hair: "#1e1512", outfit: "#6b2737", outfitDark: "#521c29", hairStyle: "cacheado" },
  },
  {
    id: "ilu-helena",
    label: "Helena",
    gender: "female",
    kind: "ilustrado",
    style: { gender: "female", skin: "#e3b392", hair: "#9a9aa2", outfit: "#2f4f4a", outfitDark: "#233b37", hairStyle: "coque", glasses: true },
  },
  {
    id: "ilu-lucas",
    label: "Lucas",
    gender: "male",
    kind: "ilustrado",
    style: { gender: "male", skin: "#ebc2a0", hair: "#3a2c22", outfit: "#2b3445", outfitDark: "#1f2633", hairStyle: "curto", shirt: "#e8eef6", beard: true },
  },
  {
    id: "ilu-tiago",
    label: "Tiago",
    gender: "male",
    kind: "ilustrado",
    style: { gender: "male", skin: "#7c4b2f", hair: "#17100d", outfit: "#4a3b2c", outfitDark: "#382c20", hairStyle: "curto", glasses: true },
  },
  {
    id: "ilu-rafael",
    label: "Rafael",
    gender: "male",
    kind: "ilustrado",
    style: { gender: "male", skin: "#e2b896", hair: "#a3a3aa", outfit: "#3c4451", outfitDark: "#2c323c", hairStyle: "curto", glasses: true, beard: true },
  },
  { id: "vid-ana", label: "Ana (vídeo)", gender: "female", kind: "video", videoUrl: anaVideo.url, mouthTrack: "ana" },
  { id: "vid-bia", label: "Bia (vídeo)", gender: "female", kind: "video", videoUrl: biaVideo.url, mouthTrack: "bia" },
  { id: "vid-helena", label: "Helena (vídeo)", gender: "female", kind: "video", videoUrl: helenaVideo.url, mouthTrack: "helena" },
  { id: "vid-lucas", label: "Lucas (vídeo)", gender: "male", kind: "video", videoUrl: lucasVideo.url, mouthTrack: "lucas" },
  { id: "vid-tiago", label: "Tiago (vídeo)", gender: "male", kind: "video", videoUrl: tiagoVideo.url, mouthTrack: "tiago" },
  { id: "vid-rafael", label: "Rafael (vídeo)", gender: "male", kind: "video", videoUrl: rafaelVideo.url, mouthTrack: "rafael" },
];

export const findCatalogAvatar = (id?: string): CatalogAvatar | undefined =>
  AVATAR_CATALOG.find((a) => a.id === id);
