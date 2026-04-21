import { describe, it, expect, afterEach } from "vitest";
import {
  shiftVtt,
  secondsToVttTimestamp,
  setDefaultShiftToleranceSec,
  getDefaultShiftToleranceSec,
  DEFAULT_SHIFT_TOLERANCE_SEC,
} from "../vttSync";

const SAMPLE_VTT = `WEBVTT

1
00:00:00.500 --> 00:00:02.000
Olá pessoal

2
00:00:02.500 --> 00:00:05.250
Vamos começar a aula

3
00:00:10.100 --> 00:00:12.800
Anotem este conceito
`;

describe("shiftVtt", () => {
  it("returns vtt unchanged when offset is 0", () => {
    const r = shiftVtt(SAMPLE_VTT, 0);
    expect(r.vtt).toBe(SAMPLE_VTT);
    expect(r.valid).toBe(true);
  });

  it("shifts every cue by the offset", () => {
    const r = shiftVtt(SAMPLE_VTT, 4);
    expect(r.cueCount).toBe(3);
    expect(r.vtt).toContain("00:00:04.500 --> 00:00:06.000");
    expect(r.vtt).toContain("00:00:06.500 --> 00:00:09.250");
    expect(r.vtt).toContain("00:00:14.100 --> 00:00:16.800");
  });

  it("validates samples within tolerance", () => {
    const r = shiftVtt(SAMPLE_VTT, 4);
    expect(r.valid).toBe(true);
    expect(r.samples).toHaveLength(3);
    for (const s of r.samples) {
      expect(s.delta).toBeLessThan(0.002);
      expect(s.shiftedStart).toBeCloseTo(s.expectedStart, 3);
    }
  });

  it("formats timestamps correctly", () => {
    expect(secondsToVttTimestamp(0)).toBe("00:00:00.000");
    expect(secondsToVttTimestamp(4.5)).toBe("00:00:04.500");
    expect(secondsToVttTimestamp(3661.123)).toBe("01:01:01.123");
  });

  describe("tolerance configuration", () => {
    afterEach(() => {
      setDefaultShiftToleranceSec(DEFAULT_SHIFT_TOLERANCE_SEC);
    });

    it("uses the default tolerance when none is provided", () => {
      const r = shiftVtt(SAMPLE_VTT, 4);
      expect(r.toleranceSec).toBe(DEFAULT_SHIFT_TOLERANCE_SEC);
      expect(r.valid).toBe(true);
    });

    it("respects per-call tolerance override", () => {
      const r = shiftVtt(SAMPLE_VTT, 4, { toleranceSec: 0.05 });
      expect(r.toleranceSec).toBe(0.05);
      expect(r.valid).toBe(true);
    });

    it("flags as invalid when tolerance is set to 0 with no rounding errors", () => {
      // Even an exact integer offset is fine at 0 tolerance because
      // we use strict < comparison; ensure tolerance plumbs through.
      const r = shiftVtt(SAMPLE_VTT, 4, { toleranceSec: 0 });
      expect(r.toleranceSec).toBe(0);
      // delta is 0 for exact arithmetic, but valid checks `< 0` -> false
      expect(r.valid).toBe(false);
    });

    it("allows updating the global default tolerance", () => {
      setDefaultShiftToleranceSec(0.01);
      expect(getDefaultShiftToleranceSec()).toBe(0.01);
      const r = shiftVtt(SAMPLE_VTT, 4);
      expect(r.toleranceSec).toBe(0.01);
    });

    it("rejects invalid tolerance values", () => {
      expect(() => setDefaultShiftToleranceSec(-1)).toThrow();
      expect(() => setDefaultShiftToleranceSec(Number.NaN)).toThrow();
    });
  });
});
