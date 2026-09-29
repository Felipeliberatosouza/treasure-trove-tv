import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VideoCarousel from "@/components/VideoCarousel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Video } from "@/data/courses";

type Row = { video: Video; href: string; areas: string[] };

// Dois carrosséis por produto: 1) Resolução de provas; 2) Revisões de conteúdo.
// Ordem: áreas de interesse primeiro; dentro disso, professores reais antes dos virtuais.
export default function ProductContentCarousels({ productKey }: { productKey: string }) {
  const { profile } = useAuth() as any;
  const navigate = useNavigate();
  const interests: string[] = (profile?.areas as string[]) || [];
  const [solutions, setSolutions] = useState<Row[]>([]);
  const [reviews, setReviews] = useState<Row[]>([]);
  const [hrefs, setHrefs] = useState<Record<string, string>>({});

  useEffect(() => {
    const isProvas = productKey === "provas";
    const byProduct = (q: any) =>
      isProvas ? q.or(`product_keys.cs.{provas},product_keys.eq.{}`) : q.contains("product_keys", [productKey]);
    const toRow = (l: any, prefix: string): Row => ({
      video: {
        id: l.id, title: l.title, description: l.description || "",
        thumbnail: l.carousel_cover_url || l.thumbnail_url || "/placeholder.svg",
        duration: "", category: (l.areas || [])[0] || "", instructor: "", lessons: 1,
        productKeys: l.product_keys || [],
      } as any,
      href: `${prefix}/${l.id}`, areas: l.areas || [],
    });
    const sortByInterest = (rows: Row[]) => {
      const hit = (r: Row) => r.areas.some((a) => interests.includes(a));
      return [...rows.filter(hit), ...rows.filter((r) => !hit(r))];
    };
    (async () => {
      const base = "id,title,description,thumbnail_url,carousel_cover_url,areas,product_keys";
      const [sol, les, ai] = await Promise.all([
        byProduct(supabase.from("exam_solutions").select(base).eq("published", true).eq("admin_approved", true)).order("created_at", { ascending: false }).limit(30),
        byProduct(supabase.from("lessons").select(base).eq("published", true).eq("admin_approved", true)).order("created_at", { ascending: false }).limit(30),
        (isProvas
          ? supabase.from("ai_canonical_contents").select("id,assunto,disciplina,areas,product_keys").or("product_keys.cs.{provas},product_keys.eq.{}")
          : supabase.from("ai_canonical_contents").select("id,assunto,disciplina,areas,product_keys").contains("product_keys", [productKey])
        ).eq("status", "ready").order("hits", { ascending: false }).limit(30),
      ]);
      const aiRows: Row[] = ((ai.data as any[]) || []).map((c) => ({
        video: { id: c.id, title: c.assunto, description: c.disciplina || "", thumbnail: "/placeholder.svg", duration: "", category: c.disciplina || "", instructor: "Professor virtual", lessons: 1, productKeys: c.product_keys || [] } as any,
        href: `/conteudo-ia/${c.id}`, areas: c.areas || [],
      }));
      const s = sortByInterest(((sol.data as any[]) || []).map((l) => toRow(l, "/video")));
      const r = [...sortByInterest(((les.data as any[]) || []).map((l) => toRow(l, "/video"))), ...sortByInterest(aiRows)];
      setSolutions(s);
      setReviews(r);
      const map: Record<string, string> = {};
      [...s, ...r].forEach((x) => (map[x.video.id] = x.href));
      setHrefs(map);
    })();
  }, [productKey, interests.join(",")]);

  const go = (id: string) => navigate(hrefs[id] || `/video/${id}`);
  if (!solutions.length && !reviews.length) return null;
  return (
    <div className="space-y-8 py-8">
      {solutions.length > 0 && <VideoCarousel title="Resolução de Provas" videos={solutions.map((x) => x.video)} onVideoClick={go} />}
      {reviews.length > 0 && <VideoCarousel title="Revisões de Conteúdo" videos={reviews.map((x) => x.video)} onVideoClick={go} />}
    </div>
  );
}
