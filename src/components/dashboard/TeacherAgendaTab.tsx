import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  Plus,
  Trash2,
  Loader2,
  Ban,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleSlash,
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  addMinutes,
  isWithinInterval,
  parseISO,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  usePlatformSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
  type AulaParticularConfigSettings,
} from "@/hooks/usePlatformSettings";

interface RecurringRow {
  id: string;
  day_of_week: number; // 0 = Domingo
  start_time: string; // "HH:MM:SS"
  end_time: string;
  active: boolean;
}

interface ExceptionRow {
  id: string;
  exception_date: string; // "YYYY-MM-DD"
  exception_type: "unavailable" | "extra";
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

interface BookingRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  title: string;
}

const DAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const toHHMM = (t: string) => t.slice(0, 5);
const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

const TeacherAgendaTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: cfgRaw } = usePlatformSettings("aula_particular_config");
  const cfg: AulaParticularConfigSettings = cfgRaw ?? DEFAULT_AULA_PARTICULAR_CONFIG;

  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  // New recurring form
  const [newRec, setNewRec] = useState<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>({ day_of_week: 1, start_time: "09:00", end_time: "12:00" });

  // Exception modal state
  const [excOpen, setExcOpen] = useState(false);
  const [excForm, setExcForm] = useState<{
    exception_date: string;
    exception_type: "unavailable" | "extra";
    start_time: string;
    end_time: string;
    notes: string;
  }>({
    exception_date: format(new Date(), "yyyy-MM-dd"),
    exception_type: "unavailable",
    start_time: "09:00",
    end_time: "12:00",
    notes: "",
  });

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: rec }, { data: exc }, { data: bk }] = await Promise.all([
      supabase
        .from("teacher_availability_recurring")
        .select("id, day_of_week, start_time, end_time, active")
        .eq("teacher_id", user.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("teacher_availability_exceptions")
        .select("id, exception_date, exception_type, start_time, end_time, notes")
        .eq("teacher_id", user.id)
        .order("exception_date", { ascending: true }),
      supabase
        .from("scheduled_lessons")
        .select("id, scheduled_at, duration_minutes, status, title")
        .eq("teacher_id", user.id)
        .in("status", ["pending", "confirmed", "scheduled"])
        .gte(
          "scheduled_at",
          new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
        ),
    ]);

    setRecurring((rec ?? []) as RecurringRow[]);
    setExceptions((exc ?? []) as ExceptionRow[]);
    setBookings((bk ?? []) as BookingRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Add recurring window
  const handleAddRecurring = async () => {
    if (!user) return;
    if (newRec.start_time >= newRec.end_time) {
      toast({
        title: "Horário inválido",
        description: "O horário de fim deve ser maior que o de início.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("teacher_availability_recurring")
      .insert({
        teacher_id: user.id,
        day_of_week: newRec.day_of_week,
        start_time: normalizeTime(newRec.start_time),
        end_time: normalizeTime(newRec.end_time),
        active: true,
      });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Janela recorrente adicionada" });
    fetchAll();
  };

  const toggleRecurring = async (row: RecurringRow) => {
    const { error } = await supabase
      .from("teacher_availability_recurring")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const deleteRecurring = async (id: string) => {
    const { error } = await supabase
      .from("teacher_availability_recurring")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Janela removida" });
    fetchAll();
  };

  const openExceptionModal = (date?: Date) => {
    setExcForm({
      exception_date: format(date ?? new Date(), "yyyy-MM-dd"),
      exception_type: "unavailable",
      start_time: "09:00",
      end_time: "12:00",
      notes: "",
    });
    setExcOpen(true);
  };

  const handleSaveException = async () => {
    if (!user) return;
    if (
      excForm.exception_type === "extra" &&
      excForm.start_time >= excForm.end_time
    ) {
      toast({
        title: "Horário inválido",
        description: "Em janelas extras, o fim deve ser maior que o início.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      teacher_id: user.id,
      exception_date: excForm.exception_date,
      exception_type: excForm.exception_type,
      start_time:
        excForm.exception_type === "extra" ? normalizeTime(excForm.start_time) : null,
      end_time:
        excForm.exception_type === "extra" ? normalizeTime(excForm.end_time) : null,
      notes: excForm.notes || null,
    };
    const { error } = await supabase
      .from("teacher_availability_exceptions")
      .insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Exceção registrada" });
    setExcOpen(false);
    fetchAll();
  };

  const deleteException = async (id: string) => {
    const { error } = await supabase
      .from("teacher_availability_exceptions")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Exceção removida" });
    fetchAll();
  };

  // Toggle block/unblock of a single slot via partial-day exception
  const toggleSlotBlock = async (slot: {
    start: Date;
    end: Date;
    booked: BookingRow | null;
    blockedExceptionId: string | null;
  }) => {
    if (!user || slot.booked) return;
    if (slot.blockedExceptionId) {
      const { error } = await supabase
        .from("teacher_availability_exceptions")
        .delete()
        .eq("id", slot.blockedExceptionId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Slot desbloqueado" });
    } else {
      const { error } = await supabase
        .from("teacher_availability_exceptions")
        .insert({
          teacher_id: user.id,
          exception_date: format(slot.start, "yyyy-MM-dd"),
          exception_type: "unavailable",
          start_time: format(slot.start, "HH:mm:ss"),
          end_time: format(slot.end, "HH:mm:ss"),
          notes: "Slot bloqueado pelo professor",
        });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Slot bloqueado" });
    }
    fetchAll();
  };

  // ---- Visualização semanal ----
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  type WindowSlot = {
    start: Date;
    end: Date;
    source: "recurring" | "extra";
  };

  const windowsForDate = (date: Date): WindowSlot[] => {
    const dayIso = format(date, "yyyy-MM-dd");
    const dow = date.getDay();

    const blocked = exceptions.some(
      (e) => e.exception_date === dayIso && e.exception_type === "unavailable"
    );
    if (blocked) return [];

    const recWindows: WindowSlot[] = recurring
      .filter((r) => r.active && r.day_of_week === dow)
      .map((r) => ({
        start: parseISO(`${dayIso}T${r.start_time}`),
        end: parseISO(`${dayIso}T${r.end_time}`),
        source: "recurring" as const,
      }));

    const extraWindows: WindowSlot[] = exceptions
      .filter(
        (e) =>
          e.exception_date === dayIso &&
          e.exception_type === "extra" &&
          e.start_time &&
          e.end_time
      )
      .map((e) => ({
        start: parseISO(`${dayIso}T${e.start_time}`),
        end: parseISO(`${dayIso}T${e.end_time}`),
        source: "extra" as const,
      }));

    return [...recWindows, ...extraWindows].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
  };

  type DaySlot = {
    start: Date;
    end: Date;
    booked: BookingRow | null;
    source: "recurring" | "extra";
    blockedExceptionId: string | null;
  };

  const slotsForDate = (date: Date): DaySlot[] => {
    const wins = windowsForDate(date);
    const dur = cfg.lesson_duration_minutes;
    const slots: DaySlot[] = [];
    const dayIso = format(date, "yyyy-MM-dd");
    const partialBlocks = exceptions.filter(
      (e) =>
        e.exception_date === dayIso &&
        e.exception_type === "unavailable" &&
        e.start_time &&
        e.end_time
    );

    for (const w of wins) {
      let cursor = new Date(w.start);
      while (addMinutes(cursor, dur) <= w.end) {
        const slotStart = new Date(cursor);
        const slotEnd = addMinutes(slotStart, dur);

        const bookedHit =
          bookings.find((b) => {
            const bStart = parseISO(b.scheduled_at);
            const bEnd = addMinutes(bStart, b.duration_minutes);
            return (
              isSameDay(bStart, date) &&
              isWithinInterval(slotStart, { start: bStart, end: bEnd }) === false &&
              // overlap test
              slotStart < bEnd &&
              slotEnd > bStart
            );
          }) ?? null;

        const blockMatch =
          partialBlocks.find((e) => {
            const eStart = parseISO(`${dayIso}T${e.start_time}`);
            const eEnd = parseISO(`${dayIso}T${e.end_time}`);
            // Slot is fully covered by this block range
            return eStart <= slotStart && eEnd >= slotEnd;
          }) ?? null;

        slots.push({
          start: slotStart,
          end: slotEnd,
          booked: bookedHit,
          source: w.source,
          blockedExceptionId: blockMatch?.id ?? null,
        });
        cursor = addMinutes(cursor, dur);
      }
    }
    return slots;
  };

  const dayExceptionBlocks = (date: Date) =>
    exceptions.filter(
      (e) =>
        e.exception_date === format(date, "yyyy-MM-dd") &&
        e.exception_type === "unavailable"
    );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-display text-xl font-bold">Minha Agenda</h2>
            <p className="text-sm text-muted-foreground">
              Configure quando você aceita aulas particulares de{" "}
              <strong>{cfg.lesson_duration_minutes} min</strong>.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* === Visualização semanal === */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-semibold">Visualização semanal</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[160px] text-center">
                  {format(weekStart, "dd 'de' MMM", { locale: ptBR })} —{" "}
                  {format(addDays(weekStart, 6), "dd 'de' MMM", { locale: ptBR })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))
                  }
                >
                  Hoje
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {weekDays.map((d) => {
                const slots = slotsForDate(d);
                const blocks = dayExceptionBlocks(d);
                const isToday = isSameDay(d, new Date());
                return (
                  <div
                    key={d.toISOString()}
                    className={`rounded-lg border p-3 min-h-[160px] flex flex-col gap-2 ${
                      isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {DAY_SHORT[d.getDay()]}
                        </div>
                        <div className="font-semibold">
                          {format(d, "dd/MM", { locale: ptBR })}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openExceptionModal(d)}
                        title="Adicionar exceção neste dia"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {blocks.length > 0 && (
                      <div className="rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive flex items-center gap-1">
                        <Ban className="h-3 w-3" /> Bloqueado
                      </div>
                    )}

                    {slots.length === 0 && blocks.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Sem disponibilidade
                      </p>
                    )}

                    <div className="flex flex-col gap-1">
                      {slots.map((s) => (
                        <button
                          type="button"
                          key={s.start.toISOString()}
                          disabled={!!s.booked}
                          onClick={() => toggleSlotBlock(s)}
                          className={`rounded px-2 py-1 text-[11px] flex items-center justify-between gap-1 transition-colors text-left ${
                            s.booked
                              ? "bg-primary/15 text-primary border border-primary/30 cursor-not-allowed"
                              : s.blockedExceptionId
                              ? "bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/25 line-through"
                              : s.source === "extra"
                              ? "bg-accent/15 text-foreground border border-accent/40 hover:bg-accent/25"
                              : "bg-secondary text-foreground hover:bg-secondary/70"
                          }`}
                          title={
                            s.booked
                              ? `Reservada: ${s.booked.title}`
                              : s.blockedExceptionId
                              ? "Slot bloqueado — clique para desbloquear"
                              : "Slot livre — clique para bloquear"
                          }
                        >
                          <span className="font-mono">
                            {format(s.start, "HH:mm")}
                          </span>
                          {s.booked ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : s.blockedExceptionId ? (
                            <Ban className="h-3 w-3" />
                          ) : s.source === "extra" ? (
                            <Sparkles className="h-3 w-3" />
                          ) : (
                            <CircleSlash className="h-3 w-3 opacity-30" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-secondary" /> Recorrente
                livre
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-accent/40 border border-accent/60" />{" "}
                Janela extra
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-primary/40 border border-primary/60" />{" "}
                Reservada
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-destructive/30 border border-destructive/50" />{" "}
                Slot bloqueado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-destructive/30" /> Dia
                bloqueado
              </span>
            </div>
          </section>

          {/* === Agenda recorrente === */}
          <section className="space-y-4">
            <h3 className="font-semibold">Agenda recorrente (semanal)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end rounded-lg border border-border p-4 bg-card">
              <div>
                <Label className="text-xs">Dia</Label>
                <Select
                  value={String(newRec.day_of_week)}
                  onValueChange={(v) =>
                    setNewRec((p) => ({ ...p, day_of_week: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((n, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={newRec.start_time}
                  onChange={(e) =>
                    setNewRec((p) => ({ ...p, start_time: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={newRec.end_time}
                  onChange={(e) =>
                    setNewRec((p) => ({ ...p, end_time: e.target.value }))
                  }
                />
              </div>
              <Button onClick={handleAddRecurring} disabled={saving} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar janela
              </Button>
            </div>

            {recurring.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhuma janela recorrente cadastrada.
              </p>
            ) : (
              <div className="space-y-2">
                {recurring.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={r.active ? "default" : "outline"}>
                        {DAY_NAMES[r.day_of_week]}
                      </Badge>
                      <span className="font-mono text-sm">
                        {toHHMM(r.start_time)} – {toHHMM(r.end_time)}
                      </span>
                      {!r.active && (
                        <span className="text-xs text-muted-foreground">(pausada)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={r.active}
                          onCheckedChange={() => toggleRecurring(r)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRecurring(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* === Exceções === */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Exceções (datas específicas)</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openExceptionModal()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Nova exceção
              </Button>
            </div>

            {exceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Sem exceções cadastradas. Use exceções para bloquear feriados ou abrir
                horários extras.
              </p>
            ) : (
              <div className="space-y-2">
                {exceptions.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <Badge
                        variant={
                          e.exception_type === "unavailable" ? "destructive" : "default"
                        }
                        className="gap-1"
                      >
                        {e.exception_type === "unavailable" ? (
                          <Ban className="h-3 w-3" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {e.exception_type === "unavailable" ? "Bloqueio" : "Janela extra"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {format(parseISO(e.exception_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                      {e.start_time && e.end_time && (
                        <span className="font-mono text-sm text-muted-foreground">
                          {toHHMM(e.start_time)} – {toHHMM(e.end_time)}
                        </span>
                      )}
                      {e.notes && (
                        <span className="text-xs text-muted-foreground italic truncate">
                          “{e.notes}”
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteException(e.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Exception modal */}
      <Dialog open={excOpen} onOpenChange={setExcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova exceção de agenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={excForm.exception_type}
                onValueChange={(v) =>
                  setExcForm((p) => ({
                    ...p,
                    exception_type: v as "unavailable" | "extra",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unavailable">
                    Bloquear o dia inteiro
                  </SelectItem>
                  <SelectItem value="extra">
                    Adicionar janela extra
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={excForm.exception_date}
                onChange={(e) =>
                  setExcForm((p) => ({ ...p, exception_date: e.target.value }))
                }
              />
            </div>
            {excForm.exception_type === "extra" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={excForm.start_time}
                    onChange={(e) =>
                      setExcForm((p) => ({ ...p, start_time: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={excForm.end_time}
                    onChange={(e) =>
                      setExcForm((p) => ({ ...p, end_time: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Input
                placeholder="Ex.: Feriado, viagem, plantão extra..."
                value={excForm.notes}
                onChange={(e) =>
                  setExcForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExcOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveException} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar exceção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherAgendaTab;
