/**
 * Determina se a agenda do professor está "desatualizada" (mais de 7 dias sem nenhuma alteração).
 *
 * A agenda é composta por dois conjuntos:
 *  - disponibilidade recorrente (`teacher_availability_recurring`)
 *  - exceções pontuais (`teacher_availability_exceptions`)
 *
 * Considera-se a agenda atualizada se o maior `updated_at` entre os dois conjuntos for posterior
 * ao limite de N dias (padrão: 7) em relação ao instante `now`.
 *
 * Regra:
 *  - Se o professor NUNCA configurou agenda (ambos os timestamps ausentes/inválidos), a agenda
 *    é tratada como desatualizada (precisa ser configurada).
 *  - Caso contrário, é desatualizada quando `now - max(recurring, exception) > thresholdDays`.
 */
export const STALE_AGENDA_THRESHOLD_DAYS = 7;

const toMillis = (value: string | Date | null | undefined): number => {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

export interface AgendaFreshnessInput {
  recurringUpdatedAt: string | Date | null | undefined;
  exceptionUpdatedAt: string | Date | null | undefined;
  now?: Date;
  thresholdDays?: number;
}

export const isAgendaOutdated = ({
  recurringUpdatedAt,
  exceptionUpdatedAt,
  now = new Date(),
  thresholdDays = STALE_AGENDA_THRESHOLD_DAYS,
}: AgendaFreshnessInput): boolean => {
  const lastRecurring = toMillis(recurringUpdatedAt);
  const lastException = toMillis(exceptionUpdatedAt);
  const lastUpdate = Math.max(lastRecurring, lastException);

  // Nunca configurada → tratada como desatualizada
  if (lastUpdate === 0) return true;

  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastUpdate > thresholdMs;
};