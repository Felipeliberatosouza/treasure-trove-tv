export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  category: string;
  instructor: string;
  lessons: number;
  level: "Iniciante" | "Intermediário" | "Avançado";
  featured?: boolean;
  videoUrl?: string;
}

export const videos: Video[] = [
  {
    id: "1",
    title: "Dominando React do Zero ao Avançado",
    description: "Aprenda React desde os fundamentos até técnicas avançadas como hooks customizados, Context API e otimização de performance.",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=340&fit=crop",
    duration: "24h 30min",
    category: "Desenvolvimento Web",
    instructor: "Carlos Silva",
    lessons: 180,
    level: "Iniciante",
    featured: true,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "2",
    title: "Python para Data Science",
    description: "Domine Python aplicado à ciência de dados com pandas, numpy, matplotlib e machine learning.",
    thumbnail: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=600&h=340&fit=crop",
    duration: "32h 15min",
    category: "Data Science",
    instructor: "Ana Martins",
    lessons: 220,
    level: "Intermediário",
  },
  {
    id: "3",
    title: "UI/UX Design Completo",
    description: "Aprenda design de interfaces e experiência do usuário com Figma, princípios de design e prototipagem.",
    thumbnail: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=340&fit=crop",
    duration: "18h 45min",
    category: "Design",
    instructor: "Marina Costa",
    lessons: 95,
    level: "Iniciante",
  },
  {
    id: "4",
    title: "Node.js e APIs RESTful",
    description: "Construa APIs robustas com Node.js, Express, MongoDB e autenticação JWT.",
    thumbnail: "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=600&h=340&fit=crop",
    duration: "20h 10min",
    category: "Desenvolvimento Web",
    instructor: "Pedro Santos",
    lessons: 150,
    level: "Intermediário",
  },
  {
    id: "5",
    title: "Marketing Digital Estratégico",
    description: "Estratégias completas de marketing digital incluindo SEO, redes sociais, e-mail marketing e funil de vendas.",
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=340&fit=crop",
    duration: "15h 20min",
    category: "Marketing",
    instructor: "Juliana Alves",
    lessons: 85,
    level: "Iniciante",
  },
  {
    id: "6",
    title: "Machine Learning na Prática",
    description: "Algoritmos de ML com scikit-learn, TensorFlow e projetos reais de classificação e regressão.",
    thumbnail: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&h=340&fit=crop",
    duration: "28h 00min",
    category: "Data Science",
    instructor: "Roberto Lima",
    lessons: 200,
    level: "Avançado",
  },
  {
    id: "7",
    title: "Fotografia Profissional",
    description: "Técnicas avançadas de fotografia, iluminação, composição e edição com Lightroom e Photoshop.",
    thumbnail: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&h=340&fit=crop",
    duration: "12h 30min",
    category: "Design",
    instructor: "Fernanda Reis",
    lessons: 70,
    level: "Intermediário",
  },
  {
    id: "8",
    title: "DevOps e Cloud Computing",
    description: "Docker, Kubernetes, AWS, CI/CD pipelines e infraestrutura como código.",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=340&fit=crop",
    duration: "22h 45min",
    category: "Desenvolvimento Web",
    instructor: "Lucas Oliveira",
    lessons: 160,
    level: "Avançado",
  },
];

export const categories = [...new Set(videos.map((v) => v.category))];

export function getVideosByCategory(category: string): Video[] {
  return videos.filter((v) => v.category === category);
}

export function getFeaturedVideo(): Video {
  return videos.find((v) => v.featured) || videos[0];
}

export function getVideoById(id: string): Video | undefined {
  return videos.find((v) => v.id === id);
}
