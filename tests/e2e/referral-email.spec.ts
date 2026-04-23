/**
 * E2E coverage for the "Receber por e-mail" button in StudentCashbackTab.
 *
 * Uses the dev-only harness mounted at `/__test/referral-email`, which
 * mirrors the production sendByEmail pipeline (sendingEmail state,
 * disabled button while in-flight, idempotencyKey shape) but mocks
 * supabase.functions.invoke so we can assert exactly how many sends
 * fire and what idempotency keys they carry.
 *
 * Each spec proves a specific guarantee against duplicate emails:
 *   1. Burst double-click → only ONE invoke (UI re-entrancy guard).
 *   2. Forced re-renders mid- and post-flight do NOT cause extra invokes.
 *   3. With Date.now() pinned, two sequential clicks produce IDENTICAL
 *      idempotencyKeys — so even if the network retried, the Lovable
 *      transactional-email pipeline would dedupe server-side.
 *   4. While a send is genuinely in-flight ("hang" mode), additional
 *      clicks are rejected at the UI layer.
 *   5. After a failed send, the button re-enables and the user can
 *      retry — but each retry gets its own idempotencyKey (not the
 *      stale one from the failed attempt), so the new send is treated
 *      as a new logical email.
 */
import { test, expect } from "../../playwright-fixture";

test.describe("Referral email — duplicate-send safety", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/referral-email");
    await expect(page.getByTestId("send-email-button")).toBeVisible();
    await page.evaluate(() => window.__resetReferralHarness?.());
  });

  test("burst double-click fires the invoke only once", async ({ page }) => {
    const btn = page.getByTestId("send-email-button");

    // Two clicks back-to-back without awaiting between them. The
    // sendingEmail state + disabled prop must collapse them into a
    // single invoke.
    await Promise.all([btn.click(), btn.click()]);

    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("success-count")).toHaveText("1");
    await expect(page.getByTestId("error-count")).toHaveText("0");
    await expect(page.getByTestId("last-toast")).toHaveText(
      "Enviamos o link de indicação para o seu e-mail!",
    );
    await expect(page.getByTestId("sending-state")).toHaveText("false");

    const captured = await page.evaluate(
      () => window.__referralCapturedInvokes ?? [],
    );
    expect(captured).toHaveLength(1);
    expect(captured[0].templateName).toBe("cashback-referral-share");
    expect(captured[0].idempotencyKey).toMatch(
      /^cashback-referral-share-user-test-123-\d+$/,
    );
  });

  test("five rapid clicks still produce a single invoke", async ({ page }) => {
    const btn = page.getByTestId("send-email-button");

    await Promise.all([
      btn.click(),
      btn.click(),
      btn.click(),
      btn.click(),
      btn.click(),
    ]);

    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("success-count")).toHaveText("1");
    await expect(page.getByTestId("unique-idempotency-keys")).toHaveText("1");
  });

  test("forced re-renders during/after a send do not trigger extra invokes", async ({
    page,
  }) => {
    const btn = page.getByTestId("send-email-button");

    // Click once, then force several re-renders (StrictMode / parent
    // re-render simulation). The send pipeline is event-driven, not
    // effect-driven, so re-rendering must NEVER produce a second invoke.
    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("1");

    await page.evaluate(() => {
      window.__forceRerenderReferral?.();
      window.__forceRerenderReferral?.();
      window.__forceRerenderReferral?.();
    });

    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("success-count")).toHaveText("1");
    await expect(page.getByTestId("unique-idempotency-keys")).toHaveText("1");
  });

  test("while a send is in-flight, additional clicks are rejected at the UI", async ({
    page,
  }) => {
    // Pin the mock to "hang" so the send never resolves and the
    // disabled-button guard is exercised against subsequent clicks.
    await page.evaluate(() => {
      window.__setReferralInvokeBehavior?.("hang");
    });

    const btn = page.getByTestId("send-email-button");
    await btn.click();

    await expect(page.getByTestId("sending-state")).toHaveText("true");
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(btn).toBeDisabled();

    // force=true bypasses Playwright's actionability check (which
    // would otherwise wait for the disabled button to enable).
    // Production browsers also drop these clicks because the button
    // is disabled — this proves the guard.
    await btn.click({ force: true });
    await btn.click({ force: true });
    await btn.click({ force: true });

    await expect(page.getByTestId("invoke-count")).toHaveText("1");
  });

  test("with Date.now() pinned, repeated clicks at the same moment produce identical idempotency keys", async ({
    page,
  }) => {
    // Pin the timestamp so we can prove the idempotencyKey shape is
    // stable per "moment". In production, two near-simultaneous
    // clicks (e.g., a network retry of the same logical send) would
    // hit the same Date.now() millisecond and the Lovable
    // transactional-email pipeline would dedupe them server-side via
    // the idempotencyKey.
    await page.evaluate(() => {
      window.__setReferralNowFn?.(() => 1700000000000);
    });

    const btn = page.getByTestId("send-email-button");

    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("sending-state")).toHaveText("false");

    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("2");
    await expect(page.getByTestId("success-count")).toHaveText("2");

    // Both sends carry the SAME idempotency key — the server-side
    // pipeline would collapse them into one logical email.
    await expect(page.getByTestId("unique-idempotency-keys")).toHaveText("1");

    const captured = await page.evaluate(
      () => window.__referralCapturedInvokes ?? [],
    );
    expect(captured).toHaveLength(2);
    expect(captured[0].idempotencyKey).toBe(
      "cashback-referral-share-user-test-123-1700000000000",
    );
    expect(captured[1].idempotencyKey).toBe(captured[0].idempotencyKey);
  });

  test("after a failed send the user can retry, and the retry gets a fresh idempotency key", async ({
    page,
  }) => {
    const btn = page.getByTestId("send-email-button");

    // First attempt: simulate a failure response.
    await page.evaluate(() => {
      window.__setReferralInvokeBehavior?.("error");
      // Pin time so we can compare keys deterministically.
      window.__setReferralNowFn?.(() => 1700000000000);
    });
    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("error-count")).toHaveText("1");
    await expect(page.getByTestId("sending-state")).toHaveText("false");
    await expect(btn).toBeEnabled();

    // Now flip back to success and advance the pinned clock by 5s.
    await page.evaluate(() => {
      window.__setReferralInvokeBehavior?.("success");
      window.__setReferralNowFn?.(() => 1700000005000);
    });
    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("2");
    await expect(page.getByTestId("success-count")).toHaveText("1");

    // Two distinct keys — the retry is treated as a new logical send,
    // not a duplicate of the failed attempt.
    await expect(page.getByTestId("unique-idempotency-keys")).toHaveText("2");

    const captured = await page.evaluate(
      () => window.__referralCapturedInvokes ?? [],
    );
    expect(captured[0].idempotencyKey).toBe(
      "cashback-referral-share-user-test-123-1700000000000",
    );
    expect(captured[1].idempotencyKey).toBe(
      "cashback-referral-share-user-test-123-1700000005000",
    );
  });

  test("repeated full runs after __resetReferralHarness behave identically", async ({
    page,
  }) => {
    // Same flow three times in a row on the same page, with a reset
    // between iterations. Proves the harness reset hook fully clears
    // captured invokes / counters and that the pipeline is
    // deterministic across repeated executions.
    const btn = page.getByTestId("send-email-button");

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__resetReferralHarness?.());

      await expect(page.getByTestId("invoke-count")).toHaveText("0");
      await expect(page.getByTestId("success-count")).toHaveText("0");
      await expect(page.getByTestId("error-count")).toHaveText("0");
      await expect(page.getByTestId("last-toast")).toHaveText("");

      await Promise.all([btn.click(), btn.click(), btn.click()]);

      await expect(page.getByTestId("invoke-count")).toHaveText("1");
      await expect(page.getByTestId("success-count")).toHaveText("1");
      await expect(page.getByTestId("unique-idempotency-keys")).toHaveText("1");
      await expect(page.getByTestId("last-toast")).toHaveText(
        "Enviamos o link de indicação para o seu e-mail!",
      );
    }
  });

  test("accessibility: button exposes correct disabled/busy state and accessible name during loading", async ({
    page,
  }) => {
    const btn = page.getByTestId("send-email-button");
    const liveRegion = page.getByTestId("send-status-live");

    // --- Idle baseline ---------------------------------------------------
    // Before any click the button must be enabled, NOT busy, and expose
    // a clear accessible name describing the action (not the loading
    // state). The live region announces a neutral "ready" message.
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveAttribute("aria-busy", "false");
    await expect(btn).toHaveAttribute(
      "aria-label",
      "Receber link de indicação por e-mail",
    );
    await expect(btn).toHaveAccessibleName(
      "Receber link de indicação por e-mail",
    );
    await expect(btn).toHaveRole("button");
    await expect(liveRegion).toHaveAttribute("role", "status");
    await expect(liveRegion).toHaveAttribute("aria-live", "polite");
    await expect(liveRegion).toHaveText(
      "Pronto para enviar o link de indicação.",
    );

    // --- In-flight state -------------------------------------------------
    // Pin the mock to "hang" so we can inspect the loading attributes
    // without racing the resolution.
    await page.evaluate(() => {
      window.__setReferralInvokeBehavior?.("hang");
    });
    await btn.click();

    await expect(page.getByTestId("sending-state")).toHaveText("true");
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute("aria-busy", "true");
    await expect(btn).toHaveAttribute("aria-disabled", "true");
    // Accessible name must change to describe the loading action so
    // screen readers don't keep announcing "Receber por e-mail" while
    // a send is in progress.
    await expect(btn).toHaveAttribute(
      "aria-label",
      "Enviando link de indicação por e-mail",
    );
    await expect(btn).toHaveAccessibleName(
      "Enviando link de indicação por e-mail",
    );
    // Live region announces the in-flight state.
    await expect(liveRegion).toHaveText(
      "Enviando link de indicação por e-mail…",
    );

    // The decorative icon must be hidden from assistive tech so the
    // accessible name is not polluted by the lucide SVG.
    const iconAriaHidden = await btn.locator("svg").first().getAttribute(
      "aria-hidden",
    );
    expect(iconAriaHidden).toBe("true");

    // --- Recovery to enabled state after success -------------------------
    await page.evaluate(() => window.__resetReferralHarness?.());
    await page.evaluate(() => {
      window.__setReferralInvokeBehavior?.("success");
    });
    await btn.click();

    await expect(page.getByTestId("sending-state")).toHaveText("false");
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveAttribute("aria-busy", "false");
    await expect(btn).toHaveAttribute("aria-disabled", "false");
    await expect(btn).toHaveAccessibleName(
      "Receber link de indicação por e-mail",
    );
    // Live region updates to the success toast text.
    await expect(liveRegion).toHaveText(
      "Enviamos o link de indicação para o seu e-mail!",
    );

    // --- Recovery to enabled state after error ---------------------------
    await page.evaluate(() => window.__resetReferralHarness?.());
    await page.evaluate(() => {
      window.__setReferralInvokeBehavior?.("error");
    });
    await btn.click();

    await expect(page.getByTestId("sending-state")).toHaveText("false");
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveAttribute("aria-busy", "false");
    await expect(btn).toHaveAccessibleName(
      "Receber link de indicação por e-mail",
    );
    await expect(liveRegion).toHaveText(
      "Não foi possível enviar agora. Tente novamente em instantes.",
    );
  });
});