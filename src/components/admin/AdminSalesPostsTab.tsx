import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Megaphone, Trash2, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SalesPost {
  id: string;
  teacher_id: string;
  template: string;
  caption: string;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  contents: any;
  created_at: string;
}

interface TeacherInfo {
  user_id: string;
  name: string;
  slug: string | null;
}

const TEMPLATE_LABEL: Record<string, string> = {
  light: "Claro",
  dark: "Escuro",
  colorful: "Colorido",
};

const AdminSalesPostsTab = () => {
  const [posts, setPosts] = useState<SalesPost[]>([]);
  const [teachers, setTeachers] = useState<Record<string, TeacherInfo>>({});
  const [loading, setLoading] = useState(true);
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const { data: postsData, error } = await supabase
      .from("teacher_sales_posts")
      .select("id, teacher_id, template, caption, thumbnail_url, thumbnail_path, contents, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar posts");
      setLoading(false);
      return;
    }

    const list = (postsData ?? []) as SalesPost[];
    setPosts(list);

    const ids = Array.from(new Set(list.map((p) => p.teacher_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, slug")
        .in("user_id", ids);
      const map: Record<string, TeacherInfo> = {};
      (profs ?? []).forEach((p) => {
        map[p.user_id] = { user_id: p.user_id, name: p.name, slug: p.slug };
      });
      setTeachers(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const teacherOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: TeacherInfo[] = [];
    posts.forEach((p) => {
      if (!seen.has(p.teacher_id) && teachers[p.teacher_id]) {
        seen.add(p.teacher_id);
        opts.push(teachers[p.teacher_id]);
      }
    });
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [posts, teachers]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (teacherFilter !== "all" && p.teacher_id !== teacherFilter) return false;
      if (templateFilter !== "all" && p.template !== templateFilter) return false;
      return true;
    });
  }, [posts, teacherFilter, templateFilter]);

  const totalsByTeacher = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach((p) => map.set(p.teacher_id, (map.get(p.teacher_id) ?? 0) + 1));
    return map;
  }, [posts]);

  const handleDelete = async (post: SalesPost) => {
    if (!confirm("Excluir este post permanentemente?")) return;
    const { error } = await supabase.from("teacher_sales_posts").delete().eq("id", post.id);
    if (error) {
      toast.error("Erro ao excluir post");
      return;
    }
    if (post.thumbnail_path) {
      await supabase.storage.from("sales-post-thumbnails").remove([post.thumbnail_path]);
    }
    toast.success("Post excluído");
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Posts de Divulgação</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Posts criados pelos professores na funcionalidade "Buscar Vendas".
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="text-xs text-muted-foreground">Total de posts</div>
          <div className="text-2xl font-bold">{posts.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="text-xs text-muted-foreground">Professores ativos</div>
          <div className="text-2xl font-bold">{totalsByTeacher.size}</div>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="text-xs text-muted-foreground">Filtrados</div>
          <div className="text-2xl font-bold">{filtered.length}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Professor</label>
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os professores</SelectItem>
              {teacherOptions.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>
                  {t.name} ({totalsByTeacher.get(t.user_id) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-48">
          <label className="text-xs text-muted-foreground mb-1 block">Template</label>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
              <SelectItem value="colorful">Colorido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum post encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => {
            const teacher = teachers[post.teacher_id];
            const itemCount = Array.isArray(post.contents) ? post.contents.length : 0;
            return (
              <div key={post.id} className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
                {post.thumbnail_url ? (
                  <a href={post.thumbnail_url} target="_blank" rel="noreferrer" className="block aspect-square bg-muted">
                    <img src={post.thumbnail_url} alt="Post" className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <div className="aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    Sem miniatura
                  </div>
                )}
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{teacher?.name ?? "Professor removido"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide rounded bg-secondary px-2 py-1 shrink-0">
                      {TEMPLATE_LABEL[post.template] ?? post.template}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "conteúdo" : "conteúdos"}
                  </div>
                  <div className="flex gap-2 mt-auto pt-2">
                    {teacher?.slug && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={`/professor/${teacher.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Perfil
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(post)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSalesPostsTab;
