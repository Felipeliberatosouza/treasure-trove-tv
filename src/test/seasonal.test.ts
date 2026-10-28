import { describe, it, expect } from "vitest";
import { isInPeriod, pickActiveEvent, isBirthday, type SeasonalEvent } from "@/lib/seasonal";

const ev = (p: Partial<SeasonalEvent>): SeasonalEvent => ({
  id: "1", name: "Natal", start_md: "12-01", end_md: "12-31", icon: "🎄", effect: "snow",
  primary_color: "#f00", dark_mode: false, message: null, priority: 0, active: true, ...p,
});

describe("eventos sazonais", () => {
  it("Natal de 01/12 a 31/12 vale em 15/12 e não em 30/11", () => {
    expect(isInPeriod("12-01", "12-31", new Date(2026, 11, 15))).toBe(true);
    expect(isInPeriod("12-01", "12-31", new Date(2026, 10, 30))).toBe(false);
  });
  it("período que vira o ano funciona", () => {
    expect(isInPeriod("12-20", "01-06", new Date(2027, 0, 3))).toBe(true);
  });
  it("modo desativado = nenhum evento em execução", () => {
    expect(pickActiveEvent([ev({})], { mode: "disabled", birthday_enabled: true }, new Date(2026, 11, 15))).toBeNull();
  });
  it("evento inativo não aparece", () => {
    expect(pickActiveEvent([ev({ active: false })], { mode: "on", birthday_enabled: true }, new Date(2026, 11, 15))).toBeNull();
  });
  it("aniversário compara dia e mês", () => {
    expect(isBirthday("1990-10-28", new Date(2026, 9, 28))).toBe(true);
    expect(isBirthday("1990-10-27", new Date(2026, 9, 28))).toBe(false);
  });
});
