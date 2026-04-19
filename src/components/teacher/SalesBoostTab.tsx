import { useEffect, useMemo, useRef, useState } from "react";
import {
  Megaphone,
  Video,
  Mic2,
  Sparkles,
  Image as ImageIcon,
  Copy,
  Download,
  Instagram,
  MessageCircle,
  Loader2,
  ExternalLink,
  GripVertical,
  ArrowUp,
  ArrowDown,
  History,
  Trash2,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

interface ContentItem {
  id: string;
  title: string;
  video_type: string;
  has_top_questoes: boolean;
}

interface SalesPostRow {
  id: string;
  template: string;
  caption: string;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  contents: ContentItem[];
  public_url: string | null;
  created_at: string;
}

type TemplateKey = "light" | "dark" | "colorful";

interface TemplateStyle {
  key: TemplateKey;
  label: string;
  description: string;
  // Background paint
  bgStops: [string, string, string];
  blob1: string;
  blob2: string;
  blobAlpha: number;
  // Text colors
  platformTag: string;
  nameColor: string;
  areasColor: string;
  listHeading: string;
  listItem: string;
  topQuestoesColor: string;
  // Avatar ring
  ringColor: string;
  // CTA bar
  ctaBg: string;
  ctaTitle: string;
  ctaUrl: string;
  // Preview swatches for the picker
  swatches: string[];
}

const TEMPLATES: Record<TemplateKey, TemplateStyle> = {
  light: {
    key: "light",
    label: "Claro",
    description: "Fundo claro, tipografia escura, sofisticado.",
    bgStops: ["#fafaf7", "#f1efe9", "#e7e3d8"],
    blob1: "#cbd5e1",
    blob2: "#fde68a",
    blobAlpha: 0.35,
    platformTag: "rgba(30,27,75,0.65)",
    nameColor: "#0f172a",
    areasColor: "#475569",
    listHeading: "#0f172a",
    listItem: "rgba(15,23,42,0.85)",
    topQuestoesColor: "#b45309",
    ringColor: "#0f172a",
    ctaBg: "#0f172a",
    ctaTitle: "#fafaf7",
    ctaUrl: "#fde68a",
    swatches: ["#fafaf7", "#e7e3d8", "#0f172a", "#fde68a"],
  },
  dark: {
    key: "dark",
    label: "Escuro",
    description: "Fundo escuro, contraste alto, elegante.",
    bgStops: ["#0a0a0f", "#111118", "#1a1a24"],
    blob1: "#1f2937",
    blob2: "#334155",
    blobAlpha: 0.4,
    platformTag: "rgba(255,255,255,0.7)",
    nameColor: "#ffffff",
    areasColor: "#cbd5e1",
    listHeading: "#ffffff",
    listItem: "rgba(255,255,255,0.92)",
    topQuestoesColor: "#fde68a",
    ringColor: "#ffffff",
    ctaBg: "rgba(255,255,255,0.95)",
    ctaTitle: "#0a0a0f",
    ctaUrl: "#0a0a0f",
    swatches: ["#0a0a0f", "#1a1a24", "#ffffff", "#cbd5e1"],
  },
  colorful: {
    key: "colorful",
    label: "Colorido",
    description: "Gradiente vibrante, estilo Instagram.",
    bgStops: ["#0f172a", "#1e1b4b", "#7c3aed"],
    blob1: "#a78bfa",
    blob2: "#22d3ee",
    blobAlpha: 0.18,
    platformTag: "rgba(255,255,255,0.85)",
    nameColor: "#ffffff",
    areasColor: "#e9d5ff",
    listHeading: "#ffffff",
    listItem: "rgba(255,255,255,0.92)",
    topQuestoesColor: "#fde68a",
    ringColor: "#ffffff",
    ctaBg: "rgba(255,255,255,0.95)",
    ctaTitle: "#1e1b4b",
    ctaUrl: "#7c3aed",
    swatches: ["#1e1b4b", "#7c3aed", "#22d3ee", "#a78bfa"],
  },
};

const SalesBoostTab = () => {
  const { profile, user } = useAuth();
  const { data: branding } = usePlatformSettings("branding");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [template, setTemplate] = useState<TemplateKey>("colorful");
  const [history, setHistory] = useState<SalesPostRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const MIN_SEL = 3;
  const MAX_SEL = 5;

  const publicUrl = useMemo(() => {
    if (!slug) return "";
    return `${window.location.origin}/professor/${slug}`;
  }, [slug]);

  // Fetch teacher's slug + approved content
  useEffect(() => {
    const fetchAll = async () => {
      if (!user?.id) return;
      setLoading(true);
      const [profRes, lessonsRes, examsRes] = await Promise.all([
        supabase.from("profiles").select("slug").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("lessons")
          .select("id,title,video_type,top_questoes_url")
          .eq("teacher_id", user.id)
          .eq("published", true)
          .eq("admin_approved", true)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("exam_solutions")
          .select("id,title,video_type,top_questoes_url")
          .eq("teacher_id", user.id)
          .eq("published", true)
          .eq("admin_approved", true)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      setSlug(profRes.data?.slug || "");
      const all: ContentItem[] = [
        ...(lessonsRes.data || []).map((l) => ({
          id: l.id,
          title: l.title,
          video_type: l.video_type,
          has_top_questoes: !!l.top_questoes_url,
        })),
        ...(examsRes.data || []).map((e) => ({
          id: e.id,
          title: e.title,
          video_type: e.video_type,
          has_top_questoes: !!e.top_questoes_url,
        })),
      ];
      setContents(all);
      setSelectedIds(all.slice(0, MAX_SEL).map((c) => c.id));
      setLoading(false);
    };
    fetchAll();
  }, [user?.id]);

  // Fetch sales post history
  const fetchHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("teacher_sales_posts")
      .select("id,template,caption,thumbnail_url,thumbnail_path,contents,public_url,created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      setHistory(data as unknown as SalesPostRow[]);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id]);

  const reuseHistoryPost = (post: SalesPostRow) => {
    setTemplate((post.template as TemplateKey) || "colorful");
    setCaption(post.caption || "");
    setImageDataUrl(post.thumbnail_url || "");
    const ids = (post.contents || []).map((c) => c.id).filter(Boolean);
    if (ids.length) {
      // Only keep ids that still exist in current contents to allow re-generation
      const existing = ids.filter((id) => contents.some((c) => c.id === id));
      if (existing.length) setSelectedIds(existing.slice(0, MAX_SEL));
    }
    toast.success("Post carregado do histórico.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHistoryPost = async (post: SalesPostRow) => {
    if (!confirm("Excluir este post do histórico?")) return;
    // Delete storage object first (best-effort)
    if (post.thumbnail_path) {
      await supabase.storage.from("sales-post-thumbnails").remove([post.thumbnail_path]);
    }
    const { error } = await supabase
      .from("teacher_sales_posts")
      .delete()
      .eq("id", post.id);
    if (error) {
      toast.error("Falha ao excluir post.");
      return;
    }
    setHistory((prev) => prev.filter((p) => p.id !== post.id));
    toast.success("Post removido do histórico.");
  };

  // Preserve selection order (drag-and-drop driven)
  const selectedContents = useMemo(() => {
    const map = new Map(contents.map((c) => [c.id, c]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as ContentItem[];
  }, [contents, selectedIds]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (i: number) => (e: React.DragEvent) => {
    setDragIndex(i);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(i));
  };
  const handleDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(i);
  };
  const handleDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex;
    setDragIndex(null);
    setDragOverIndex(null);
    if (from === null || from === i) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SEL) {
        toast.error(`Selecione no máximo ${MAX_SEL} conteúdos.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const buildCaption = (items: ContentItem[]) => {
    const name = profile?.name || "Professor(a)";
    const areas = (profile?.areas || []).slice(0, 3).join(" • ");
    const platform = branding?.platform_name || "Revisão Fácil";
    const bio = profile?.bio?.trim();

    const lines: string[] = [];
    lines.push(`📚 ${name} na ${platform}!`);
    if (areas) lines.push(`✨ ${areas}`);
    lines.push("");
    if (bio) {
      lines.push(bio.length > 200 ? bio.slice(0, 197) + "..." : bio);
      lines.push("");
    }
    if (items.length > 0) {
      lines.push("🎯 Confira meus conteúdos:");
      items.forEach((c) => {
        const tag =
          c.video_type === "resolucao_questoes" ? "📝" : "🎬";
        lines.push(`${tag} ${c.title}`);
      });
      const hasTopQ = items.some((c) => c.has_top_questoes);
      if (hasTopQ) {
        lines.push("");
        lines.push("⭐ Inclui Top Questões de Prova!");
      }
      lines.push("");
    }
    lines.push(`👉 Acesse: ${publicUrl}`);
    lines.push("");
    lines.push(
      "#RevisaoFacil #Estudos #Concursos #Vestibular #Educação #DicasDeEstudo"
    );
    return lines.join("\n");
  };

  const generatePost = async () => {
    if (!slug) {
      toast.error("Defina sua URL pública (slug) em Dados Pessoais antes de gerar o post.");
      return;
    }
    if (selectedContents.length < MIN_SEL) {
      toast.error(`Selecione ao menos ${MIN_SEL} conteúdos para o post.`);
      return;
    }
    setGenerating(true);
    try {
      // Build caption
      const cap = buildCaption(selectedContents);
      setCaption(cap);

      // Build image (1080x1350 portrait — Instagram feed format)
      const W = 1080;
      const H = 1350;
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado");

      const t = TEMPLATES[template];

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, t.bgStops[0]);
      grad.addColorStop(0.5, t.bgStops[1]);
      grad.addColorStop(1, t.bgStops[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Decorative blobs
      ctx.globalAlpha = t.blobAlpha;
      ctx.fillStyle = t.blob1;
      ctx.beginPath();
      ctx.arc(W - 120, 180, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.blob2;
      ctx.beginPath();
      ctx.arc(140, H - 200, 260, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Platform tag
      const platformName = branding?.platform_name || "Revisão Fácil";
      ctx.fillStyle = t.platformTag;
      ctx.font = "600 32px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(platformName.toUpperCase(), 80, 110);

      // Avatar (circular)
      const avatarSize = 220;
      const avatarX = W / 2 - avatarSize / 2;
      const avatarY = 180;
      try {
        if (profile.avatar_url) {
          const img = await loadImage(profile.avatar_url);
          ctx.save();
          ctx.beginPath();
          ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();
        } else {
          // Fallback initials circle
          ctx.fillStyle = t.ringColor;
          ctx.beginPath();
          ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = t.nameColor === "#ffffff" ? "#1e1b4b" : "#ffffff";
          ctx.font = "bold 110px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const initials = (profile.name || "P")
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          ctx.fillText(initials, W / 2, avatarY + avatarSize / 2 + 8);
        }
      } catch {
        // ignore avatar errors
      }
      // Avatar ring
      ctx.strokeStyle = t.ringColor;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
      ctx.stroke();

      // Name
      ctx.fillStyle = t.nameColor;
      ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const nameText = profile.name || "Professor(a)";
      wrapText(ctx, nameText, W / 2, avatarY + avatarSize + 90, W - 160, 70);

      // Areas
      const areas = (profile.areas || []).slice(0, 3).join("  •  ");
      if (areas) {
        ctx.fillStyle = t.areasColor;
        ctx.font = "500 32px system-ui, sans-serif";
        ctx.fillText(areas, W / 2, avatarY + avatarSize + 160);
      }

      // Content list
      const listStartY = 760;
      ctx.fillStyle = t.listHeading;
      ctx.font = "bold 36px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🎯 Meus conteúdos:", 90, listStartY);

      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillStyle = t.listItem;
      const items = selectedContents.slice(0, MAX_SEL);
      items.forEach((c, i) => {
        const y = listStartY + 60 + i * 50;
        const prefix = c.video_type === "resolucao_questoes" ? "📝" : "🎬";
        const text = `${prefix}  ${truncate(c.title, 42)}`;
        ctx.fillText(text, 90, y);
      });

      if (items.some((c) => c.has_top_questoes)) {
        ctx.fillStyle = t.topQuestoesColor;
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.fillText("⭐ Inclui Top Questões de Prova", 90, listStartY + 60 + items.length * 50 + 20);
      }

      // CTA bar at bottom
      const ctaY = H - 200;
      ctx.fillStyle = t.ctaBg;
      roundRect(ctx, 60, ctaY, W - 120, 140, 24);
      ctx.fill();

      ctx.fillStyle = t.ctaTitle;
      ctx.font = "bold 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("👉 Acesse minha página:", W / 2, ctaY + 50);
      ctx.fillStyle = t.ctaUrl;
      ctx.font = "bold 34px system-ui, sans-serif";
      const shortUrl = publicUrl.replace(/^https?:\/\//, "");
      ctx.fillText(truncate(shortUrl, 40), W / 2, ctaY + 100);

      const dataUrl = canvas.toDataURL("image/png");
      setImageDataUrl(dataUrl);
      toast.success("Post gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar post.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!imageDataUrl) return;
    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = `revisao-facil-post-${slug || "professor"}.png`;
    a.click();
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Legenda copiada!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(caption);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const openInstagram = () => {
    // Instagram has no direct web post API; guide user
    window.open("https://www.instagram.com/", "_blank");
    toast.info("Baixe a imagem e cole a legenda no Instagram.", { duration: 5000 });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Buscar Vendas
        </h2>
        <p className="text-sm text-muted-foreground">
          Aprenda a produzir conteúdo de qualidade e divulgue sua página com posts prontos para Instagram e WhatsApp.
        </p>
      </div>

      {/* Tips */}
      <section>
        <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Dicas para vender mais
        </h3>
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="video-quality" className="rounded-lg border border-border px-4">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" /> Como gravar um vídeo com qualidade
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Iluminação:</strong> use luz frontal natural (perto de uma janela) ou uma luminária ring light. Nunca grave de costas para a luz.</li>
                <li><strong className="text-foreground">Áudio:</strong> grave em ambiente silencioso. Um microfone de lapela barato (~R$ 50) faz uma diferença enorme.</li>
                <li><strong className="text-foreground">Câmera:</strong> celular moderno em modo Full HD (1080p) na horizontal ou vertical, conforme o uso.</li>
                <li><strong className="text-foreground">Estabilidade:</strong> use tripé ou apoie em superfície firme. Vídeo tremido perde aluno em segundos.</li>
                <li><strong className="text-foreground">Enquadramento:</strong> rosto centralizado, na altura dos olhos, com o quadro lousa visível atrás de você.</li>
                <li><strong className="text-foreground">Duração ideal:</strong> 5 a 12 minutos para revisão; 3 a 7 minutos para resolução de questão.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="speech" className="rounded-lg border border-border px-4">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <span className="flex items-center gap-2">
                <Mic2 className="h-4 w-4 text-primary" /> Como falar de forma clara e objetiva
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Roteiro curto:</strong> escreva os 3 pontos principais antes de gravar. Evita "uhmm" e enrolação.</li>
                <li><strong className="text-foreground">Comece com o problema:</strong> "Você tem dificuldade em X?" — captura atenção nos primeiros 5 segundos.</li>
                <li><strong className="text-foreground">Vocabulário acessível:</strong> evite termos técnicos sem explicar. Imagine que está falando com um aluno do 1º ano.</li>
                <li><strong className="text-foreground">Pausas estratégicas:</strong> respire entre conceitos. Dá tempo de o aluno absorver.</li>
                <li><strong className="text-foreground">Exemplos concretos:</strong> sempre que apresentar uma fórmula, use 1 exemplo real logo em seguida.</li>
                <li><strong className="text-foreground">CTA no final:</strong> "Salve esse vídeo, deixe sua dúvida e veja meus outros conteúdos na Revisão Fácil!"</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="engagement" className="rounded-lg border border-border px-4">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Como criar conteúdos que engajam
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <p className="font-medium text-foreground mb-1">🎬 Vídeos</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Títulos com números: "5 erros em derivadas", "3 macetes de redação".</li>
                  <li>Resolva questões reais e recentes (ENEM, FUVEST, concursos).</li>
                  <li>Use thumbnails coloridas com texto grande e o seu rosto.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">📋 Colinhas</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>1 página apenas, com cores e ícones para destacar fórmulas.</li>
                  <li>Foque no que mais cai em prova, não em todo o conteúdo.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">📚 Resumos</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Estruture com tópicos curtos, mapas mentais e exemplos.</li>
                  <li>Inclua "Pegadinhas comuns" no final.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">⭐ Top Questões</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Selecione questões que historicamente caem em provas similares.</li>
                  <li>Resolva cada uma com vídeo curto + comentário escrito.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">📝 Simulados</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Misture fácil-médio-difícil (50%-30%-20%).</li>
                  <li>Disponibilize gabarito comentado em PDF.</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Post generator */}
      <section>
        <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" /> Gerador de post para divulgação
        </h3>
        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-4">
          {!slug && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Você precisa definir sua <strong>URL pública</strong> em "Dados Pessoais" antes de gerar o post.
            </div>
          )}

          {/* Manual content selection */}
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <Label className="text-sm font-medium">
                Selecione os conteúdos que aparecerão no post
              </Label>
              <span
                className={`text-xs font-medium ${
                  selectedIds.length < MIN_SEL || selectedIds.length > MAX_SEL
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {selectedIds.length}/{MAX_SEL} (mín. {MIN_SEL})
              </span>
            </div>
            {loading ? (
              <p className="text-xs text-muted-foreground">Carregando seus conteúdos...</p>
            ) : contents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Você ainda não tem conteúdos publicados e aprovados.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {contents.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  const disabled = !checked && selectedIds.length >= MAX_SEL;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-start gap-2 rounded-md border border-border p-2 text-sm cursor-pointer transition-colors ${
                        checked ? "bg-primary/10 border-primary/40" : "hover:bg-muted/50"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggleSelect(c.id)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 leading-snug">
                        <span className="block">
                          {c.video_type === "resolucao_questoes" ? "📝 " : "🎬 "}
                          {c.title}
                        </span>
                        {c.has_top_questoes && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            ⭐ Top Questões
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reorder selected contents */}
          {selectedContents.length > 0 && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Label className="text-sm font-medium">
                  Ordem na imagem e legenda
                </Label>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Arraste para reordenar
                </span>
              </div>
              <ul className="space-y-1.5">
                {selectedContents.map((c, i) => {
                  const isDragging = dragIndex === i;
                  const isOver = dragOverIndex === i && dragIndex !== null && dragIndex !== i;
                  return (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={handleDragStart(i)}
                      onDragOver={handleDragOver(i)}
                      onDrop={handleDrop(i)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 rounded-md border p-2 text-sm bg-background transition-all ${
                        isDragging ? "opacity-40" : ""
                      } ${
                        isOver
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border"
                      }`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">
                        {c.video_type === "resolucao_questoes" ? "📝 " : "🎬 "}
                        {c.title}
                      </span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveItem(i, i - 1)}
                          disabled={i === 0}
                          aria-label="Mover para cima"
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(i, i + 1)}
                          disabled={i === selectedContents.length - 1}
                          aria-label="Mover para baixo"
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Template picker */}
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <Label className="text-sm font-medium mb-2 block">
              Escolha o estilo visual do post
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => {
                const tpl = TEMPLATES[key];
                const active = template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTemplate(key)}
                    className={`group rounded-lg border p-2 text-left transition-all ${
                      active
                        ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    aria-pressed={active}
                  >
                    <div
                      className="h-16 w-full rounded-md mb-2 overflow-hidden flex"
                      aria-hidden
                    >
                      {tpl.swatches.map((c, i) => (
                        <div
                          key={i}
                          className="flex-1 h-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="text-xs font-semibold text-foreground">
                      {tpl.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      {tpl.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Button
              onClick={generatePost}
              disabled={
                generating ||
                loading ||
                !slug ||
                selectedIds.length < MIN_SEL ||
                selectedIds.length > MAX_SEL
              }
              className="gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar post automaticamente
            </Button>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> Ver minha página pública
              </a>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {imageDataUrl && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-2 block">Imagem (1080×1350 — Instagram)</Label>
                <div className="rounded-lg overflow-hidden border border-border bg-background">
                  <img src={imageDataUrl} alt="Post gerado" className="w-full h-auto" />
                </div>
                <Button onClick={downloadImage} variant="outline" size="sm" className="mt-2 gap-2 w-full">
                  <Download className="h-4 w-4" /> Baixar imagem PNG
                </Button>
              </div>
              <div className="flex flex-col">
                <Label className="text-xs mb-2 block">Legenda</Label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="flex-1 min-h-[280px] text-sm font-mono"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <Button onClick={copyCaption} variant="outline" size="sm" className="gap-2">
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                  <Button onClick={openInstagram} size="sm" className="gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90">
                    <Instagram className="h-4 w-4" /> Instagram
                  </Button>
                  <Button onClick={openWhatsApp} size="sm" className="gap-2 bg-green-600 text-white hover:bg-green-700">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Para o Instagram: baixe a imagem, abra o app e cole a legenda. Para o WhatsApp: o texto e link já vão prontos.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// Helpers
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = words[i] + " ";
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, curY);
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default SalesBoostTab;
