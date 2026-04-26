import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Video, Star, ArrowLeft, Eye, Pencil, Save, X, Upload, Loader2, Plus, Trash2, Briefcase, GraduationCap, Clock, GripVertical, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Experience { role: string; org: string; period?: string }
interface Education { course: string; institution: string; year?: string }

interface TeacherData {
  name: string;
  avatar_url: string | null;
  bio: string | null;
  expertise_area: string | null;
  profile_title: string | null;
  user_id: string;
  experiences: Experience[];
  education: Education[];
  content_order: string[];
}

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  areas: string[] | null;
  type: "lesson" | "exam_solution";
}

const emptyDraft = {
  name: "",
  profile_title: "",
  expertise_area: "",
  bio: "",
  avatar_url: "",
  experiences: [] as Experience[],
  education: [] as Education[],
  content_order: [] as string[],
};

const TeacherProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [hasPending, setHasPending] = useState(false);
  const [pendingReason, setPendingReason] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [orderDraft, setOrderDraft] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchTeacher = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url, bio, expertise_area, profile_title, user_id, experiences, education, content_order")
        .eq("slug", slug)
        .maybeSingle();

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const experiences = Array.isArray(profile.experiences) ? (profile.experiences as unknown as Experience[]) : [];
      const education = Array.isArray(profile.education) ? (profile.education as unknown as Education[]) : [];
      const content_order = Array.isArray((profile as any).content_order) ? ((profile as any).content_order as string[]) : [];
      const teacherData: TeacherData = { ...profile, experiences, education, content_order };
      setTeacher(teacherData);
      setDraft({
        name: profile.name || "",
        profile_title: profile.profile_title || "",
        expertise_area: profile.expertise_area || "",
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || "",
        experiences,
        education,
        content_order,
      });

      // pending approval check (visible only to owner)
      if (user?.id === profile.user_id) {
        const { data: pend } = await supabase
          .from("teacher_profile_change_requests")
          .select("id, status")
          .eq("teacher_id", profile.user_id)
          .eq("status", "pending")
          .maybeSingle();
        setHasPending(!!pend);

        const { data: lastRej } = await supabase
          .from("teacher_profile_change_requests")
          .select("rejection_reason, status, created_at")
          .eq("teacher_id", profile.user_id)
          .eq("status", "rejected")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setPendingReason(lastRej?.rejection_reason || null);
      }

      const [lessonsRes, examsRes] = await Promise.all([
        supabase.from("lessons").select("id, title, description, thumbnail_url, areas").eq("teacher_id", profile.user_id).eq("published", true).eq("admin_approved", true).order("created_at", { ascending: false }),
        supabase.from("exam_solutions").select("id, title, description, thumbnail_url, areas").eq("teacher_id", profile.user_id).eq("published", true).eq("admin_approved", true).order("created_at", { ascending: false }),
      ]);
      const lessons: ContentItem[] = (lessonsRes.data || []).map((l) => ({ ...l, type: "lesson" as const }));
      const exams: ContentItem[] = (examsRes.data || []).map((e) => ({ ...e, type: "exam_solution" as const }));
      const allContent = [...lessons, ...exams];
      // Apply persisted order if available; unknown items go to the end
      const orderMap = new Map(content_order.map((id, idx) => [id, idx]));
      const ordered = [...allContent].sort((a, b) => {
        const ai = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
        const bi = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
      setContent(ordered);

      const contentIds = allContent.map((c) => c.id);
      if (contentIds.length > 0) {
        const [viewsRes, ratingsRes] = await Promise.all([
          supabase.from("video_views").select("id", { count: "exact", head: true }).in("content_id", contentIds),
          supabase.from("video_ratings").select("rating").in("content_id", contentIds),
        ]);
        setTotalViews(viewsRes.count || 0);
        const ratings = ratingsRes.data || [];
        setRatingCount(ratings.length);
        if (ratings.length > 0) {
          setAvgRating(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length);
        }
      }

      setLoading(false);
    };
    fetchTeacher();
  }, [slug, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !teacher) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center pt-20 px-6 gap-4">
          <h1 className="text-2xl font-display font-bold">Professor não encontrado</h1>
          <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const expertiseList = teacher.expertise_area?.split(", ").filter(Boolean) || [];
  const isOwner = !!user && user.id === teacher.user_id;
  // Hard guard: edição só existe se for o dono. Caso contrário, qualquer estado de edição é forçado a falso.
  const editing = isOwner && isEditing;

  const startReorder = () => {
    if (!isOwner) return;
    setOrderDraft(content.map((c) => c.id));
    setReordering(true);
  };

  const cancelReorder = () => {
    setReordering(false);
    setOrderDraft([]);
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setOrderDraft((curr) => {
      const from = curr.indexOf(dragId);
      const to = curr.indexOf(overId);
      if (from < 0 || to < 0) return curr;
      const next = [...curr];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const handleDragEnd = () => setDragId(null);

  const moveItem = (id: string, dir: -1 | 1) => {
    setOrderDraft((curr) => {
      const i = curr.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= curr.length) return curr;
      const next = [...curr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const saveOrder = async () => {
    if (!user || !isOwner) {
      toast({ title: "Ação não permitida", variant: "destructive" });
      return;
    }
    setSavingOrder(true);
    const { error } = await supabase.from("teacher_profile_change_requests").insert({
      teacher_id: user.id,
      proposed: { content_order: orderDraft },
      status: "pending",
    } as never);
    setSavingOrder(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    setHasPending(true);
    setReordering(false);
    toast({ title: "Nova ordem enviada para aprovação", description: "O administrador irá revisar antes de publicar." });
  };

  const reorderedContent = reordering
    ? orderDraft.map((id) => content.find((c) => c.id === id)).filter(Boolean) as ContentItem[]
    : content;

  // Compute "before/after" diff for the preview
  const originalOrderIds = content.map((c) => c.id);
  const proposedOrderIds = orderDraft;
  const orderChanged = originalOrderIds.join("|") !== proposedOrderIds.join("|");
  const originalIndexById = new Map(originalOrderIds.map((id, i) => [id, i]));
  const proposedIndexById = new Map(proposedOrderIds.map((id, i) => [id, i]));

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!isOwner) {
      toast({ title: "Ação não permitida", description: "Você não é o dono desta página.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setDraft((d) => ({ ...d, avatar_url: pub.publicUrl }));
      toast({ title: "Foto carregada", description: "Salve para enviar para aprovação." });
    } catch (err) {
      toast({ title: "Falha no upload", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user || !teacher) return;
    if (!isOwner) {
      toast({ title: "Ação não permitida", description: "Você não é o dono desta página.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const proposed: Record<string, unknown> = {
      name: draft.name.trim(),
      profile_title: draft.profile_title.trim(),
      expertise_area: draft.expertise_area.trim(),
      bio: draft.bio.trim(),
      avatar_url: draft.avatar_url.trim(),
      experiences: draft.experiences.filter((x) => x.role.trim() || x.org.trim()),
      education: draft.education.filter((x) => x.course.trim() || x.institution.trim()),
    };
    const { error } = await supabase.from("teacher_profile_change_requests").insert({
      teacher_id: user.id,
      proposed,
      status: "pending",
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    setHasPending(true);
    setIsEditing(false);
    toast({ title: "Enviado para aprovação", description: "Suas alterações serão revisadas pelo administrador." });
  };

  const handleCancel = () => {
    if (!teacher) return;
    setDraft({
      name: teacher.name || "",
      profile_title: teacher.profile_title || "",
      expertise_area: teacher.expertise_area || "",
      bio: teacher.bio || "",
      avatar_url: teacher.avatar_url || "",
      experiences: teacher.experiences,
      education: teacher.education,
      content_order: teacher.content_order,
    });
    setIsEditing(false);
  };

  const updateExp = (i: number, key: keyof Experience, value: string) => {
    setDraft((d) => {
      const arr = [...d.experiences];
      arr[i] = { ...arr[i], [key]: value };
      return { ...d, experiences: arr };
    });
  };
  const updateEdu = (i: number, key: keyof Education, value: string) => {
    setDraft((d) => {
      const arr = [...d.education];
      arr[i] = { ...arr[i], [key]: value };
      return { ...d, education: arr };
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <div className="flex-1 pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          {isOwner && (
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
              {hasPending && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" /> Aguardando aprovação do administrador
                </Badge>
              )}
              {!editing ? (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={hasPending}>
                  <Pencil className="h-3.5 w-3.5" /> Editar Minha Página
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Enviar para aprovação
                  </Button>
                </>
              )}
            </div>
          )}

          {isOwner && pendingReason && !hasPending && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
              <strong>Última edição rejeitada:</strong> {pendingReason}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border-2 border-primary/20 relative group">
              {(editing ? draft.avatar_url : teacher.avatar_url) ? (
                <img src={(editing ? draft.avatar_url : teacher.avatar_url) || ""} alt={teacher.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{teacher.name.charAt(0)}</span>
              )}
              {editing && (
                <label className="absolute inset-0 flex items-center justify-center bg-background/70 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
              )}
            </div>
            <div className="text-center sm:text-left space-y-2 flex-1 w-full">
              {editing ? (
                <div className="space-y-2 text-left">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={100} />
                  </div>
                  <div>
                    <Label className="text-xs">Áreas de atuação (separadas por vírgula)</Label>
                    <Input value={draft.expertise_area} onChange={(e) => setDraft((d) => ({ ...d, expertise_area: e.target.value }))} maxLength={200} placeholder="Direito, Administração" />
                  </div>
                  <div>
                    <Label className="text-xs">Biografia</Label>
                    <Textarea rows={3} maxLength={1000} value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold">{teacher.name}</h1>
                  {expertiseList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                      {expertiseList.map((area) => (
                        <span key={area} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5">{area}</span>
                      ))}
                    </div>
                  )}
                  {teacher.bio && <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{teacher.bio}</p>}
                </>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center sm:justify-start">
                <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />{content.length} conteúdo{content.length !== 1 ? "s" : ""}</span>
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{totalViews.toLocaleString("pt-BR")} visualizações</span>
                {ratingCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                    {avgRating.toFixed(1)} ({ratingCount})
                  </span>
                )}
              </div>
            </div>
          </div>

          {editing ? (
            <div className="mb-8 max-w-xl mx-auto">
              <Label className="text-xs">Título da página</Label>
              <Input value={draft.profile_title} onChange={(e) => setDraft((d) => ({ ...d, profile_title: e.target.value }))} maxLength={150} placeholder="Ex.: Aulas de Direito Constitucional" />
            </div>
          ) : (
            teacher.profile_title && (
              <h2 className="font-display text-xl sm:text-2xl font-bold text-center mb-8 text-foreground">{teacher.profile_title}</h2>
            )
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Conteúdos do Professor</h2>
            {isOwner && content.length > 1 && (
              !reordering ? (
                <Button size="sm" variant="outline" onClick={startReorder} disabled={hasPending}>
                  <ArrowUpDown className="h-3.5 w-3.5" /> Reordenar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={cancelReorder} disabled={savingOrder}>
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} disabled={savingOrder}>
                    <Eye className="h-3.5 w-3.5" /> Prévia
                  </Button>
                  <Button size="sm" onClick={saveOrder} disabled={savingOrder}>
                    {savingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Enviar para aprovação
                  </Button>
                </div>
              )
            )}
          </div>
          {reordering && (
            <p className="text-xs text-muted-foreground mb-3">
              Arraste os cartões para reordenar (ou use as setas). Use <strong>Prévia</strong> para comparar antes/depois. A nova ordem só será publicada após aprovação do administrador.
            </p>
          )}

          {reorderedContent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum conteúdo publicado ainda.</p>
          ) : reordering ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {reorderedContent.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl border-2 border-dashed bg-secondary/30 overflow-hidden cursor-move transition-opacity ${dragId === item.id ? "opacity-40 border-primary" : "border-border"}`}
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 text-[10px] bg-primary text-primary-foreground rounded px-1.5 py-0.5 font-bold">
                      #{idx + 1}
                    </span>
                    <span className="absolute top-2 right-2 text-[10px] bg-background/80 text-foreground rounded px-1.5 py-0.5 font-medium">
                      {item.type === "lesson" ? "Aula" : "Resolução"}
                    </span>
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="text-sm font-semibold line-clamp-1 flex-1">{item.title}</h3>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="text-xs px-1.5 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => moveItem(item.id, 1)} disabled={idx === reorderedContent.length - 1} className="text-xs px-1.5 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-30">↓</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {reorderedContent.map((item) => (
                <Link
                  key={item.id}
                  to={`/video/${item.id}`}
                  className="group rounded-xl border border-border bg-secondary/30 overflow-hidden hover:border-primary/30 transition-colors"
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 text-[10px] bg-background/80 text-foreground rounded px-1.5 py-0.5 font-medium">
                      {item.type === "lesson" ? "Aula" : "Resolução"}
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                    {item.areas && item.areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.areas.slice(0, 2).map((a) => (
                          <span key={a} className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Experience & Education */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Experiences */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-primary" />
                <h3 className="font-display font-semibold">Experiência Profissional</h3>
              </div>
              {editing ? (
                <div className="space-y-3">
                  {draft.experiences.map((exp, i) => (
                    <div key={i} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, experiences: d.experiences.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input placeholder="Cargo / Função" maxLength={120} value={exp.role} onChange={(e) => updateExp(i, "role", e.target.value)} />
                      <Input placeholder="Empresa / Instituição" maxLength={120} value={exp.org} onChange={(e) => updateExp(i, "org", e.target.value)} />
                      <Input placeholder="Período (ex.: 2018 - 2022)" maxLength={60} value={exp.period || ""} onChange={(e) => updateExp(i, "period", e.target.value)} />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, experiences: [...d.experiences, { role: "", org: "", period: "" }] }))}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar experiência
                  </Button>
                </div>
              ) : teacher.experiences.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma experiência informada.</p>
              ) : (
                <ul className="space-y-3">
                  {teacher.experiences.map((exp, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium">{exp.role}</p>
                      <p className="text-muted-foreground text-xs">
                        {exp.org}{exp.period ? ` · ${exp.period}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Education */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h3 className="font-display font-semibold">Formação Acadêmica</h3>
              </div>
              {editing ? (
                <div className="space-y-3">
                  {draft.education.map((ed, i) => (
                    <div key={i} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, education: d.education.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input placeholder="Curso / Titulação" maxLength={120} value={ed.course} onChange={(e) => updateEdu(i, "course", e.target.value)} />
                      <Input placeholder="Instituição" maxLength={120} value={ed.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} />
                      <Input placeholder="Ano de conclusão" maxLength={20} value={ed.year || ""} onChange={(e) => updateEdu(i, "year", e.target.value)} />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, education: [...d.education, { course: "", institution: "", year: "" }] }))}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar formação
                  </Button>
                </div>
              ) : teacher.education.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma formação informada.</p>
              ) : (
                <ul className="space-y-3">
                  {teacher.education.map((ed, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium">{ed.course}</p>
                      <p className="text-muted-foreground text-xs">
                        {ed.institution}{ed.year ? ` · ${ed.year}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>

      <Footer />

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia da nova ordem</DialogTitle>
            <DialogDescription>
              Compare a ordem atual (publicada) com a nova ordem que será enviada para aprovação do administrador.
              {!orderChanged && " Nenhuma alteração detectada."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Antes */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Antes (atual)</p>
              <ol className="space-y-1.5">
                {originalOrderIds.map((id, idx) => {
                  const item = content.find((c) => c.id === id);
                  if (!item) return null;
                  const newIdx = proposedIndexById.get(id);
                  const moved = newIdx !== undefined && newIdx !== idx;
                  return (
                    <li key={id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${moved ? "bg-destructive/10 text-destructive-foreground/90" : ""}`}>
                      <span className="text-[10px] font-bold w-6 text-muted-foreground">#{idx + 1}</span>
                      <span className="flex-1 line-clamp-1">{item.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{item.type === "lesson" ? "Aula" : "Resolução"}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Depois */}
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
              <p className="text-[10px] uppercase tracking-wide text-primary mb-2">Depois (proposta)</p>
              <ol className="space-y-1.5">
                {proposedOrderIds.map((id, idx) => {
                  const item = content.find((c) => c.id === id);
                  if (!item) return null;
                  const oldIdx = originalIndexById.get(id);
                  const moved = oldIdx !== undefined && oldIdx !== idx;
                  const direction = moved && (oldIdx as number) > idx ? "↑" : moved ? "↓" : "";
                  return (
                    <li key={id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${moved ? "bg-primary/15 font-medium" : ""}`}>
                      <span className="text-[10px] font-bold w-6 text-primary">#{idx + 1}</span>
                      <span className="flex-1 line-clamp-1">{item.title}</span>
                      {moved && (
                        <span className="text-[10px] text-primary shrink-0">
                          {direction} de #{(oldIdx as number) + 1}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground shrink-0">{item.type === "lesson" ? "Aula" : "Resolução"}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setShowPreview(false)}>
              Continuar editando
            </Button>
            <Button
              onClick={async () => { setShowPreview(false); await saveOrder(); }}
              disabled={!orderChanged || savingOrder}
            >
              {savingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Confirmar e enviar para aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherProfile;
