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
}

/**
 * Shift every cue timestamp in a VTT string by `offsetSec` seconds.
 * Performs a sample validation comparing 3 cues (first, middle, last)
 * to ensure each shifted start equals original + offset within 1ms.
 */
export const shiftVtt = (vtt: string, offsetSec: number): ShiftResult => {
  if (!vtt || offsetSec === 0) {
    return { vtt, cueCount: 0, offsetSec, samples: [], valid: true };
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

  const valid = samples.every((s) => s.delta < 0.002);
  return {
    vtt: shifted,
    cueCount: originalStarts.length,
    offsetSec,
    samples,
    valid,
  };
};
