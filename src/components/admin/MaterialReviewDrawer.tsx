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
  carousel_cover_url: string | null;
}

interface WatermarkPreviewInfo {
  enabled: boolean;
  text: string;
  logoUrl: string;
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

/**
 * Overlay da marca d'água renderizado sobre uma "tela" de proporção fixa (16:9),
 * usando unidades relativas ao container (cqw/cqh) para garantir que a posição
 * e o tamanho sejam idênticos independentemente da resolução da imagem de origem.
 * Espelha o cálculo aplicado no compositor de vídeo (drawWatermark): canto
 * inferior direito, padding ≈ 2% do menor lado, altura base ≈ 6% da altura.
 */
const WatermarkOverlay = ({ text, logoUrl }: { text: string; logoUrl: string }) => {
  if (!text && !logoUrl) return null;
  return (
    <div
      data-testid="watermark-overlay"
      className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 via-transparent to-transparent"
      style={{ containerType: "size" } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-[1.2cqw]"
        style={{
          // Padding ≈ 2% do menor lado (em 16:9, cqh é o menor → 2cqh).
          paddingRight: "2cqh",
          paddingBottom: "2cqh",
          // Altura base ≈ 6% da altura do container.
          height: "6cqh",
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo da plataforma"
            data-testid="watermark-logo"
            className="h-full w-auto opacity-90 drop-shadow object-contain"
            onError={(e) => { (e.currentTarget.style.display = 'none'); }}
          />
        )}
        {text && (
          <span
            data-testid="watermark-text"
            className="font-semibold text-white whitespace-nowrap leading-none [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]"
            style={{ fontSize: "2.7cqh" }}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Wrapper de capa com overlay padronizado. A imagem é exibida em um quadro
 * 16:9 fixo com object-cover, garantindo que o overlay (também 16:9) ocupe
 * exatamente a mesma região visual em todas as capas, mesmo quando a imagem
 * original tem proporção diferente. Isso evita que capas verticais ou
 * quadradas produzam marca d'água em posição/tamanho inconsistente.
 */
const CoverWithWatermark = ({
  src,
  alt,
  watermark,
}: {
  src: string;
  alt: string;
  watermark: { enabled: boolean; text: string; logoUrl: string };
}) => {
  const showWatermark = watermark.enabled && (watermark.text || watermark.logoUrl);
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      data-testid="cover-with-watermark"
      className="relative block rounded-md overflow-hidden border border-border bg-muted hover:opacity-90 aspect-video w-full"
    >
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {showWatermark && <WatermarkOverlay text={watermark.text} logoUrl={watermark.logoUrl} />}
    </a>
  );
};

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
  const [watermark, setWatermark] = useState<WatermarkPreviewInfo>({ enabled: true, text: "", logoUrl: "" });

  const load = async () => {
    setLoading(true);
    const [metaRes, lessonRes, sumRes, quizRes, topRes, cheatRes, settingsRes] = await Promise.all([
      supabase
        .from("lesson_material_meta")
        .select("id, material_type, offered, admin_approved, submitted_for_review, rejection_reason")
        .eq("lesson_id", lessonId),
      supabase
        .from("lessons")
        .select("description, video_url, thumbnail_url, carousel_cover_url")
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
      supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["product_config", "branding"]),
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

    const settingsRows = (settingsRes.data || []) as Array<{ key: string; value: any }>;
    const productCfg = settingsRows.find((r) => r.key === "product_config")?.value || {};
    const branding = settingsRows.find((r) => r.key === "branding")?.value || {};
    setWatermark({
      enabled: productCfg?.enable_watermark !== false,
      text: branding?.platform_name || "",
      logoUrl: branding?.logo_url || "",
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
  const pendingMaterials = offered.filter((m) => m.submitted_for_review && !m.admin_approved);

  const handleApproveAll = async () => {
    if (pendingMaterials.length === 0) return;
    const { data: userRes } = await supabase.auth.getUser();
    const updates = pendingMaterials.map((meta) =>
      supabase
        .from("lesson_material_meta")
        .update({
          admin_approved: true,
          submitted_for_review: false,
          rejection_reason: null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userRes.user?.id,
        })
        .eq("id", meta.id)
    );
    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      toast({ title: "Erro", description: `Falha ao aprovar ${errors.length} material(is).`, variant: "destructive" });
    } else {
      await logAction("material_approved_all", { targetTable: "lesson_material_meta", metadata: { lesson_id: lessonId, count: pendingMaterials.length } });
      toast({ title: "Todos aprovados", description: `${pendingMaterials.length} material(is) aprovado(s).` });
    }
    load();
    onChanged?.();
  };

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
                {/* Capas para revisão (com prévia idêntica da marca d'água) */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Capas para aprovação</p>
                    {watermark.enabled && (watermark.text || watermark.logoUrl) ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-[10px]">Marca d'água ativa</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">Sem marca d'água</Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Capa do vídeo (thumbnail)</p>
                      {lesson?.thumbnail_url ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-[10px]">Enviada</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">Ausente</Badge>
                      )}
                    </div>
                    {lesson?.thumbnail_url ? (
                      <CoverWithWatermark src={lesson.thumbnail_url} alt="Capa do vídeo" watermark={watermark} />
                    ) : (
                      <div className="aspect-video rounded-md border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
                        Sem capa do vídeo
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Capa do carrossel</p>
                      {lesson?.carousel_cover_url ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-[10px]">Enviada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">Não enviada</Badge>
                      )}
                    </div>
                    {lesson?.carousel_cover_url ? (
                      <CoverWithWatermark src={lesson.carousel_cover_url} alt="Capa do carrossel" watermark={watermark} />
                    ) : lesson?.thumbnail_url ? (
                      <>
                        <CoverWithWatermark src={lesson.thumbnail_url} alt="Capa do carrossel (fallback)" watermark={watermark} />
                        <p className="text-[10px] text-muted-foreground italic">
                          Sem capa específica para o carrossel — usará a capa do vídeo (prévia acima).
                        </p>
                      </>
                    ) : (
                      <div className="aspect-video rounded-md border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
                        Capa do carrossel não enviada.
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {watermark.enabled && (watermark.text || watermark.logoUrl)
                      ? "A marca d'água sobreposta nas capas acima simula como ela aparecerá no canto inferior direito do vídeo final."
                      : "Marca d'água desativada em Configurações de Produtos ou sem logo/nome em Branding."}
                  </p>
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
                {pendingMaterials.length > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                    <div className="text-sm">
                      <span className="font-medium">{pendingMaterials.length}</span> material(is) pendente(s) de revisão
                    </div>
                    <Button size="sm" variant="default" className="gap-1.5" onClick={handleApproveAll}>
                      <CheckCircle className="h-3.5 w-3.5" /> Aprovar tudo
                    </Button>
                  </div>
                )}
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
