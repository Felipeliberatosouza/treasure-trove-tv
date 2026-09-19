import anaVideo from "@/assets/avatars/video-ana.mp4.asset.json";
import biaVideo from "@/assets/avatars/video-bia.mp4.asset.json";
import helenaVideo from "@/assets/avatars/video-helena.mp4.asset.json";
import lucasVideo from "@/assets/avatars/video-lucas.mp4.asset.json";
import tiagoVideo from "@/assets/avatars/video-tiago.mp4.asset.json";
import rafaelVideo from "@/assets/avatars/video-rafael.mp4.asset.json";

export interface RiggedAvatarStyle {
  skin: string;
  hair: string;
  outfit: string;
  outfitDark: string;
  hairStyle: "longo" | "curto" | "cacheado" | "coque";
}

export interface CatalogAvatar {
  id: string;
  /** Nome sugerido ao escolher o avatar (o administrador pode trocar). */
  label: string;
  gender: "female" | "male";
  kind: "ilustrado" | "video";
  /** Vídeo em looping, quando kind = "video". */
  videoUrl?: string;
  /** Estilo do personagem ilustrado, quando kind = "ilustrado". */
  style?: RiggedAvatarStyle;
}

/** Galeria de avatares prontos: 6 ilustrados articulados e 6 em vídeo. */
export const AVATAR_CATALOG: CatalogAvatar[] = [
  {
    id: "ilu-ana",
    label: "Ana",
    gender: "female",
    kind: "ilustrado",
    style: { skin: "#f2c9a8", hair: "#3b2a22", outfit: "#2f6fb5", outfitDark: "#255a95", hairStyle: "longo" },
  },
  {
    id: "ilu-bia",
    label: "Bia",
    gender: "female",
    kind: "ilustrado",
    style: { skin: "#8d5a3b", hair: "#1e1512", outfit: "#c2456b", outfitDark: "#a03557", hairStyle: "cacheado" },
  },
  {
    id: "ilu-helena",
    label: "Helena",
    gender: "female",
    kind: "ilustrado",
    style: { skin: "#e8b995", hair: "#6f6f78", outfit: "#2a9d8f", outfitDark: "#218176", hairStyle: "coque" },
  },
  {
    id: "ilu-lucas",
    label: "Lucas",
    gender: "male",
    kind: "ilustrado",
    style: { skin: "#f0c6a3", hair: "#2c2118", outfit: "#3f4a8a", outfitDark: "#333c72", hairStyle: "curto" },
  },
  {
    id: "ilu-tiago",
    label: "Tiago",
    gender: "male",
    kind: "ilustrado",
    style: { skin: "#7c4b2f", hair: "#17100d", outfit: "#e07a3f", outfitDark: "#c26430", hairStyle: "curto" },
  },
  {
    id: "ilu-rafael",
    label: "Rafael",
    gender: "male",
    kind: "ilustrado",
    style: { skin: "#e5bb98", hair: "#8b8b93", outfit: "#4b5563", outfitDark: "#3c4451", hairStyle: "curto" },
  },
  { id: "vid-ana", label: "Ana (vídeo)", gender: "female", kind: "video", videoUrl: anaVideo.url },
  { id: "vid-bia", label: "Bia (vídeo)", gender: "female", kind: "video", videoUrl: biaVideo.url },
  { id: "vid-helena", label: "Helena (vídeo)", gender: "female", kind: "video", videoUrl: helenaVideo.url },
  { id: "vid-lucas", label: "Lucas (vídeo)", gender: "male", kind: "video", videoUrl: lucasVideo.url },
  { id: "vid-tiago", label: "Tiago (vídeo)", gender: "male", kind: "video", videoUrl: tiagoVideo.url },
  { id: "vid-rafael", label: "Rafael (vídeo)", gender: "male", kind: "video", videoUrl: rafaelVideo.url },
];

export const findCatalogAvatar = (id?: string): CatalogAvatar | undefined =>
  AVATAR_CATALOG.find((a) => a.id === id);
