/**
 * Dev/E2E test harness for the cashback referral "Receber por e-mail" button.
 *
 * Mounted at `/__test/referral-email` (only in non-production builds via
 * App.tsx). It mirrors the exact send pipeline used by
 * StudentCashbackTab.sendByEmail:
 *
 *   1. A `sendingEmail` state disables the button while a request is
 *      in flight (UI-side re-entrancy guard against rapid clicks).
 *   2. Each invocation builds an `idempotencyKey` of the form
 *      `cashback-referral-share-${userId}-${Date.now()}`, which the
 *      Lovable Cloud transactional-email pipeline uses to dedupe sends.
 *
 * The harness exposes counters + the list of idempotency keys actually
 * sent so the Playwright spec can prove:
 *   - Burst clicks (Promise.all of N clicks) only enqueue ONE invoke.
 *   - Forced re-renders during/after a send do NOT cause additional
 *     invokes for the same logical send.
 *   - When the test pins Date.now() to a constant, two sequential
 *     successful sends produce IDENTICAL idempotency keys — proving
 *     the server-side dedupe key is stable per "moment", so even if
 *     the network retried/duplicated the request, the Lovable email
 *     pipeline would treat it as a single logical email.
 *
 * Test hooks attached to window:
 *   - window.__resetReferralHarness() — clears all counters, the
 *     captured idempotency keys, and the pending/last-error state.
 *   - window.__forceRerenderReferral() — bumps a tick to force a
 *     React re-render, simulating StrictMode / parent re-renders.
 *   - window.__setReferralNowFn(fn) — overrides Date.now() inside
 *     the harness so a test can pin the timestamp and assert that
 *     repeated clicks at the "same moment" produce the same key.
 *   - window.__setReferralInvokeBehavior(b) — controls how the
 *     mocked supabase.functions.invoke resolves: "success" (default,
 *     resolves with { error: null }), "error" (resolves with
 *     { error: { message } }), or "hang" (never resolves — lets the
 *     test prove the disabled-button guard holds while a send is
 *     genuinely in flight).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";

type InvokeBehavior = "success" | "error" | "hang";

interface CapturedInvoke {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  timestamp: number;
}

declare global {
  interface Window {
    __resetReferralHarness?: () => void;
    __forceRerenderReferral?: () => void;
    __setReferralNowFn?: (fn: (() => number) | null) => void;
    __setReferralInvokeBehavior?: (b: InvokeBehavior) => void;
    __referralCapturedInvokes?: CapturedInvoke[];
  }
}

// Stable values so the test can compute expected idempotencyKeys.
const TEST_USER_ID = "user-test-123";
const TEST_USER_EMAIL = "student@test.local";
const TEST_REFERRAL_CODE = "A7F9K2";

export default function ReferralEmailHarness() {
  const [sendingEmail, setSendingEmail] = useState(false);
  const [invokeCount, setInvokeCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState("");
  const [lastToast, setLastToast] = useState("");
  const [, setRerenderTick] = useState(0);

  // Refs hold the live mock configuration so test-set values survive
  // re-renders and can be mutated mid-flight.
  const nowFnRef = useRef<() => number>(() => Date.now());
  const behaviorRef = useRef<InvokeBehavior>("success");
  const capturedRef = useRef<CapturedInvoke[]>([]);

  useEffect(() => {
    window.__referralCapturedInvokes = capturedRef.current;
    window.__resetReferralHarness = () => {
      capturedRef.current = [];
      window.__referralCapturedInvokes = capturedRef.current;
      nowFnRef.current = () => Date.now();
      behaviorRef.current = "success";
      setSendingEmail(false);
      setInvokeCount(0);
      setSuccessCount(0);
      setErrorCount(0);
      setLastError("");
      setLastToast("");
      setRerenderTick((t) => t + 1);
    };
    window.__forceRerenderReferral = () => setRerenderTick((t) => t + 1);
    window.__setReferralNowFn = (fn) => {
      nowFnRef.current = fn ?? (() => Date.now());
    };
    window.__setReferralInvokeBehavior = (b) => {
      behaviorRef.current = b;
    };
    return () => {
      delete window.__resetReferralHarness;
      delete window.__forceRerenderReferral;
      delete window.__setReferralNowFn;
      delete window.__setReferralInvokeBehavior;
      delete window.__referralCapturedInvokes;
    };
  });

  // Mock of supabase.functions.invoke that records the request and
  // resolves according to the test-controlled behavior.
  const mockInvoke = (
    templateName: string,
    recipientEmail: string,
    idempotencyKey: string,
  ): Promise<{ error: { message: string } | null }> => {
    capturedRef.current.push({
      templateName,
      recipientEmail,
      idempotencyKey,
      timestamp: nowFnRef.current(),
    });
    window.__referralCapturedInvokes = capturedRef.current;
    setInvokeCount(capturedRef.current.length);
    const behavior = behaviorRef.current;
    if (behavior === "hang") {
      return new Promise(() => {
        /* never resolves */
      });
    }
    if (behavior === "error") {
      return Promise.resolve({ error: { message: "Simulated failure" } });
    }
    return Promise.resolve({ error: null });
  };

  const sendByEmail = async () => {
    // The disabled prop on the Button is the primary guard, but
    // mirroring the early-return matches the production sendByEmail
    // exactly and protects against programmatic .click() calls.
    if (sendingEmail) return;
    setSendingEmail(true);
    try {
      const idempotencyKey = `cashback-referral-share-${TEST_USER_ID}-${nowFnRef.current()}`;
      const { error } = await mockInvoke(
        "cashback-referral-share",
        TEST_USER_EMAIL,
        idempotencyKey,
      );
      if (error) throw new Error(error.message);
      setSuccessCount((c) => c + 1);
      setLastToast("Enviamos o link de indicação para o seu e-mail!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      setErrorCount((c) => c + 1);
      setLastError(msg);
      setLastToast("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 640 }}>
      <h1>Referral Email Harness</h1>
      <p>
        Test-only page. Drives the same send pipeline used by
        <code> StudentCashbackTab.sendByEmail</code>.
      </p>

      <Button
        variant="secondary"
        data-testid="send-email-button"
        onClick={sendByEmail}
        disabled={sendingEmail}
      >
        {sendingEmail ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Mail className="h-4 w-4 mr-2" />
            Receber por e-mail
          </>
        )}
      </Button>

      <dl style={{ marginTop: 24, display: "grid", gap: 8 }}>
        <div>
          <dt>Sending</dt>
          <dd data-testid="sending-state">{sendingEmail ? "true" : "false"}</dd>
        </div>
        <div>
          <dt>Invoke count</dt>
          <dd data-testid="invoke-count">{invokeCount}</dd>
        </div>
        <div>
          <dt>Success count</dt>
          <dd data-testid="success-count">{successCount}</dd>
        </div>
        <div>
          <dt>Error count</dt>
          <dd data-testid="error-count">{errorCount}</dd>
        </div>
        <div>
          <dt>Last toast</dt>
          <dd data-testid="last-toast">{lastToast}</dd>
        </div>
        <div>
          <dt>Last error</dt>
          <dd data-testid="last-error">{lastError}</dd>
        </div>
        <div>
          <dt>Unique idempotency keys</dt>
          <dd data-testid="unique-idempotency-keys">
            {new Set(capturedRef.current.map((c) => c.idempotencyKey)).size}
          </dd>
        </div>
      </dl>
    </div>
  );
}