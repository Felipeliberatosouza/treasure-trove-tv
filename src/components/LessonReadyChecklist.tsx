import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ClipboardCheck, ExternalLink, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: (ctx: {
    durationMinutes: number;
    cancelHours: number;
    meetingUrl: string | null;
  }) => React.ReactNode;
}

const ITEMS: ChecklistItem[] = [
  {
    id: "duration",
    label: ({ durationMinutes }) => (
      <>
        Confirmo que a aula terá{" "}
        <strong className="text-foreground">{durationMinutes} minutos</strong> de duração.
      </>
    ),
  },
  {
    id: "cancel",
    label: ({ cancelHours }) => (
      <>
        Estou ciente que cancelar com menos de{" "}
        <strong className="text-foreground">{cancelHours}h</strong> de antecedência gera{" "}
        <strong className="text-foreground">taxa de cancelamento</strong>.
      </>
    ),
  },
  {
    id: "meeting",
    label: ({ meetingUrl }) =>
      meetingUrl ? (
        <span className="inline-flex flex-wrap items-center gap-1">
          Testei o
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
          >
            link da reunião <ExternalLink className="h-3 w-3" />
          </a>
          e ele abre normalmente.
        </span>
      ) : (
        <>
          Sei que o <strong className="text-foreground">link da reunião</strong> aparecerá aqui
          assim que o professor disponibilizar.
        </>
      ),
  },
];

interface LessonReadyChecklistProps {
  lessonId: string;
  durationMinutes: number;
  cancelHours: number;
  meetingUrl: string | null;
  scheduledAt: string | Date;
}

const storageKey = (lessonId: string) => `lesson-ready-checklist:${lessonId}`;

const LessonReadyChecklist = ({
  lessonId,
  durationMinutes,
  cancelHours,
  meetingUrl,
  scheduledAt,
}: LessonReadyChecklistProps) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState<number>(() => Date.now());

  const startMs =
    typeof scheduledAt === "string" ? new Date(scheduledAt).getTime() : scheduledAt.getTime();
  const hasStarted = Number.isFinite(startMs) && now >= startMs;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(lessonId));
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [lessonId]);

  useEffect(() => {
    if (!Number.isFinite(startMs)) return;
    const update = () => setNow(Date.now());
    update();
    // Re-check every 30s; cheap and avoids drift.
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [startMs]);

  const toggle = (id: string, value: boolean) => {
    if (hasStarted) return;
    const next = { ...checked, [id]: value };
    setChecked(next);
    try {
      localStorage.setItem(storageKey(lessonId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const totalChecked = hasStarted
    ? ITEMS.length
    : ITEMS.filter((i) => checked[i.id]).length;
  const allChecked = totalChecked === ITEMS.length;

  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-3",
        allChecked ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-2">
          {allChecked ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <ClipboardCheck className="h-4 w-4 text-primary" />
          )}
          {hasStarted ? "Aula em andamento — pronto!" : "Preparado para a aula?"}
        </p>
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          {hasStarted && <Lock className="h-3 w-3" />}
          {totalChecked}/{ITEMS.length}
        </span>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const isChecked = hasStarted ? true : !!checked[item.id];
          return (
            <li key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`${lessonId}-${item.id}`}
                checked={isChecked}
                onCheckedChange={(v) => toggle(item.id, v === true)}
                disabled={hasStarted}
                className="mt-0.5"
              />
              <label
                htmlFor={`${lessonId}-${item.id}`}
                className={cn(
                  "text-xs leading-relaxed text-muted-foreground",
                  hasStarted ? "cursor-not-allowed" : "cursor-pointer",
                  isChecked && "line-through",
                )}
              >
                {item.label({ durationMinutes, cancelHours, meetingUrl })}
              </label>
            </li>
          );
        })}
      </ul>
      {hasStarted && (
        <p className="text-[11px] text-muted-foreground italic">
          A aula já começou — checklist concluído automaticamente e bloqueado para edição.
        </p>
      )}
    </div>
  );
};

export default LessonReadyChecklist;