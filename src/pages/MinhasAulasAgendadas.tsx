import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  CalendarDays,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  CalendarCog,
  Video,
  LinkIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  usePlatformSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
  type AulaParticularConfigSettings,
} from "@/hooks/usePlatformSettings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LessonReadyChecklist from "@/components/LessonReadyChecklist";

interface ScheduledLesson {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  price: number;
  payment_type: string | null;
  meeting_url: string | null;
  teacher_id: string;
  cancellation_reason: string | null;
}

interface TeacherInfo {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  confirmed: { label: "Confirmada", variant: "default" },
  completed: { label: "Realizada", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  cancelled_late: { label: "Cancelada com taxa", variant: "destructive" },
  no_show: { label: "Não compareceu", variant: "destructive" },
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const computeLateFee = (price: number, cfg: AulaParticularConfigSettings) => {
  if (cfg.late_cancel_fee_type === "fixed") {
    return Math.min(cfg.late_cancel_fee_value, price);
  }
  return Number(((price * cfg.late_cancel_fee_value) / 100).toFixed(2));
};

/** Chave de storage por aula. Mantemos o nonce ativo por lesson_id para que,
 *  se o aluno recarregar a página no meio de uma cobrança parcial, o retry
 *  reutilize o mesmo nonce e bata na chave de idempotência do Stripe. */
const NONCE_STORAGE_PREFIX = "late-cancel-nonce:";
const nonceStorageKey = (lessonId: string) => `${NONCE_STORAGE_PREFIX}${lessonId}`;

const generateNonce = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getOrCreatePersistentNonce = (lessonId: string): string => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return generateNonce();
  }
  const key = nonceStorageKey(lessonId);
  const existing = window.sessionStorage.getItem(key);
  if (existing && existing.length >= 8) return existing;
  const created = generateNonce();
  try {
    window.sessionStorage.setItem(key, created);
  } catch {
    /* storage cheio/bloqueado: segue só em memória */
  }
  return created;
};

const clearPersistentNonce = (lessonId: string) => {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(nonceStorageKey(lessonId));
  } catch {
    /* noop */
  }
};

const MinhasAulasAgendadas = () => {
  const { user, allRoles } = useAuth();
  const isTeacher = allRoles.includes("teacher");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [navigatingToAgenda, setNavigatingToAgenda] = useState(false);
  const { data: cfgRaw } = usePlatformSettings("aula_particular_config");
  const cfg: AulaParticularConfigSettings = cfgRaw ?? DEFAULT_AULA_PARTICULAR_CONFIG;

  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [teachers, setTeachers] = useState<Record<string, TeacherInfo>>({});
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<ScheduledLesson | null>(null);
  const [cancelling, setCancelling] = useState(false);
  /** When the student is inside the late-cancel window, the primary button is
   *  blocked. They must explicitly opt in to "request cancellation with fee"
   *  before the destructive action becomes available. */
  const [acknowledgedFee, setAcknowledgedFee] = useState(false);
  /** Nonce de cancelamento: gerado quando o modal abre e mantido enquanto
   *  ele estiver aberto. Reenviado em retries para acionar a chave de
   *  idempotência do Stripe (lesson_id + nonce) e impedir cobrança duplicada. */
  const [cancelNonce, setCancelNonce] = useState<string | null>(null);

  const fetchLessons = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("scheduled_lessons")
      .select(
        "id, title, description, scheduled_at, duration_minutes, status, price, payment_type, meeting_url, teacher_id, cancellation_reason"
      )
      .eq("student_id", user.id)
      .order("scheduled_at", { ascending: true });

    if (error) {
      toast({ title: "Erro", description: "Falha ao carregar aulas.", variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = (data ?? []) as ScheduledLesson[];
    setLessons(list);

    const teacherIds = Array.from(new Set(list.map((l) => l.teacher_id)));
    if (teacherIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", teacherIds);
      const map: Record<string, TeacherInfo> = {};
      (profs ?? []).forEach((p) => {
        map[p.user_id] = p as TeacherInfo;
      });
      setTeachers(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** Tracks the previous meeting_url for each upcoming lesson. When a lesson
   *  transitions from "no link" to "has link" while still in the future, we
   *  surface a toast so the student knows the teacher just published it. */
  const prevMeetingUrlsRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    const prev = prevMeetingUrlsRef.current;
    const next: Record<string, string | null> = {};
    lessons.forEach((l) => {
      next[l.id] = l.meeting_url ?? null;
      const isUpcoming = ["pending", "confirmed"].includes(l.status);
      const startsInFuture = new Date(l.scheduled_at).getTime() > Date.now();
      const had = prev[l.id];
      // Only notify when we already had a snapshot (avoids first-load noise).
      if (
        isUpcoming &&
        startsInFuture &&
        had !== undefined &&
        !had &&
        l.meeting_url
      ) {
        toast({
          title: "Link da reunião disponível!",
          description: `O professor disponibilizou o link para "${l.title}".`,
        });
      }
    });
    prevMeetingUrlsRef.current = next;
  }, [lessons, toast]);

  /** While there are upcoming lessons missing a meeting link, poll every 60s
   *  so the student gets the notification quickly without a manual refresh. */
  useEffect(() => {
    const needsPolling = lessons.some(
      (l) =>
        ["pending", "confirmed"].includes(l.status) &&
        !l.meeting_url &&
        new Date(l.scheduled_at).getTime() > Date.now(),
    );
    if (!needsPolling) return;
    const id = window.setInterval(() => {
      fetchLessons();
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons]);

  const cancelInfo = useMemo(() => {
    if (!cancelTarget) return null;
    const scheduledMs = new Date(cancelTarget.scheduled_at).getTime();
    const hoursUntil = (scheduledMs - Date.now()) / (1000 * 60 * 60);
    const isLate = hoursUntil < cfg.free_cancel_window_hours;
    const fee = isLate ? computeLateFee(cancelTarget.price, cfg) : 0;
    const platformShare = Number(((fee * cfg.fee_split_platform_pct) / 100).toFixed(2));
    const teacherShare = Number(((fee * cfg.fee_split_teacher_pct) / 100).toFixed(2));
    return { hoursUntil, isLate, fee, platformShare, teacherShare };
  }, [cancelTarget, cfg]);

  if (!user) return <Navigate to="/login" replace />;

  const closeCancelModal = () => {
    // Limpamos o nonce persistido apenas quando o fluxo é abandonado/finalizado
    // pelo usuário. Recargas de página NÃO chamam isto, então o nonce sobrevive.
    if (cancelTarget) clearPersistentNonce(cancelTarget.id);
    setCancelTarget(null);
    setAcknowledgedFee(false);
    setCancelNonce(null);
  };

  const openCancelModal = (lesson: ScheduledLesson) => {
    setCancelTarget(lesson);
    setAcknowledgedFee(false);
    // Reaproveita nonce persistido para esta aula (caso o aluno tenha
    // recarregado a página no meio de um cancelamento parcial). Se não houver,
    // um novo é gerado e gravado em sessionStorage.
    setCancelNonce(getOrCreatePersistentNonce(lesson.id));
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !cancelInfo) return;
    setCancelling(true);

    if (cancelInfo.isLate) {
      // Late cancellation: server validates window, charges via Stripe with the
      // configured split, and only then flips the booking to cancelled_late.
      if (!acknowledgedFee) {
        setCancelling(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        "charge-late-cancellation-fee",
        {
          body: {
            lesson_id: cancelTarget.id,
            cancel_nonce: cancelNonce,
          },
        },
      );
      setCancelling(false);

      const result = data as
        | {
            success?: boolean;
            partial?: boolean;
            charged?: boolean;
            error?: string;
            payment_intent_id?: string;
          }
        | null;

      // Caso parcial: cobrança OK mas update da aula falhou no servidor.
      if (result?.partial && result?.charged) {
        toast({
          title: "Cobrança realizada — atualização pendente",
          description:
            result.error ??
            `Taxa cobrada (cód. ${result.payment_intent_id ?? "—"}). Nossa equipe regularizará o status.`,
          variant: "destructive",
        });
        closeCancelModal();
        fetchLessons();
        return;
      }

      if (error || result?.error || result?.success === false) {
        const msg =
          result?.error ?? error?.message ?? "Falha ao cobrar a taxa de cancelamento.";
        toast({ title: "Não foi possível cancelar", description: msg, variant: "destructive" });
        return;
      }

      toast({
        title: "Aula cancelada com taxa",
        description: `Taxa de ${formatBRL(cancelInfo.fee)} cobrada no seu cartão.`,
      });
    } else {
      // Free cancellation inside the window: simple update.
      const { error } = await supabase
        .from("scheduled_lessons")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Cancelado pelo aluno dentro da janela gratuita de ${cfg.free_cancel_window_hours}h.`,
        })
        .eq("id", cancelTarget.id);
      setCancelling(false);

      if (error) {
        toast({ title: "Erro", description: "Falha ao cancelar aula.", variant: "destructive" });
        return;
      }
      toast({ title: "Aula cancelada", description: "Cancelamento realizado sem custo." });
    }

    closeCancelModal();
    fetchLessons();
  };

  const upcoming = lessons.filter((l) => ["pending", "confirmed"].includes(l.status));
  const past = lessons.filter((l) => !["pending", "confirmed"].includes(l.status));

  const renderLessonCard = (lesson: ScheduledLesson, allowCancel: boolean) => {
    const teacher = teachers[lesson.teacher_id];
    const scheduledMs = new Date(lesson.scheduled_at).getTime();
    const hoursUntil = (scheduledMs - Date.now()) / (1000 * 60 * 60);
    const willIncurFee = hoursUntil >= 0 && hoursUntil < cfg.free_cancel_window_hours;
    const status = STATUS_LABEL[lesson.status] ?? { label: lesson.status, variant: "outline" as const };

    return (
      <div key={lesson.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{lesson.title}</h3>
            <p className="text-sm text-muted-foreground">
              com {teacher?.name ?? "Professor"}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>{format(new Date(lesson.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {format(new Date(lesson.scheduled_at), "HH:mm", { locale: ptBR })} ·{" "}
              {lesson.duration_minutes} min
            </span>
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatBRL(lesson.price)}</span>{" "}
            {lesson.payment_type === "subscription_quota" ? "(cota)" : "(avulso)"}
          </div>
        </div>

        {lesson.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{lesson.description}</p>
        )}

        {allowCancel && willIncurFee && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Faltam menos de {cfg.free_cancel_window_hours}h para a aula. Cancelar agora resultará
              em cobrança da taxa de cancelamento.
            </span>
          </div>
        )}

        {allowCancel && (
          lesson.meeting_url ? (
            <a
              href={lesson.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-primary hover:bg-primary/15 transition-colors"
            >
              <Video className="h-4 w-4 shrink-0" />
              <span className="font-medium">Link da reunião disponível</span>
              <LinkIcon className="h-3 w-3 ml-auto" />
            </a>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                O <strong>link da reunião</strong> ainda não foi disponibilizado pelo professor.
                Você será avisado assim que ele aparecer aqui.
              </span>
            </div>
          )
        )}

        {lesson.cancellation_reason && (
          <p className="text-xs text-muted-foreground italic">{lesson.cancellation_reason}</p>
        )}

        {allowCancel && (
          <LessonReadyChecklist
            lessonId={lesson.id}
            durationMinutes={lesson.duration_minutes}
            cancelHours={cfg.free_cancel_window_hours}
            meetingUrl={lesson.meeting_url}
            scheduledAt={lesson.scheduled_at}
          />
        )}

        {allowCancel && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCancelModal(lesson)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancelar aula
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-primary" />
              <h1 className="font-display text-3xl font-bold text-gradient">
                Minhas Aulas Agendadas
              </h1>
            </div>
            {isTeacher && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={navigatingToAgenda}
                onClick={() => {
                  if (navigatingToAgenda) return;
                  setNavigatingToAgenda(true);
                  toast({
                    title: "Abrindo sua agenda…",
                    description: "Carregando os horários de aula particular.",
                  });
                  // Pequeno delay para o usuário ver o feedback antes da troca de rota
                  setTimeout(() => {
                    navigate("/dashboard/teacher?tab=agenda");
                  }, 250);
                }}
              >
                {navigatingToAgenda ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Abrindo agenda…
                  </>
                ) : (
                  <>
                    <CalendarCog className="h-4 w-4" />
                    Atualizar minha Agenda
                  </>
                )}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-lg">
            Aulas particulares agendadas com professores. Cancelamentos com menos de{" "}
            <strong>{cfg.free_cancel_window_hours}h</strong> de antecedência geram cobrança.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lessons.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">Você não possui aulas agendadas.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <section className="space-y-4">
                <h2 className="font-display text-xl font-semibold">Próximas aulas</h2>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma aula futura.</p>
                ) : (
                  <div className="space-y-4">
                    {upcoming.map((l) => renderLessonCard(l, true))}
                  </div>
                )}
              </section>

              {past.length > 0 && (
                <section className="space-y-4">
                  <h2 className="font-display text-xl font-semibold">Histórico</h2>
                  <div className="space-y-4">
                    {past.map((l) => renderLessonCard(l, false))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && closeCancelModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar aula particular</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>
                  Aula com {teachers[cancelTarget.teacher_id]?.name ?? "professor"} em{" "}
                  {format(new Date(cancelTarget.scheduled_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {cancelInfo && cancelTarget && (
            <div className="space-y-4">
              {cancelInfo.isLate ? (
                <>
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Cancelamento bloqueado — fora da janela gratuita
                  </div>
                  <p className="text-muted-foreground">
                    Faltam{" "}
                    <strong>
                      {cancelInfo.hoursUntil > 0
                        ? `${cancelInfo.hoursUntil.toFixed(1)}h`
                        : "0h"}
                    </strong>{" "}
                    para a aula — abaixo da janela gratuita de{" "}
                    <strong>{cfg.free_cancel_window_hours}h</strong>.
                    O cancelamento gratuito não está mais disponível. Para
                    prosseguir, você precisa aceitar a cobrança da taxa abaixo
                    no seu cartão cadastrado.
                  </p>
                  <div className="border-t border-destructive/20 pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor da aula</span>
                      <span>{formatBRL(cancelTarget.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Taxa (
                        {cfg.late_cancel_fee_type === "percentage"
                          ? `${cfg.late_cancel_fee_value}%`
                          : "valor fixo"}
                        )
                      </span>
                      <span className="font-semibold text-destructive">
                        {formatBRL(cancelInfo.fee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>→ Plataforma ({cfg.fee_split_platform_pct}%)</span>
                      <span>{formatBRL(cancelInfo.platformShare)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>→ Professor ({cfg.fee_split_teacher_pct}%)</span>
                      <span>{formatBRL(cancelInfo.teacherShare)}</span>
                    </div>
                  </div>
                </div>
                {!acknowledgedFee ? (
                  <button
                    type="button"
                    onClick={() => setAcknowledgedFee(true)}
                    className="w-full rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition"
                  >
                    Solicitar cancelamento e aceitar a cobrança da taxa
                  </button>
                ) : (
                  <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                    Você confirmou a cobrança da taxa. Clique em{" "}
                    <strong>Confirmar e pagar</strong> para finalizar — a cobrança
                    será efetuada imediatamente.
                  </div>
                )}
                </>
              ) : (
                <div className="rounded-md border border-border bg-secondary/30 p-4 text-sm space-y-2">
                  <p>
                    Sua aula está dentro da janela gratuita de{" "}
                    <strong>{cfg.free_cancel_window_hours}h</strong>. O cancelamento será{" "}
                    <strong>sem custo</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeCancelModal}
              disabled={cancelling}
            >
              Voltar
            </Button>
            <Button
              variant={cancelInfo?.isLate ? "destructive" : "default"}
              onClick={handleConfirmCancel}
              disabled={cancelling || (cancelInfo?.isLate === true && !acknowledgedFee)}
              className="gap-2"
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {cancelInfo?.isLate ? "Confirmar e pagar" : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinhasAulasAgendadas;
