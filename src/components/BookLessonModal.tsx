import { useEffect, useMemo, useState } from "react";
import { format, addMinutes, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SelectionChip } from "@/components/ui/SelectionChip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  usePlatformSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
  type AulaParticularConfigSettings,
} from "@/hooks/usePlatformSettings";
import { useResourceLimit } from "@/hooks/useResourceLimit";
import { Sparkles, Wallet } from "lucide-react";

interface BookLessonModalProps {
  open: boolean;
  onClose: () => void;
  teacherId: string;
  teacherName: string | null;
  contentId?: string | null;
  contentType?: "lesson" | "exam_solution" | null;
  contentTitle?: string | null;
}

interface RecurringRow {
  day_of_week: number;
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  active: boolean;
}

interface ExceptionRow {
  exception_date: string; // 'YYYY-MM-DD'
  exception_type: "unavailable" | "extra";
  start_time: string | null;
  end_time: string | null;
}

interface ScheduledRow {
  scheduled_at: string;
  duration_minutes: number;
}

interface Window {
  start: Date;
  end: Date;
}

const parseTimeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
};

const setTimeOnDate = (date: Date, minutes: number): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
};

const BookLessonModal = ({
  open,
  onClose,
  teacherId,
  teacherName,
  contentId,
  contentType,
  contentTitle,
}: BookLessonModalProps) => {
  const { user } = useAuth();
  const { data: cfgData } = usePlatformSettings("aula_particular_config");
  const { checkLimit, loaded: limitsLoaded, subscriptionId } = useResourceLimit();
  const cfg: AulaParticularConfigSettings = useMemo(
    () => ({
      ...DEFAULT_AULA_PARTICULAR_CONFIG,
      ...((cfgData as AulaParticularConfigSettings) || {}),
    }),
    [cfgData]
  );

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [bookings, setBookings] = useState<ScheduledRow[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resourcePrice, setResourcePrice] = useState<number | null>(null);

  const credit = useMemo(() => {
    if (!user || !limitsLoaded) return null;
    return checkLimit("aula_particular");
  }, [user, limitsLoaded, checkLimit]);
  const useCredit = !!credit?.hasSubscription && credit.allowed;

  // Load all teacher availability + bookings + price when modal opens
  useEffect(() => {
    if (!open || !teacherId) return;
    let cancelled = false;
    const load = async () => {
      setLoadingAvail(true);
      const today = new Date();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 60);

      const [recRes, excRes, bookRes, priceRes] = await Promise.all([
        supabase
          .from("teacher_availability_recurring")
          .select("day_of_week, start_time, end_time, active")
          .eq("teacher_id", teacherId)
          .eq("active", true),
        supabase
          .from("teacher_availability_exceptions")
          .select("exception_date, exception_type, start_time, end_time")
          .eq("teacher_id", teacherId)
          .gte("exception_date", format(today, "yyyy-MM-dd"))
          .lte("exception_date", format(horizon, "yyyy-MM-dd")),
        supabase
          .from("scheduled_lessons")
          .select("scheduled_at, duration_minutes")
          .eq("teacher_id", teacherId)
          .in("status", ["pending", "confirmed"])
          .gte("scheduled_at", today.toISOString()),
        supabase
          .from("resource_prices")
          .select("price")
          .eq("resource_type", "aula_particular")
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setRecurring((recRes.data as RecurringRow[]) || []);
      setExceptions((excRes.data as ExceptionRow[]) || []);
      setBookings((bookRes.data as ScheduledRow[]) || []);
      setResourcePrice(priceRes.data?.price ? Number(priceRes.data.price) : null);
      setLoadingAvail(false);
    };
    load();

    // Realtime: refletir bloqueios/exceções e novas reservas do professor
    // imediatamente para evitar tentar reservar um slot que acabou de
    // conflitar com uma exceção sobreposta criada por ele.
    // Debounce trailing: rajadas de updates (ex.: o professor bloqueando
    // vários slots em sequência ou o webhook do Stripe disparando múltiplos
    // eventos) coalescem em um único reload após 300ms de inatividade.
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (cancelled) return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        if (!cancelled) load();
      }, 300);
    };

    const channel = supabase
      .channel(`book-lesson-${teacherId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_availability_exceptions",
          filter: `teacher_id=eq.${teacherId}`,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_availability_recurring",
          filter: `teacher_id=eq.${teacherId}`,
        },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_lessons",
          filter: `teacher_id=eq.${teacherId}`,
        },
        scheduleReload,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [open, teacherId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setDate(undefined);
      setSelectedSlot(null);
    }
  }, [open]);

  /** Build availability windows for the picked date. */
  const computeWindowsForDate = (d: Date): Window[] => {
    const dayStr = format(d, "yyyy-MM-dd");
    const dow = d.getDay();
    const dayExceptions = exceptions.filter((e) => e.exception_date === dayStr);

    // Full-day unavailability blocks everything
    const fullDayBlock = dayExceptions.some(
      (e) => e.exception_type === "unavailable" && !e.start_time && !e.end_time
    );
    if (fullDayBlock) return [];

    const baseWindows: Window[] = [];

    // 1. Recurring blocks for this DOW
    recurring
      .filter((r) => r.day_of_week === dow)
      .forEach((r) => {
        baseWindows.push({
          start: setTimeOnDate(d, parseTimeToMinutes(r.start_time)),
          end: setTimeOnDate(d, parseTimeToMinutes(r.end_time)),
        });
      });

    // 2. Extra availability windows on this date
    dayExceptions
      .filter((e) => e.exception_type === "extra" && e.start_time && e.end_time)
      .forEach((e) => {
        baseWindows.push({
          start: setTimeOnDate(d, parseTimeToMinutes(e.start_time!)),
          end: setTimeOnDate(d, parseTimeToMinutes(e.end_time!)),
        });
      });

    if (baseWindows.length === 0) return [];

    // 3. Subtract partial unavailability ranges
    const blockers = dayExceptions
      .filter((e) => e.exception_type === "unavailable" && e.start_time && e.end_time)
      .map((e) => ({
        start: setTimeOnDate(d, parseTimeToMinutes(e.start_time!)),
        end: setTimeOnDate(d, parseTimeToMinutes(e.end_time!)),
      }));

    let working: Window[] = baseWindows;
    blockers.forEach((b) => {
      const next: Window[] = [];
      working.forEach((w) => {
        // No overlap → keep
        if (b.end <= w.start || b.start >= w.end) {
          next.push(w);
          return;
        }
        // Trim left
        if (b.start > w.start) {
          next.push({ start: w.start, end: b.start });
        }
        // Trim right
        if (b.end < w.end) {
          next.push({ start: b.end, end: w.end });
        }
      });
      working = next;
    });

    return working;
  };

  /** Build 50-min slot list for the picked date, marking booked/past. */
  const slots = useMemo(() => {
    if (!date) return [] as { time: Date; disabled: boolean; reason?: string }[];
    const duration = cfg.lesson_duration_minutes || 50;
    const windows = computeWindowsForDate(date);
    const now = new Date();
    const minStart = new Date(now.getTime() + 60 * 60 * 1000); // booking must be at least 1h ahead

    const dayBookings = bookings
      .map((b) => {
        const start = new Date(b.scheduled_at);
        const end = addMinutes(start, b.duration_minutes || duration);
        return { start, end };
      })
      .filter((b) => isSameDay(b.start, date));

    const out: { time: Date; disabled: boolean; reason?: string }[] = [];
    windows.forEach((w) => {
      let cursor = new Date(w.start);
      while (addMinutes(cursor, duration) <= w.end) {
        const slotStart = new Date(cursor);
        const slotEnd = addMinutes(cursor, duration);
        const isPast = slotStart < minStart;
        const conflicts = dayBookings.some(
          (b) => slotStart < b.end && slotEnd > b.start
        );
        out.push({
          time: slotStart,
          disabled: isPast || conflicts,
          reason: isPast ? "passado" : conflicts ? "ocupado" : undefined,
        });
        cursor = slotEnd;
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, recurring, exceptions, bookings, cfg.lesson_duration_minutes]);

  // Se o slot selecionado deixou de existir (foi bloqueado/ocupado por
  // atualização realtime), limpar a seleção e avisar.
  useEffect(() => {
    if (!selectedSlot) return;
    const stillValid = slots.some(
      (s) => !s.disabled && s.time.getTime() === selectedSlot.getTime(),
    );
    if (!stillValid) {
      setSelectedSlot(null);
      toast.warning(
        "O horário selecionado acabou de ficar indisponível. Escolha outro.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const handleConfirm = async () => {
    if (!user) {
      toast.error("Faça login para agendar.");
      return;
    }
    if (!selectedSlot) return;

    // Revalidação final no clique: o estado pode ter mudado entre render e clique.
    const stillAvailable = slots.some(
      (s) => !s.disabled && s.time.getTime() === selectedSlot.getTime(),
    );
    if (!stillAvailable) {
      setSelectedSlot(null);
      toast.error(
        "Este horário não está mais disponível. A agenda foi atualizada.",
      );
      return;
    }

    setConfirming(true);

    const { error } = await supabase.from("scheduled_lessons").insert({
      teacher_id: teacherId,
      student_id: user.id,
      title: contentTitle
        ? `Aula Particular — ${contentTitle}`
        : `Aula Particular${teacherName ? ` com ${teacherName}` : ""}`,
      description: contentTitle
        ? `Aula particular sobre o conteúdo: ${contentTitle}`
        : `Aula particular agendada diretamente pela página do professor${teacherName ? ` (${teacherName})` : ""}.`,
      scheduled_at: selectedSlot.toISOString(),
      duration_minutes: cfg.lesson_duration_minutes || 50,
      modality: "online",
      status: "pending",
      content_id: contentId ?? null,
      content_type: contentType ?? null,
      payment_type: useCredit ? "subscription" : "one_off",
      price: useCredit ? 0 : (resourcePrice ?? 0),
    });

    if (error) {
      console.error(error);
      toast.error("Não foi possível agendar a aula. Tente novamente.");
      setConfirming(false);
      return;
    }

    // Consome 1 crédito da assinatura quando aplicável.
    if (useCredit && subscriptionId) {
      await supabase.from("resource_usage").insert({
        user_id: user.id,
        subscription_id: subscriptionId,
        resource_type: "aula_particular",
        content_id: contentId ?? null,
        content_type: contentType ?? null,
      });
    }

    toast.success(
      useCredit
        ? "Aula agendada usando 1 crédito do seu plano. Aguarde a confirmação do professor."
        : "Aula agendada! Aguarde a confirmação do professor.",
    );
    setConfirming(false);
    onClose();
  };

  const hasAnyAvailability = recurring.length > 0 || exceptions.some((e) => e.exception_type === "extra");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agendar Aula Particular
          </DialogTitle>
          <DialogDescription>
            {teacherName ? `Com ${teacherName} — ` : ""}
            {cfg.lesson_duration_minutes} minutos
            {resourcePrice !== null && ` · R$ ${resourcePrice.toFixed(2)}`}
          </DialogDescription>
          {contentTitle && (
            <p className="mt-1 text-sm font-medium text-foreground">
              Disciplina: <span className="text-primary">{contentTitle}</span>
            </p>
          )}
        </DialogHeader>

        {loadingAvail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAnyAvailability ? (
          <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Sem agenda disponível</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Este professor ainda não publicou horários para aulas particulares.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {credit && (
              credit.hasSubscription && credit.allowed ? (
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">
                      Você tem {credit.remaining} de {credit.total} aulas particulares no seu plano.
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      Esta reserva consumirá 1 crédito — sem cobrança adicional.
                    </p>
                  </div>
                </div>
              ) : credit.hasSubscription && !credit.allowed ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <Wallet className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">
                      Você já usou todas as {credit.total} aulas particulares do plano.
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      Esta reserva será cobrada como aula avulsa
                      {resourcePrice !== null && `: R$ ${resourcePrice.toFixed(2)}`}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                  <Wallet className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">Aula avulsa</div>
                    <p className="mt-0.5 text-muted-foreground">
                      {resourcePrice !== null
                        ? `Valor: R$ ${resourcePrice.toFixed(2)}.`
                        : "Valor a combinar com o professor."}
                      {" "}Assine um plano para ganhar créditos de aula particular.
                    </p>
                  </div>
                </div>
              )
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Escolha o dia
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date
                      ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
                      : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setSelectedSlot(null);
                    }}
                    disabled={(d) => d < startOfDay(new Date())}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {date && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Horários disponíveis
                </label>
                {slots.length === 0 ? (
                  <p className="rounded-lg border border-border bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
                    Nenhum horário disponível neste dia. Tente outra data.
                  </p>
                ) : (
                  <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                    {slots.map((s) => {
                      const isSelected =
                        selectedSlot && s.time.getTime() === selectedSlot.getTime();
                      return (
                      <SelectionChip
                        key={s.time.toISOString()}
                        disabled={s.disabled}
                        selected={!!isSelected}
                        onClick={() => setSelectedSlot(s.time)}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs",
                          s.disabled && "line-through"
                        )}
                        title={
                          s.disabled
                            ? s.reason === "ocupado"
                              ? "Horário já reservado"
                              : "Horário indisponível"
                            : undefined
                        }
                      >
                        <Clock className="h-3 w-3" />
                        {format(s.time, "HH:mm")}
                      </SelectionChip>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {format(selectedSlot, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </div>
                <p className="mt-1 text-muted-foreground">
                  Cancelamento gratuito até {cfg.free_cancel_window_hours}h antes do horário
                  marcado.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={confirming}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selectedSlot || confirming || !user}
              >
                {confirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  "Confirmar agendamento"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookLessonModal;
