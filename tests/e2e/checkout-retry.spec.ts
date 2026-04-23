/**
 * E2E coverage for checkout retry safety.
 *
 * Uses the dev-only test harness mounted at `/__test/checkout-retry`,
 * which exercises the same retry / cashback decision pipeline as the
 * real Checkout page (classifyCheckoutResponse + classifyStripeConfirm
 * + the toast/navigate side-effects). The harness lets the test seed a
 * queue of mocked server responses on `window.__mockCheckoutResponses`
 * — so we can faithfully simulate a double-click or a network retry
 * without needing Stripe Elements, Supabase auth, or a live backend.
 *
 * Each spec asserts:
 *   1. The "server" was invoked the expected number of times
 *      (re-entrancy guard prevents double-fire on rapid clicks).
 *   2. Cashback is NEVER reapplied across retries — the cumulative
 *      cashback applied equals what the server reported on the first
 *      successful call only.
 *   3. The user sees the right toast and lands on the right URL.
 */
import { test, expect } from "../../playwright-fixture";

test.describe("Checkout retry & double-click safety", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/__test/checkout-retry");
    await expect(page.getByTestId("pay-button")).toBeVisible();
    // Belt-and-braces: even though Playwright gives each test a
    // fresh page, calling __resetHarness here means a future test
    // that re-uses the same page (or a manually chained scenario)
    // always starts from a known-clean slate — empty mock queue,
    // navigatedRef cleared, all counters back to zero.
    await page.evaluate(() => window.__resetHarness?.());
  });

  test("double-click only fires the server call once", async ({ page }) => {
    // Seed a single happy-path response. If the re-entrancy guard
    // fails, the second click will pop nothing off the queue and the
    // harness will surface "No mock response queued" as an error.
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            clientSecret: "pi_test_secret",
            cashbackApplied: 5,
          },
          stripe: { paymentIntentStatus: "succeeded" },
        },
      ];
    });

    const btn = page.getByTestId("pay-button");
    // Fire two clicks back-to-back without awaiting between them.
    await Promise.all([btn.click(), btn.click()]);

    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("5.00");
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
    await expect(page.getByTestId("last-error")).toHaveText("");
  });

  test("retry after alreadyCompleted shows correct toast and skips 3DS", async ({
    page,
  }) => {
    // First click → success (server consumes R$ 5 of cashback).
    // Second click (user reloads / retries) → server returns
    // alreadyCompleted with cashbackApplied: 0.
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            clientSecret: "pi_test_secret",
            cashbackApplied: 5,
          },
          stripe: { paymentIntentStatus: "succeeded" },
        },
        {
          data: {
            ok: true,
            alreadyCompleted: true,
            cashbackApplied: 0,
            message:
              "Esta aula já foi comprada anteriormente. Acesse pelo seu painel.",
          },
        },
      ];
    });

    const btn = page.getByTestId("pay-button");

    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");

    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("2");
    // Cashback total stays at the original 5 — not 5 + 0 reapplied.
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("5.00");
    await expect(page.getByTestId("last-toast")).toContainText(
      "já foi comprada",
    );
    await expect(page.getByTestId("last-navigate")).toContainText("/aula/");
    await expect(page.getByTestId("last-error")).toHaveText("");
  });

  test("subscription retry → alreadyActive lands on subscription tab", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "subscription";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            alreadyActive: true,
            cashbackApplied: 0,
          },
        },
      ];
    });

    await page.getByTestId("pay-button").click();

    await expect(page.getByTestId("last-toast")).toHaveText(
      "Você já possui uma assinatura ativa.",
    );
    await expect(page.getByTestId("last-navigate")).toHaveText(
      "/dashboard?tab=subscription",
    );
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("0.00");
  });

  test("Stripe network retry on already-succeeded PI is treated as success", async ({
    page,
  }) => {
    // The server creates the PI and consumes cashback once. Stripe's
    // confirmCardPayment is then called twice (network retry); the
    // second attempt fails with payment_intent_unexpected_state but
    // status is already "succeeded" — our pipeline treats this as a
    // silent retry success without reapplying cashback.
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            clientSecret: "pi_test_secret",
            cashbackApplied: 7.5,
          },
          stripe: {
            errorCode: "payment_intent_unexpected_state",
            errorMessage:
              "This PaymentIntent could not be confirmed because it has a status of succeeded.",
            paymentIntentStatus: "succeeded",
          },
        },
      ];
    });

    await page.getByTestId("pay-button").click();

    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("7.50");
    await expect(page.getByTestId("last-toast")).toHaveText(
      "Pagamento já confirmado.",
    );
    await expect(page.getByTestId("last-navigate")).toHaveText("/aula/test-id");
    await expect(page.getByTestId("last-error")).toHaveText("");
  });

  test("cashback rejection surfaces server message and does not navigate", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: false,
            error:
              "Saldo de cashback insuficiente. Máximo aplicável: R$ 3,00.",
            cashbackApplied: 0,
          },
        },
      ];
    });

    await page.getByTestId("pay-button").click();

    await expect(page.getByTestId("last-error")).toContainText(
      "Saldo de cashback insuficiente",
    );
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("0.00");
    await expect(page.getByTestId("last-navigate")).toHaveText("");
  });

  test("clicking after the queue is drained shows a queue-empty error and leaves cashback untouched", async ({
    page,
  }) => {
    // Seed exactly one happy-path response. The first click consumes
    // it; the second click finds an empty queue and the harness must
    // surface "No mock response queued" as an inline error WITHOUT:
    //   • incrementing cashback-total-applied (no server call ran)
    //   • emitting a new toast or navigation
    // This proves the harness — and by extension the production
    // pipeline — never invents cashback or side-effects when no
    // server response is available to drive a decision.
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            clientSecret: "pi_test_secret",
            cashbackApplied: 4.25,
          },
          stripe: { paymentIntentStatus: "succeeded" },
        },
      ];
    });

    const btn = page.getByTestId("pay-button");

    // First click: drains the queue, applies cashback, navigates.
    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("4.25");
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");

    // Second click: queue is empty. We expect the inline error AND
    // strict preservation of every cashback / navigation side-effect
    // from the previous click.
    await btn.click();
    await expect(page.getByTestId("last-error")).toHaveText(
      "No mock response queued",
    );
    // invokeCount still bumps because the harness counts attempts —
    // what matters is that NO new cashback was applied.
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("4.25");
    // Toast and navigate targets from the previous successful click
    // must be untouched (no new toast fired, no re-navigation).
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");
  });

  test("three sequential clicks: cashback applied once, follow-ups error without reapplying", async ({
    page,
  }) => {
    // Stress-test the full guarantee in one flow:
    //   click #1 → drains the only seeded response, applies R$ 6,75 of
    //              cashback, toasts success, navigates.
    //   click #2 → queue empty → inline "No mock response queued"
    //              error, NO new cashback, NO new toast/navigate.
    //   click #3 → queue still empty → same error surfaces again,
    //              cashback total STILL 6,75 (no reapplication ever).
    // This proves the pipeline never re-credits cashback on repeated
    // clicks once the underlying server response has been consumed.
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            clientSecret: "pi_test_secret",
            cashbackApplied: 6.75,
          },
          stripe: { paymentIntentStatus: "succeeded" },
        },
      ];
    });

    const btn = page.getByTestId("pay-button");

    // Click #1 — the only successful one.
    await btn.click();
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("6.75");
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");
    await expect(page.getByTestId("last-error")).toHaveText("");

    // Click #2 — queue is empty; expect the queue-empty error and
    // strict preservation of every prior side-effect.
    await btn.click();
    await expect(page.getByTestId("last-error")).toHaveText(
      "No mock response queued",
    );
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("6.75");
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");

    // Click #3 — same story. The error must reappear (proving the
    // handler ran) but no cashback or navigation side-effect changes.
    await btn.click();
    await expect(page.getByTestId("last-error")).toHaveText(
      "No mock response queued",
    );
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("6.75");
    await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");
  });

  test("after a successful click, duplicate Stripe callbacks and re-renders never trigger a second navigation", async ({
    page,
  }) => {
    // After the first successful click commits a navigation, the
    // production CheckoutForm uses a sticky `navigatedRef` flag so
    // that any subsequent navigate(...) — whether from a late Stripe
    // callback firing twice, or from a parent re-render replaying
    // effects — is silently dropped. The harness mirrors that flag
    // and exposes a `navigate-count` testid so we can prove the count
    // never goes above 1.
    await page.evaluate(() => {
      window.__checkoutHarnessMode = "unit";
      window.__mockCheckoutResponses = [
        {
          data: {
            ok: true,
            clientSecret: "pi_test_secret",
            cashbackApplied: 9,
          },
          stripe: { paymentIntentStatus: "succeeded" },
        },
      ];
    });

    await page.getByTestId("pay-button").click();

    // First click commits exactly one navigation.
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("navigate-count")).toHaveText("1");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("9.00");

    // Simulate Stripe firing a duplicate "succeeded" callback after
    // we'd already redirected, then force a React re-render.
    // Production-equivalent of: a late confirmCardPayment promise
    // resolution + StrictMode double-effect invocation.
    await page.evaluate(() => {
      window.__simulateDuplicateStripeCallback?.();
      window.__simulateDuplicateStripeCallback?.();
      window.__forceRerender?.();
      window.__simulateDuplicateStripeCallback?.();
    });

    // navigate-count must STILL be 1 — the sticky guard absorbed
    // every duplicate attempt.
    await expect(page.getByTestId("navigate-count")).toHaveText("1");
    await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");
    // No new server invocation, no cashback movement.
    await expect(page.getByTestId("invoke-count")).toHaveText("1");
    await expect(page.getByTestId("cashback-total-applied")).toHaveText("9.00");
    await expect(page.getByTestId("last-error")).toHaveText("");
  });

  test("repeated runs after __resetHarness produce identical results", async ({
    page,
  }) => {
    // Runs the SAME happy-path flow three times in a row on the same
    // page, calling __resetHarness between iterations. This proves:
    //   1. The reset hook fully clears mock queue, navigatedRef,
    //      cashback totals, toasts, errors and counters.
    //   2. The pipeline is deterministic — every run produces the
    //      exact same invoke-count, cashback-total-applied,
    //      navigate-count, last-toast and last-navigate.
    //   3. No state from a previous iteration can leak forward and
    //      mask a regression (e.g. a stale navigatedRef silently
    //      suppressing a navigation that should have happened).
    const btn = page.getByTestId("pay-button");

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.__resetHarness?.();
        window.__checkoutHarnessMode = "unit";
        window.__mockCheckoutResponses = [
          {
            data: {
              ok: true,
              clientSecret: "pi_test_secret",
              cashbackApplied: 3.5,
            },
            stripe: { paymentIntentStatus: "succeeded" },
          },
        ];
      });

      // Post-reset baseline: every counter and surface is empty.
      await expect(page.getByTestId("invoke-count")).toHaveText("0");
      await expect(page.getByTestId("cashback-total-applied")).toHaveText("0.00");
      await expect(page.getByTestId("navigate-count")).toHaveText("0");
      await expect(page.getByTestId("last-toast")).toHaveText("");
      await expect(page.getByTestId("last-navigate")).toHaveText("");
      await expect(page.getByTestId("last-error")).toHaveText("");

      await btn.click();

      // Identical outcomes on every iteration.
      await expect(page.getByTestId("invoke-count")).toHaveText("1");
      await expect(page.getByTestId("cashback-total-applied")).toHaveText("3.50");
      await expect(page.getByTestId("navigate-count")).toHaveText("1");
      await expect(page.getByTestId("last-toast")).toHaveText("Pagamento aprovado!");
      await expect(page.getByTestId("last-navigate")).toHaveText("/payment-success");
      await expect(page.getByTestId("last-error")).toHaveText("");
    }
  });
});