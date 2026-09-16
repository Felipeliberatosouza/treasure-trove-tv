export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  category: string;
  instructor: string;
  lessons: number;
  featured?: boolean;
  /** Link para a página do professor (conteúdo de professor real). */
  instructorHref?: string;
  videoUrl?: string;
}

export const videos: Video[] = [];

export const categories = [...new Set(videos.map((v) => v.category))];

export function getVideosByCategory(category: string): Video[] {
  return videos.filter((v) => v.category === category);
}

export function getFeaturedVideo(): Video | undefined {
  return videos.find((v) => v.featured) || videos[0];
}

export function getVideoById(id: string): Video | undefined {
  return videos.find((v) => v.id === id);
}
