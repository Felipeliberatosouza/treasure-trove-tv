/**
 * Browser detection and per-browser default tolerance for VTT shift validation.
 *
 * Different browsers/engines round WebVTT cue timestamps slightly
 * differently. We pick a sensible default tolerance per engine, but the
 * user can always override it manually via {@link setDefaultShiftToleranceSec}.
 */

import {
  DEFAULT_SHIFT_TOLERANCE_SEC,
  setDefaultShiftToleranceSec,
} from "./vttSync";

export type BrowserKind =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "opera"
  | "samsung"
  | "ie"
  | "unknown";

export interface DetectedBrowser {
  kind: BrowserKind;
  label: string;
  toleranceSec: number;
  userAgent: string;
}

/**
 * Recommended default tolerance (in seconds) per browser engine.
 * Chromium-based engines round consistently to 1ms; Firefox and Safari
 * have historically shown larger drift with cue start times. IE/legacy
 * engines get the loosest margin.
 */
export const BROWSER_TOLERANCE_PRESETS: Record<BrowserKind, number> = {
  chrome: 0.002,
  edge: 0.002,
  opera: 0.002,
  samsung: 0.003,
  firefox: 0.005,
  safari: 0.008,
  ie: 0.015,
  unknown: DEFAULT_SHIFT_TOLERANCE_SEC,
};

const BROWSER_LABELS: Record<BrowserKind, string> = {
  chrome: "Google Chrome",
  edge: "Microsoft Edge",
  opera: "Opera",
  samsung: "Samsung Internet",
  firefox: "Mozilla Firefox",
  safari: "Safari",
  ie: "Internet Explorer",
  unknown: "Navegador desconhecido",
};

/** Pure detection from a user-agent string. Order matters (Edge/Opera before Chrome). */
export const detectBrowserFromUserAgent = (userAgent: string): BrowserKind => {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/edg\//.test(ua) || /edge\//.test(ua)) return "edge";
  if (/opr\//.test(ua) || /opera/.test(ua)) return "opera";
  if (/samsungbrowser/.test(ua)) return "samsung";
  if (/firefox\//.test(ua) || /fxios/.test(ua)) return "firefox";
  if (/chrome\//.test(ua) || /crios/.test(ua)) return "chrome";
  if (/safari\//.test(ua) && /version\//.test(ua)) return "safari";
  if (/msie |trident\//.test(ua)) return "ie";
  return "unknown";
};

/** Detect the current browser using `navigator.userAgent` (SSR-safe). */
export const detectCurrentBrowser = (): DetectedBrowser => {
  const ua =
    typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
      ? navigator.userAgent
      : "";
  const kind = detectBrowserFromUserAgent(ua);
  return {
    kind,
    label: BROWSER_LABELS[kind],
    toleranceSec: BROWSER_TOLERANCE_PRESETS[kind],
    userAgent: ua,
  };
};

const STORAGE_KEY = "vttShiftToleranceSec";
const STORAGE_SOURCE_KEY = "vttShiftToleranceSource";

export type ToleranceSource = "manual" | "auto";

let lastDetected: DetectedBrowser | null = null;
let currentSource: ToleranceSource = "auto";

/**
 * Apply the auto-detected tolerance for the current browser, unless the
 * user has previously set a manual override (persisted in localStorage).
 * Returns details about what was applied.
 */
export const initBrowserShiftTolerance = (): {
  detected: DetectedBrowser;
  appliedSec: number;
  source: ToleranceSource;
} => {
  const detected = detectCurrentBrowser();
  lastDetected = detected;

  let appliedSec = detected.toleranceSec;
  let source: ToleranceSource = "auto";

  try {
    if (typeof localStorage !== "undefined") {
      const storedSource = localStorage.getItem(STORAGE_SOURCE_KEY);
      const storedValue = localStorage.getItem(STORAGE_KEY);
      if (storedSource === "manual" && storedValue) {
        const parsed = Number(storedValue);
        if (Number.isFinite(parsed) && parsed >= 0) {
          appliedSec = parsed;
          source = "manual";
        }
      }
    }
  } catch {
    // ignore storage access failures (privacy mode, etc.)
  }

  setDefaultShiftToleranceSec(appliedSec);
  currentSource = source;

  if (typeof console !== "undefined") {
    console.info(
      `[VTT Tolerance] ${detected.label} → ${(appliedSec * 1000).toFixed(1)}ms (${source === "manual" ? "manual override" : "auto"})`,
    );
  }

  return { detected, appliedSec, source };
};

/** Manually override the global tolerance and persist the preference. */
export const setManualShiftTolerance = (toleranceSec: number): void => {
  if (!Number.isFinite(toleranceSec) || toleranceSec < 0) {
    throw new Error("toleranceSec must be a non-negative finite number");
  }
  setDefaultShiftToleranceSec(toleranceSec);
  currentSource = "manual";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(toleranceSec));
      localStorage.setItem(STORAGE_SOURCE_KEY, "manual");
    }
  } catch {
    // ignore
  }
};

/** Clear any manual override and reapply the auto-detected tolerance. */
export const resetShiftToleranceToAuto = (): DetectedBrowser => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_SOURCE_KEY);
    }
  } catch {
    // ignore
  }
  const detected = lastDetected ?? detectCurrentBrowser();
  lastDetected = detected;
  setDefaultShiftToleranceSec(detected.toleranceSec);
  currentSource = "auto";
  return detected;
};

/** Last detected browser (or detect now if init was never called). */
export const getDetectedBrowser = (): DetectedBrowser =>
  lastDetected ?? detectCurrentBrowser();

/** Whether the active tolerance came from auto-detection or a manual override. */
export const getShiftToleranceSource = (): ToleranceSource => currentSource;