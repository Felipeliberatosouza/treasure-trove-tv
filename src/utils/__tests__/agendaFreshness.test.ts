import { describe, it, expect } from "vitest";
import { isAgendaOutdated, STALE_AGENDA_THRESHOLD_DAYS } from "@/utils/agendaFreshness";

const NOW = new Date("2026-04-26T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("isAgendaOutdated", () => {
  it("considera desatualizada quando nenhuma das fontes possui updated_at", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: null,
        exceptionUpdatedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("considera desatualizada quando ambos updated_at estão acima de 7 dias", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(10),
        exceptionUpdatedAt: daysAgo(8),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("considera atualizada se a recorrente foi atualizada há menos de 7 dias", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(2),
        exceptionUpdatedAt: daysAgo(30),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("considera atualizada se a exceção foi atualizada há menos de 7 dias", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(30),
        exceptionUpdatedAt: daysAgo(1),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("usa o updated_at mais recente entre recorrente e exceções", () => {
    // Recurring é antigo, exceção é recente → atualizada
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(20),
        exceptionUpdatedAt: daysAgo(3),
        now: NOW,
      }),
    ).toBe(false);

    // Exceção é antiga, recorrente é recente → atualizada
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(1),
        exceptionUpdatedAt: daysAgo(20),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("não marca como desatualizada exatamente no limite de 7 dias", () => {
    const exact = new Date(NOW.getTime() - STALE_AGENDA_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: exact,
        exceptionUpdatedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("marca como desatualizada um milissegundo após o limite", () => {
    const justOver = new Date(
      NOW.getTime() - STALE_AGENDA_THRESHOLD_DAYS * 24 * 60 * 60 * 1000 - 1,
    );
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: justOver,
        exceptionUpdatedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("aceita valores Date e string ISO indistintamente", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(2).toISOString(),
        exceptionUpdatedAt: daysAgo(30).toISOString(),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("ignora valores inválidos sem quebrar (trata como ausentes)", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: "not-a-date",
        exceptionUpdatedAt: undefined,
        now: NOW,
      }),
    ).toBe(true);

    expect(
      isAgendaOutdated({
        recurringUpdatedAt: "not-a-date",
        exceptionUpdatedAt: daysAgo(1),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("respeita um thresholdDays customizado", () => {
    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(3),
        exceptionUpdatedAt: null,
        now: NOW,
        thresholdDays: 2,
      }),
    ).toBe(true);

    expect(
      isAgendaOutdated({
        recurringUpdatedAt: daysAgo(3),
        exceptionUpdatedAt: null,
        now: NOW,
        thresholdDays: 5,
      }),
    ).toBe(false);
  });
});