/**
 * Dev/E2E test harness for the checkout retry pipeline.
 *
 * Mounted at `/__test/checkout-retry` (only registered in non-production
 * builds via App.tsx). It exposes a tiny UI that:
 *
 *   1. Lets the test seed a queue of mocked server responses
 *      (window.__mockCheckoutResponses).
 *   2. Renders a "Pagar" button that, on each click, dequeues the next
 *      mock response and runs it through the SAME classification +
 *      side-effect pipeline used by the real Checkout page.
 *   3. Surfaces side-effects in the DOM with stable testids so the
 *      Playwright spec can assert on them:
 *        - data-testid="invoke-count": # of times the "server" was called
 *        - data-testid="cashback-total-applied": sum of cashbackApplied
 *          values returned by the server (proves no reapplication)
 *        - data-testid="last-toast": last toast message shown
 *        - data-testid="last-navigate": last navigate(...) target
 *        - data-testid="last-error": last inline error
 *        - data-testid="navigate-count": how many times safeNavigate
 *          ACTUALLY navigated (proves the sticky guard works under
 *          re-render and duplicate Stripe callbacks)
 *
 * The point of this harness is to verify behaviour in a real browser
 * (Playwright) without requiring Stripe Elements, Supabase auth, or a
 * real network — it's a true E2E of the *decision pipeline*.
 *
 * To exercise the post-success guards from a Playwright spec, the
 * harness exposes two hooks on window:
 *   - window.__simulateDuplicateStripeCallback() — replays the
 *     "alreadySucceededOnRetry" branch as if Stripe fired a late
 *     duplicate callback after we'd already redirected.
 *   - window.__forceRerender() — bumps a state counter to force a
 *     React re-render of the harness, simulating StrictMode or
 *     parent-driven re-renders.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  classifyCheckoutResponse,
  classifyStripeConfirm,
  type CheckoutFnResponse,
  type CheckoutMode,
} from "@/lib/checkoutRetry";

interface MockServerResponse {
  // Edge function payload
  data: CheckoutFnResponse;
  // Optional Stripe confirmCardPayment outcome (used when
  // data.clientSecret is set). If omitted, defaults to a happy path.
  stripe?: {
    errorCode?: string;
    errorMessage?: string;
    paymentIntentStatus?: string;
  };
}

declare global {
  interface Window {
    __mockCheckoutResponses?: MockServerResponse[];
    __checkoutHarnessMode?: CheckoutMode;
    __simulateDuplicateStripeCallback?: () => void;
    __forceRerender?: () => void;
    __resetHarness?: () => void;
  }
}

export default function CheckoutRetryHarness() {
  const [invokeCount, setInvokeCount] = useState(0);
  const [cashbackTotal, setCashbackTotal] = useState(0);
  const [lastToast, setLastToast] = useState<string>("");
  const [lastNavigate, setLastNavigate] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");
  const [navigateCount, setNavigateCount] = useState(0);
  // Forces a re-render so tests can prove `navigatedRef`'s sticky
  // behaviour survives a React re-render.
  const [, setRerenderTick] = useState(0);
  const submittingRef = useRef(false);
  // Mirrors production CheckoutForm.navigatedRef — once we've decided
  // to leave the page, every subsequent attempted navigation is a
  // no-op. The harness exposes `navigate-count` to prove this.
  const navigatedRef = useRef(false);

  const safeNavigate = (target: string) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setLastNavigate(target);
    setNavigateCount((n) => n + 1);
  };

  // Expose the two test hooks. They're attached on every render so
  // they always close over the current safeNavigate.
  useEffect(() => {
    window.__simulateDuplicateStripeCallback = () => {
      const mode: CheckoutMode = window.__checkoutHarnessMode ?? "unit";
      // Simulates Stripe firing a late callback that classifies as
      // alreadySucceededOnRetry. Production code would call
      // safeNavigate(...) here; we want to prove that's a no-op.
      safeNavigate(
        mode === "subscription"
          ? "/dashboard?tab=subscription"
          : "/aula/test-id",
      );
    };
    window.__forceRerender = () => setRerenderTick((t) => t + 1);
    // Resets every piece of harness state so a single Playwright
    // worker can run the same flow back-to-back and prove the
    // pipeline behaves identically on each fresh run. Test specs
    // call this in a beforeEach (or between iterations of a loop)
    // to guarantee no cross-test bleed of mock queues, navigation
    // flags, cashback totals, or toast/error strings.
    window.__resetHarness = () => {
      window.__mockCheckoutResponses = [];
      window.__checkoutHarnessMode = undefined;
      submittingRef.current = false;
      navigatedRef.current = false;
      setInvokeCount(0);
      setCashbackTotal(0);
      setLastToast("");
      setLastNavigate("");
      setLastError("");
      setNavigateCount(0);
      setRerenderTick((t) => t + 1);
    };
    return () => {
      delete window.__simulateDuplicateStripeCallback;
      delete window.__forceRerender;
      delete window.__resetHarness;
    };
  });

  const handleSubmit = async () => {
    // Re-entrancy guard: matches the real CheckoutForm's `submitting`
    // state, which prevents double-click from firing two parallel
    // network calls. This is the FIRST line of defence; the second is
    // server-side idempotency (alreadyCompleted / unique constraints).
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLastError("");

    try {
      const queue = window.__mockCheckoutResponses ?? [];
      const next = queue.shift();
      if (!next) {
        setLastError("No mock response queued");
        return;
      }
      setInvokeCount((c) => c + 1);

      const mode: CheckoutMode = window.__checkoutHarnessMode ?? "unit";
      const action = classifyCheckoutResponse(next.data, mode);

      // Track cashback the server actually consumed (the real server
      // returns cashbackApplied: 0 on retries — this lets us prove no
      // reapplication happened).
      setCashbackTotal((t) => t + (next.data.cashbackApplied ?? 0));

      if (action.kind === "error") {
        if (action.cashbackRejected) {
          toast.error(action.message);
        }
        setLastToast(action.message);
        setLastError(action.message);
        return;
      }

      if (action.kind === "alreadyOwned") {
        toast.success(action.message);
        setLastToast(action.message);
        const target =
          mode === "subscription"
            ? "/dashboard?tab=subscription"
            : `/aula/${(next.data as { contentId?: string }).contentId ?? "test-id"}`;
        safeNavigate(target);
        return;
      }

      if (action.kind === "needsConfirmation") {
        const decision = classifyStripeConfirm(next.stripe ?? {
          paymentIntentStatus: "succeeded",
        });
        if (decision.kind === "fail") {
          setLastError(decision.message);
          setLastToast(decision.message);
          return;
        }
        if (decision.kind === "alreadySucceededOnRetry") {
          const msg =
            mode === "subscription"
              ? "Assinatura já confirmada."
              : "Pagamento já confirmado.";
          toast.success(msg);
          setLastToast(msg);
          safeNavigate(
            mode === "subscription"
              ? "/dashboard?tab=subscription"
              : "/aula/test-id",
          );
          return;
        }
      }

      // Happy path
      toast.success("Pagamento aprovado!");
      setLastToast("Pagamento aprovado!");
      safeNavigate("/payment-success");
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 600 }}>
      <h1>Checkout Retry Harness</h1>
      <p>
        Test-only page. Drives the same classification + side-effect
        pipeline used by <code>Checkout.tsx</code>.
      </p>
      <button
        type="button"
        data-testid="pay-button"
        onClick={handleSubmit}
        style={{
          padding: "10px 16px",
          fontSize: 16,
          background: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          border: 0,
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Pagar
      </button>

      <dl style={{ marginTop: 24, display: "grid", gap: 8 }}>
        <div>
          <dt>Invoke count</dt>
          <dd data-testid="invoke-count">{invokeCount}</dd>
        </div>
        <div>
          <dt>Cashback total applied (server-reported)</dt>
          <dd data-testid="cashback-total-applied">{cashbackTotal.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Last toast</dt>
          <dd data-testid="last-toast">{lastToast}</dd>
        </div>
        <div>
          <dt>Last navigate target</dt>
          <dd data-testid="last-navigate">{lastNavigate}</dd>
        </div>
        <div>
          <dt>Navigate count</dt>
          <dd data-testid="navigate-count">{navigateCount}</dd>
        </div>
        <div>
          <dt>Last error</dt>
          <dd data-testid="last-error">{lastError}</dd>
        </div>
      </dl>
    </div>
  );
}