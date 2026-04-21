/**
 * Integration test: composition flow + VTT sync.
 *
 * Simulates the end-to-end pipeline a teacher experiences when recording
 * a lesson:
 *   1. The original audio is transcribed and produces a WebVTT file whose
 *      timestamps are aligned to the raw recording (t=0 = first word).
 *   2. The compositor prepends a 4s intro cover before re-encoding.
 *   3. To stay in sync with the final video, every cue must be shifted
 *      forward by the intro duration.
 *
 * These tests verify that, for every supported browser preset and at
 * realistic video lengths, the resulting VTT validates within the
 * configured tolerance — i.e. the player would render captions exactly
 * on time.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  shiftVtt,
  setDefaultShiftToleranceSec,
  getDefaultShiftToleranceSec,
  DEFAULT_SHIFT_TOLERANCE_SEC,
  secondsToVttTimestamp,
} from "../vttSync";
import {
  BROWSER_TOLERANCE_PRESETS,
  type BrowserKind,
} from "../browserShiftTolerance";

const INTRO_DURATION_SEC = 4;

/**
 * Mirrors the compositor option:
 * `totalDuration = videoDuration + (introTitle ? introDurationSec : 0)`
 * and produces a transcript-like VTT covering `videoDurationSec` seconds
 * of speech with `cueCount` evenly spaced cues. Cue starts use 3-decimal
 * ms precision, exactly like real transcription output.
 */
const buildTranscriptVtt = (videoDurationSec: number, cueCount: number): string => {
  const lines: string[] = ["WEBVTT", ""];
  const step = videoDurationSec / cueCount;
  for (let i = 0; i < cueCount; i++) {
    const start = Number((i * step).toFixed(3));
    const end = Number(Math.min(videoDurationSec, start + step * 0.9).toFixed(3));
    lines.push(String(i + 1));
    lines.push(`${secondsToVttTimestamp(start)} --> ${secondsToVttTimestamp(end)}`);
    lines.push(`Cue ${i + 1}`);
    lines.push("");
  }
  return lines.join("\n");
};

/** Parse "HH:MM:SS.mmm" back into seconds. */
const parseVttTimestamp = (ts: string): number => {
  const m = ts.match(/(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!m) throw new Error(`bad timestamp: ${ts}`);
  const [, h, mm, s, ms] = m;
  return Number(h) * 3600 + Number(mm) * 60 + Number(s) + Number(ms) / 1000;
};

const extractCueStarts = (vtt: string): number[] => {
  const re = /(\d{1,2}:\d{2}:\d{2}\.\d{3})\s*-->/g;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(vtt)) !== null) {
    starts.push(parseVttTimestamp(match[1]));
  }
  return starts;
};

describe("Composition flow → VTT sync (integration)", () => {
  beforeEach(() => {
    setDefaultShiftToleranceSec(DEFAULT_SHIFT_TOLERANCE_SEC);
  });
  afterEach(() => {
    setDefaultShiftToleranceSec(DEFAULT_SHIFT_TOLERANCE_SEC);
  });

  it("shifts every transcript cue by the 4s intro offset", () => {
    const transcript = buildTranscriptVtt(60, 12);
    const originalStarts = extractCueStarts(transcript);

    const result = shiftVtt(transcript, INTRO_DURATION_SEC);
    const shiftedStarts = extractCueStarts(result.vtt);

    expect(result.cueCount).toBe(originalStarts.length);
    expect(shiftedStarts).toHaveLength(originalStarts.length);

    shiftedStarts.forEach((shifted, i) => {
      expect(shifted).toBeCloseTo(originalStarts[i] + INTRO_DURATION_SEC, 3);
    });
    expect(result.valid).toBe(true);
  });

  it("first cue starts at exactly the intro duration", () => {
    // Realistic case: speaker starts talking from second 0 of the raw
    // recording, so the first composed cue must land at t=4.000 (the end
    // of the intro cover).
    const transcript = `WEBVTT

1
${secondsToVttTimestamp(0)} --> ${secondsToVttTimestamp(2.5)}
Olá pessoal
`;
    const result = shiftVtt(transcript, INTRO_DURATION_SEC);
    expect(result.vtt).toContain(
      `${secondsToVttTimestamp(INTRO_DURATION_SEC)} --> ${secondsToVttTimestamp(6.5)}`,
    );
    expect(result.valid).toBe(true);
  });

  describe("validates within each browser preset tolerance", () => {
    const cases: Array<{ kind: BrowserKind; videoSec: number; cueCount: number }> = [
      { kind: "chrome", videoSec: 30, cueCount: 8 },
      { kind: "edge", videoSec: 60, cueCount: 15 },
      { kind: "firefox", videoSec: 120, cueCount: 30 },
      { kind: "safari", videoSec: 300, cueCount: 60 },
      { kind: "opera", videoSec: 45, cueCount: 10 },
      { kind: "samsung", videoSec: 90, cueCount: 20 },
      { kind: "ie", videoSec: 30, cueCount: 8 },
      { kind: "unknown", videoSec: 60, cueCount: 12 },
    ];

    for (const { kind, videoSec, cueCount } of cases) {
      it(`${kind}: ${videoSec}s video, ${cueCount} cues @ ${(BROWSER_TOLERANCE_PRESETS[kind] * 1000).toFixed(1)}ms`, () => {
        const tolerance = BROWSER_TOLERANCE_PRESETS[kind];
        setDefaultShiftToleranceSec(tolerance);
        expect(getDefaultShiftToleranceSec()).toBe(tolerance);

        const transcript = buildTranscriptVtt(videoSec, cueCount);
        const result = shiftVtt(transcript, INTRO_DURATION_SEC);

        expect(result.toleranceSec).toBe(tolerance);
        expect(result.cueCount).toBe(cueCount);
        expect(result.valid).toBe(true);
        for (const sample of result.samples) {
          expect(sample.delta).toBeLessThan(tolerance);
          expect(sample.shiftedStart).toBeCloseTo(
            sample.originalStart + INTRO_DURATION_SEC,
            3,
          );
        }
      });
    }
  });

  it("per-call tolerance override wins over the configured default", () => {
    setDefaultShiftToleranceSec(BROWSER_TOLERANCE_PRESETS.safari);
    const transcript = buildTranscriptVtt(45, 10);
    const result = shiftVtt(transcript, INTRO_DURATION_SEC, {
      toleranceSec: BROWSER_TOLERANCE_PRESETS.chrome,
    });
    expect(result.toleranceSec).toBe(BROWSER_TOLERANCE_PRESETS.chrome);
    expect(result.valid).toBe(true);
  });

  it("preserves cue count and ordering for a long lesson (10 min, 120 cues)", () => {
    const transcript = buildTranscriptVtt(600, 120);
    const result = shiftVtt(transcript, INTRO_DURATION_SEC);
    const starts = extractCueStarts(result.vtt);

    expect(result.cueCount).toBe(120);
    expect(starts).toHaveLength(120);
    // Strictly monotonic
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    }
    // First cue lands at the intro boundary, last cue stays within bounds
    expect(starts[0]).toBeCloseTo(INTRO_DURATION_SEC, 3);
    expect(starts[starts.length - 1]).toBeLessThan(600 + INTRO_DURATION_SEC);
    expect(result.valid).toBe(true);
  });

  it("no-op when intro is disabled (offset = 0) leaves transcript untouched", () => {
    const transcript = buildTranscriptVtt(30, 6);
    const result = shiftVtt(transcript, 0);
    expect(result.vtt).toBe(transcript);
    expect(result.valid).toBe(true);
  });
});