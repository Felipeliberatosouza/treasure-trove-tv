/**
 * VTT subtitle synchronization utilities.
 *
 * When a video is composited with an intro cover, the original audio
 * (and therefore the transcript timestamps) start playing only after
 * the intro finishes. This module shifts all cue timestamps forward
 * by the intro offset and validates the result with a sample check.
 */

const TIMESTAMP_RE =
  /(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/g;

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

export const secondsToVttTimestamp = (totalSeconds: number): string => {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
};

export const vttTimestampToSeconds = (
  h: string,
  m: string,
  s: string,
  ms: string,
): number =>
  Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

export interface ShiftSample {
  originalStart: number;
  shiftedStart: number;
  expectedStart: number;
  delta: number;
}

export interface ShiftResult {
  vtt: string;
  cueCount: number;
  offsetSec: number;
  samples: ShiftSample[];
  valid: boolean;
  toleranceSec: number;
}

/**
 * Default validation tolerance in seconds. WebVTT timestamps have a
 * resolution of 1ms (3 decimal digits), so 2ms covers a single rounding
 * step on each side. Override per-call via {@link shiftVtt}'s options or
 * globally via {@link setDefaultShiftToleranceSec} when targeting browsers
 * that need a looser margin.
 */
export const DEFAULT_SHIFT_TOLERANCE_SEC = 0.002;

let currentDefaultToleranceSec = DEFAULT_SHIFT_TOLERANCE_SEC;

/** Update the global default tolerance used by `shiftVtt` when no override is passed. */
export const setDefaultShiftToleranceSec = (toleranceSec: number): void => {
  if (!Number.isFinite(toleranceSec) || toleranceSec < 0) {
    throw new Error("toleranceSec must be a non-negative finite number");
  }
  currentDefaultToleranceSec = toleranceSec;
};

/** Read the current global default tolerance (seconds). */
export const getDefaultShiftToleranceSec = (): number => currentDefaultToleranceSec;

export interface ShiftOptions {
  /** Validation tolerance in seconds. Defaults to {@link getDefaultShiftToleranceSec}. */
  toleranceSec?: number;
}

/**
 * Shift every cue timestamp in a VTT string by `offsetSec` seconds.
 * Performs a sample validation comparing 3 cues (first, middle, last)
 * to ensure each shifted start equals original + offset within
 * `options.toleranceSec` (defaults to {@link DEFAULT_SHIFT_TOLERANCE_SEC}).
 */
export const shiftVtt = (
  vtt: string,
  offsetSec: number,
  options: ShiftOptions = {},
): ShiftResult => {
  const toleranceSec = options.toleranceSec ?? currentDefaultToleranceSec;
  if (!vtt || offsetSec === 0) {
    return { vtt, cueCount: 0, offsetSec, samples: [], valid: true, toleranceSec };
  }

  const originalStarts: number[] = [];
  const shiftedStarts: number[] = [];

  const shifted = vtt.replace(
    TIMESTAMP_RE,
    (_m, h1, m1, s1, ms1, h2, m2, s2, ms2) => {
      const start = vttTimestampToSeconds(h1, m1, s1, ms1);
      const end = vttTimestampToSeconds(h2, m2, s2, ms2);
      const newStart = start + offsetSec;
      const newEnd = end + offsetSec;
      originalStarts.push(start);
      shiftedStarts.push(newStart);
      return `${secondsToVttTimestamp(newStart)} --> ${secondsToVttTimestamp(newEnd)}`;
    },
  );

  // Sample validation: first, middle, last cue
  const samples: ShiftSample[] = [];
  if (originalStarts.length > 0) {
    const indexes = Array.from(
      new Set([
        0,
        Math.floor(originalStarts.length / 2),
        originalStarts.length - 1,
      ]),
    );
    for (const i of indexes) {
      const expected = originalStarts[i] + offsetSec;
      const actual = shiftedStarts[i];
      samples.push({
        originalStart: originalStarts[i],
        shiftedStart: actual,
        expectedStart: expected,
        delta: Math.abs(actual - expected),
      });
    }
  }

  const valid = samples.every((s) => s.delta < toleranceSec);
  return {
    vtt: shifted,
    cueCount: originalStarts.length,
    offsetSec,
    samples,
    toleranceSec,
    valid,
  };
};
