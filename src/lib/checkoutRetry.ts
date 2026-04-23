/**
 * Pure helpers for the embedded checkout retry / cashback flows.
 *
 * These functions intentionally have NO React, network, or toast deps so
 * they can be unit-tested in isolation. The Checkout page wires them to
 * UI side-effects (toast / setError / navigation).
 */

export type CheckoutMode = "subscription" | "unit";

/**
 * Server response shape from `create-payment-embedded` and
 * `create-subscription-embedded`. Mirrors the subset of fields the UI
 * branches on — kept loose so missing keys default safely.
 */
export interface CheckoutFnResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  alreadyCompleted?: boolean;
  alreadyActive?: boolean;
  clientSecret?: string | null;
  cashbackApplied?: number;
  status?: string;
}

/**
 * Detects whether an error message returned by the edge function is a
 * cashback rejection (insufficient balance, exceeds cart cap, etc).
 * The server uses Portuguese messages such as
 * "Saldo de cashback insuficiente. Máximo aplicável: R$ X,XX".
 */
export function isCashbackRejection(errMsg: unknown): boolean {
  if (typeof errMsg !== "string") return false;
  if (!/cashback/i.test(errMsg)) return false;
  return (
    /insuficiente/i.test(errMsg) ||
    /m[áa]ximo/i.test(errMsg) ||
    /excede/i.test(errMsg)
  );
}

/**
 * Decides what the UI should do given the response from the checkout
 * edge function. Returns a tagged action so the caller can dispatch
 * navigation/toast/error without re-implementing the branching.
 */
export type CheckoutAction =
  | { kind: "error"; message: string; cashbackRejected: boolean }
  | {
      kind: "alreadyOwned";
      message: string;
      mode: CheckoutMode;
      // Server guarantees no cashback was reapplied on retries.
      cashbackReapplied: false;
    }
  | { kind: "needsConfirmation"; clientSecret: string }
  | { kind: "completedNoConfirmation" };

export function classifyCheckoutResponse(
  data: CheckoutFnResponse | null | undefined,
  mode: CheckoutMode,
): CheckoutAction {
  if (!data || data.ok !== true) {
    const message = data?.error || "Não foi possível concluir o pagamento.";
    return {
      kind: "error",
      message,
      cashbackRejected: isCashbackRejection(message),
    };
  }

  if (data.alreadyCompleted || data.alreadyActive) {
    const fallback =
      mode === "subscription"
        ? "Você já possui uma assinatura ativa."
        : "Esta aula já foi comprada anteriormente.";
    return {
      kind: "alreadyOwned",
      message: data.message || fallback,
      mode,
      cashbackReapplied: false,
    };
  }

  if (data.clientSecret) {
    return { kind: "needsConfirmation", clientSecret: data.clientSecret };
  }

  return { kind: "completedNoConfirmation" };
}

/**
 * Stripe's `confirmCardPayment` can fail with
 * `payment_intent_unexpected_state` when the PI was already succeeded
 * by an earlier confirm call (e.g. network retry). In that case the
 * payment is fine — no cashback is reapplied because the server only
 * consumes cashback once when creating the PI.
 */
export interface StripeConfirmOutcome {
  errorCode?: string;
  errorMessage?: string;
  paymentIntentStatus?: string;
}

export type ConfirmDecision =
  | { kind: "ok" }
  | { kind: "alreadySucceededOnRetry" }
  | { kind: "fail"; message: string };

export function classifyStripeConfirm(outcome: StripeConfirmOutcome): ConfirmDecision {
  // No error and PI succeeded → happy path.
  if (!outcome.errorCode && outcome.paymentIntentStatus === "succeeded") {
    return { kind: "ok" };
  }

  // Treat retries on an already-confirmed PI as success (no double charge,
  // no cashback reapplication).
  if (
    outcome.errorCode === "payment_intent_unexpected_state" &&
    outcome.paymentIntentStatus === "succeeded"
  ) {
    return { kind: "alreadySucceededOnRetry" };
  }

  if (outcome.errorCode || outcome.errorMessage) {
    return { kind: "fail", message: outcome.errorMessage || "Pagamento não autorizado." };
  }

  if (outcome.paymentIntentStatus !== "succeeded") {
    return { kind: "fail", message: "Pagamento não foi concluído. Tente novamente." };
  }

  return { kind: "ok" };
}