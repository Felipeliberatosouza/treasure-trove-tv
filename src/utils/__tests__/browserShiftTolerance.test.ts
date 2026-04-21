import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectBrowserFromUserAgent,
  BROWSER_TOLERANCE_PRESETS,
  initBrowserShiftTolerance,
  setManualShiftTolerance,
  resetShiftToleranceToAuto,
  getShiftToleranceSource,
} from "../browserShiftTolerance";
import {
  getDefaultShiftToleranceSec,
  setDefaultShiftToleranceSec,
  DEFAULT_SHIFT_TOLERANCE_SEC,
} from "../vttSync";

const UA = {
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  opera:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.0.0",
  samsung:
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  ie: "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
  unknown: "SomeBot/1.0",
};

describe("detectBrowserFromUserAgent", () => {
  it("detects Edge before Chrome", () => {
    expect(detectBrowserFromUserAgent(UA.edge)).toBe("edge");
  });
  it("detects Opera before Chrome", () => {
    expect(detectBrowserFromUserAgent(UA.opera)).toBe("opera");
  });
  it("detects Samsung Internet", () => {
    expect(detectBrowserFromUserAgent(UA.samsung)).toBe("samsung");
  });
  it("detects Chrome", () => {
    expect(detectBrowserFromUserAgent(UA.chrome)).toBe("chrome");
  });
  it("detects Firefox", () => {
    expect(detectBrowserFromUserAgent(UA.firefox)).toBe("firefox");
  });
  it("detects Safari (only with Version/)", () => {
    expect(detectBrowserFromUserAgent(UA.safari)).toBe("safari");
  });
  it("detects Internet Explorer", () => {
    expect(detectBrowserFromUserAgent(UA.ie)).toBe("ie");
  });
  it("falls back to unknown", () => {
    expect(detectBrowserFromUserAgent(UA.unknown)).toBe("unknown");
    expect(detectBrowserFromUserAgent("")).toBe("unknown");
  });
});

describe("initBrowserShiftTolerance + manual override", () => {
  beforeEach(() => {
    localStorage.clear();
    setDefaultShiftToleranceSec(DEFAULT_SHIFT_TOLERANCE_SEC);
  });
  afterEach(() => {
    localStorage.clear();
    setDefaultShiftToleranceSec(DEFAULT_SHIFT_TOLERANCE_SEC);
  });

  it("applies the auto-detected preset for the current browser", () => {
    const result = initBrowserShiftTolerance();
    expect(result.source).toBe("auto");
    expect(result.appliedSec).toBe(
      BROWSER_TOLERANCE_PRESETS[result.detected.kind],
    );
    expect(getDefaultShiftToleranceSec()).toBe(result.appliedSec);
    expect(getShiftToleranceSource()).toBe("auto");
  });

  it("persists and restores a manual override on next init", () => {
    setManualShiftTolerance(0.012);
    expect(getDefaultShiftToleranceSec()).toBe(0.012);
    expect(getShiftToleranceSource()).toBe("manual");

    const result = initBrowserShiftTolerance();
    expect(result.source).toBe("manual");
    expect(result.appliedSec).toBe(0.012);
    expect(getDefaultShiftToleranceSec()).toBe(0.012);
  });

  it("rejects invalid manual values", () => {
    expect(() => setManualShiftTolerance(-1)).toThrow();
    expect(() => setManualShiftTolerance(Number.NaN)).toThrow();
  });

  it("resetShiftToleranceToAuto clears the override and reapplies preset", () => {
    setManualShiftTolerance(0.05);
    expect(getDefaultShiftToleranceSec()).toBe(0.05);

    const detected = resetShiftToleranceToAuto();
    expect(getShiftToleranceSource()).toBe("auto");
    expect(getDefaultShiftToleranceSec()).toBe(
      BROWSER_TOLERANCE_PRESETS[detected.kind],
    );
    expect(localStorage.getItem("vttShiftToleranceSec")).toBeNull();
  });
});