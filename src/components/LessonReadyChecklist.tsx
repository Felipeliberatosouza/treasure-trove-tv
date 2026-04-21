import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ClipboardCheck, ExternalLink } from "lucide-react";
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
}

const storageKey = (lessonId: string) => `lesson-ready-checklist:${lessonId}`;

const LessonReadyChecklist = ({
  lessonId,
  durationMinutes,
  cancelHours,
  meetingUrl,
}: LessonReadyChecklistProps) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(lessonId));
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [lessonId]);

  const toggle = (id: string, value: boolean) => {
    const next = { ...checked, [id]: value };
    setChecked(next);
    try {
      localStorage.setItem(storageKey(lessonId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const totalChecked = ITEMS.filter((i) => checked[i.id]).length;
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
          Preparado para a aula?
        </p>
        <span className="text-[11px] text-muted-foreground">
          {totalChecked}/{ITEMS.length}
        </span>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const isChecked = !!checked[item.id];
          return (
            <li key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`${lessonId}-${item.id}`}
                checked={isChecked}
                onCheckedChange={(v) => toggle(item.id, v === true)}
                className="mt-0.5"
              />
              <label
                htmlFor={`${lessonId}-${item.id}`}
                className={cn(
                  "text-xs leading-relaxed cursor-pointer text-muted-foreground",
                  isChecked && "line-through",
                )}
              >
                {item.label({ durationMinutes, cancelHours, meetingUrl })}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LessonReadyChecklist;