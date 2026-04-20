import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { CheckCircle, XCircle, FileText, ClipboardList, Trophy, StickyNote, Eye, AlertCircle, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SimuladoModal from "@/components/SimuladoModal";
import ColinhaFlashcardModal from "@/components/ColinhaFlashcardModal";

interface Props {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  onChanged?: () => void;
}

interface MaterialMeta {
  id: string;
  material_type: "resumo" | "simulado" | "top_questoes" | "colinhas";
  offered: boolean;
  admin_approved: boolean;
  submitted_for_review: boolean;
  rejection_reason: string | null;
}

interface LessonInfo {
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  position: number;
}

interface TopQuestion {
  id: string;
  question: string;
  answer: string;
  position: number;
}

interface PreviewData {
  resumo: string;
  simulado: QuizQuestion[];
  top_questoes: TopQuestion[];
  colinhas: string[];
}

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  resumo: { label: "Resumo", icon: FileText },
  simulado: { label: "Simulado", icon: ClipboardList },
  top_questoes: { label: "Top Questões", icon: Trophy },
  colinhas: { label: "Colinha", icon: StickyNote },
};

const EMPTY_PREVIEW: PreviewData = { resumo: "", simulado: [], top_questoes: [], colinhas: [] };

const MaterialPreview = ({ type, data }: { type: MaterialMeta["material_type"]; data: PreviewData }) => {
  if (type === "resumo") {
    return data.resumo ? (
      <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
        {data.resumo}
      </p>
    ) : (
      <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" /> Resumo vazio
      </p>
    );
  }
  if (type === "simulado") {
    return data.simulado.length > 0 ? (
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {data.simulado.map((q, i) => (
          <div key={q.id} className="rounded border border-border bg-background/50 p-2">
            <p className="text-xs font-medium text-foreground mb-1.5">Q{i + 1}. {q.question}</p>
            <ul className="space-y-0.5 pl-3">
              {q.options.map((opt, oi) => (
                <li
                  key={oi}
                  className={`text-[11px] ${oi === q.correct_index ? "text-green-600 dark:text-green-400 font-semibold" : "text-muted-foreground"}`}
                >
                  {String.fromCharCode(65 + oi)}. {opt} {oi === q.correct_index && "✓"}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" /> Nenhuma questão cadastrada
      </p>
    );
  }
  if (type === "top_questoes") {
    return data.top_questoes.length > 0 ? (
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {data.top_questoes.map((q, i) => (
          <div key={q.id} className="rounded border border-border bg-background/50 p-2">
            <p className="text-xs font-medium text-foreground mb-1">Q{i + 1}. {q.question}</p>
            <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{q.answer}</p>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" /> Nenhuma top questão
      </p>
    );
  }
  // colinhas
  return data.colinhas.length > 0 ? (
    <ul className="space-y-1 max-h-72 overflow-y-auto">
      {data.colinhas.map((b, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
          <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
      <AlertCircle className="h-3 w-3" /> Nenhuma colinha cadastrada
    </p>
  );
};

const MaterialReviewDrawer = ({ open, onClose, lessonId, lessonTitle, onChanged }: Props) => {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const [metas, setMetas] = useState<MaterialMeta[]>([]);
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [preview, setPreview] = useState<PreviewData>(EMPTY_PREVIEW);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<MaterialMeta | null>(null);
  const [reason, setReason] = useState("");
  const [testingMaterial, setTestingMaterial] = useState<"simulado" | "colinhas" | null>(null);

  const load = async () => {
    setLoading(true);
    const [metaRes, lessonRes, sumRes, quizRes, topRes, cheatRes] = await Promise.all([
      supabase
        .from("lesson_material_meta")
        .select("id, material_type, offered, admin_approved, submitted_for_review, rejection_reason")
        .eq("lesson_id", lessonId),
      supabase
        .from("lessons")
        .select("description, video_url, thumbnail_url")
        .eq("id", lessonId)
        .maybeSingle(),
      supabase.from("lesson_summaries").select("content").eq("lesson_id", lessonId).maybeSingle(),
      supabase
        .from("lesson_quiz_questions")
        .select("id, question, options, correct_index, position")
        .eq("lesson_id", lessonId)
        .order("position", { ascending: true }),
      supabase
        .from("lesson_top_questions")
        .select("id, question, answer, position")
        .eq("lesson_id", lessonId)
        .order("position", { ascending: true }),
      supabase
        .from("lesson_cheatsheet_items")
        .select("text, position")
        .eq("lesson_id", lessonId)
        .order("position", { ascending: true }),
    ]);

    setMetas((metaRes.data || []) as MaterialMeta[]);
    setLesson((lessonRes.data as LessonInfo) || null);
    setPreview({
      resumo: sumRes.data?.content || "",
      simulado: (quizRes.data || []).map((q: any) => ({
        id: q.id,
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correct_index: q.correct_index ?? 0,
        position: q.position,
      })),
      top_questoes: (topRes.data || []) as TopQuestion[],
      colinhas: (cheatRes.data || []).map((d: any) => d.text),
    });
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lessonId]);

  const handleApprove = async (meta: MaterialMeta) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("lesson_material_meta")
      .update({
        admin_approved: true,
        submitted_for_review: false,
        rejection_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userRes.user?.id,
      })
      .eq("id", meta.id);
    if (error) { toast({ title: "Erro", description: "Não foi possível aprovar.", variant: "destructive" }); return; }
    await logAction("material_approved", { targetTable: "lesson_material_meta", targetId: meta.id, metadata: { lesson_id: lessonId, material_type: meta.material_type } });
    toast({ title: "Aprovado", description: `${TYPE_LABELS[meta.material_type].label} aprovado.` });
    load();
    onChanged?.();
  };

  const confirmReject = async () => {
    if (!rejecting || !reason.trim()) return;
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("lesson_material_meta")
      .update({
        admin_approved: false,
        submitted_for_review: false,
        rejection_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: userRes.user?.id,
      })
      .eq("id", rejecting.id);
    if (error) { toast({ title: "Erro", description: "Não foi possível rejeitar.", variant: "destructive" }); return; }
    await logAction("material_rejected", { targetTable: "lesson_material_meta", targetId: rejecting.id, metadata: { lesson_id: lessonId, material_type: rejecting.material_type, reason } });
    toast({ title: "Rejeitado", description: `${TYPE_LABELS[rejecting.material_type].label} rejeitado.` });
    setRejecting(null);
    setReason("");
    load();
    onChanged?.();
  };

  const offered = metas.filter((m) => m.offered);

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent className="w-full sm:max-w-5xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="pr-8">Materiais de "{lessonTitle}"</SheetTitle>
          </SheetHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground mt-6">Carregando...</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
              {/* Coluna esquerda: vídeo + ações */}
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-border bg-muted">
                  {lesson?.video_url ? (
                    <video
                      src={lesson.video_url}
                      poster={lesson.thumbnail_url || undefined}
                      controls
                      className="w-full aspect-video bg-black"
                    />
                  ) : lesson?.thumbnail_url ? (
                    <img src={lesson.thumbnail_url} alt={lessonTitle} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-xs text-muted-foreground">
                      Sem vídeo
                    </div>
                  )}
                </div>
                {lesson?.description && (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Descrição</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{lesson.description}</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate(`/video/${lessonId}`)}>
                  <Eye className="h-4 w-4" /> Abrir página da aula
                </Button>
              </div>

              {/* Coluna direita: prévia dos materiais */}
              <div className="space-y-3">
                {offered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum material oferecido pelo professor nesta aula.</p>
                ) : (
                  offered.map((m) => {
                    const cfg = TYPE_LABELS[m.material_type] || { label: m.material_type, icon: FileText };
                    const Icon = cfg.icon;
                    const isPending = m.submitted_for_review && !m.admin_approved;
                    return (
                      <div key={m.id} className={`rounded-lg border bg-card p-3 space-y-3 ${isPending ? 'border-amber-500 ring-1 ring-amber-500/20' : 'border-border'}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">{cfg.label}</span>
                          </div>
                          {m.admin_approved ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-xs">Aprovado</Badge>
                          ) : m.submitted_for_review ? (
                            <Badge variant="outline" className="border-accent/30 text-accent text-xs">Pendente</Badge>
                          ) : m.rejection_reason ? (
                            <Badge variant="outline" className="border-destructive/30 text-destructive text-xs">Rejeitado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">Não revisado</Badge>
                          )}
                        </div>

                        {/* Prévia visual do conteúdo */}
                        <div className="rounded-md border border-border/60 bg-secondary/20 p-2.5">
                          <MaterialPreview type={m.material_type} data={preview} />
                        </div>

                        {m.rejection_reason && !m.admin_approved && (
                          <p className="text-[11px] text-destructive">Motivo da rejeição: {m.rejection_reason}</p>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {(m.material_type === "simulado" || m.material_type === "colinhas") && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setTestingMaterial(m.material_type as "simulado" | "colinhas")}>
                              <Play className="h-3.5 w-3.5 mr-1" /> Testar como aluno
                            </Button>
                          )}
                          {!m.admin_approved && (
                            <Button size="sm" variant="ghost" className="h-8 text-green-600 dark:text-green-400 hover:text-green-500" onClick={() => handleApprove(m)}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => { setRejecting(m); setReason(m.rejection_reason || ""); }}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!rejecting} onOpenChange={(v) => { if (!v) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar material</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o motivo da rejeição de <strong>{rejecting && TYPE_LABELS[rejecting.material_type]?.label}</strong>.
          </p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Descreva o motivo..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={!reason.trim()} onClick={confirmReject}>Confirmar Rejeição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SimuladoModal
        open={testingMaterial === "simulado"}
        onClose={() => setTestingMaterial(null)}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
      />
      <ColinhaFlashcardModal
        open={testingMaterial === "colinhas"}
        onClose={() => setTestingMaterial(null)}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
      />
    </>
  );
};

export default MaterialReviewDrawer;
