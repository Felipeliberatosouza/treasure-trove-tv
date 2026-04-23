import { describe, it, expect } from "vitest";
import {
  classifyCheckoutResponse,
  classifyStripeConfirm,
  isCashbackRejection,
} from "../checkoutRetry";

describe("isCashbackRejection", () => {
  it("matches insufficient cashback message (PT-BR)", () => {
    expect(
      isCashbackRejection(
        "Saldo de cashback insuficiente. Máximo aplicável: R$ 5,00.",
      ),
    ).toBe(true);
  });

  it("matches without accent (server fallback)", () => {
    expect(
      isCashbackRejection("Cashback excede o maximo permitido para este carrinho."),
    ).toBe(true);
  });

  it("does not match generic payment errors", () => {
    expect(isCashbackRejection("Cartão recusado pelo emissor")).toBe(false);
    expect(isCashbackRejection("Falha de rede")).toBe(false);
  });

  it("rejects non-string inputs safely", () => {
    expect(isCashbackRejection(undefined)).toBe(false);
    expect(isCashbackRejection(null)).toBe(false);
    expect(isCashbackRejection(42)).toBe(false);
  });
});

describe("classifyCheckoutResponse — retries do not reapply cashback", () => {
  it("returns alreadyOwned with the server's success message for unit retries", () => {
    const action = classifyCheckoutResponse(
      {
        ok: true,
        alreadyCompleted: true,
        cashbackApplied: 0,
        message: "Esta aula já foi comprada anteriormente. Acesse pelo seu painel.",
      },
      "unit",
    );
    expect(action.kind).toBe("alreadyOwned");
    if (action.kind === "alreadyOwned") {
      expect(action.cashbackReapplied).toBe(false);
      expect(action.message).toMatch(/já foi comprada/i);
      expect(action.mode).toBe("unit");
    }
  });

  it("returns alreadyOwned with subscription fallback when message missing", () => {
    const action = classifyCheckoutResponse(
      { ok: true, alreadyActive: true, cashbackApplied: 0 },
      "subscription",
    );
    expect(action.kind).toBe("alreadyOwned");
    if (action.kind === "alreadyOwned") {
      expect(action.cashbackReapplied).toBe(false);
      expect(action.message).toBe("Você já possui uma assinatura ativa.");
    }
  });

  it("returns needsConfirmation when a clientSecret is present", () => {
    const action = classifyCheckoutResponse(
      { ok: true, clientSecret: "pi_123_secret_abc" },
      "unit",
    );
    expect(action).toEqual({
      kind: "needsConfirmation",
      clientSecret: "pi_123_secret_abc",
    });
  });

  it("returns completedNoConfirmation when cashback covered 100%", () => {
    const action = classifyCheckoutResponse(
      { ok: true, clientSecret: null, status: "succeeded" },
      "unit",
    );
    expect(action).toEqual({ kind: "completedNoConfirmation" });
  });

  it("flags cashback errors so the UI can reset its slider", () => {
    const action = classifyCheckoutResponse(
      {
        ok: false,
        error:
          "Saldo de cashback insuficiente. Máximo aplicável: R$ 12,50.",
      },
      "subscription",
    );
    expect(action.kind).toBe("error");
    if (action.kind === "error") {
      expect(action.cashbackRejected).toBe(true);
      expect(action.message).toMatch(/insuficiente/i);
    }
  });

  it("does not flag generic payment errors as cashback rejections", () => {
    const action = classifyCheckoutResponse(
      { ok: false, error: "Cartão recusado pelo banco emissor." },
      "unit",
    );
    expect(action.kind).toBe("error");
    if (action.kind === "error") {
      expect(action.cashbackRejected).toBe(false);
    }
  });

  it("falls back to a generic error when server omits both ok and error", () => {
    const action = classifyCheckoutResponse(null, "unit");
    expect(action.kind).toBe("error");
    if (action.kind === "error") {
      expect(action.message).toBe("Não foi possível concluir o pagamento.");
      expect(action.cashbackRejected).toBe(false);
    }
  });
});

describe("classifyStripeConfirm — retries on already-succeeded PI are silent", () => {
  it("returns ok when PI succeeds without error", () => {
    expect(
      classifyStripeConfirm({ paymentIntentStatus: "succeeded" }),
    ).toEqual({ kind: "ok" });
  });

  it("treats payment_intent_unexpected_state + succeeded as silent retry success", () => {
    // This is the exact race we care about: the user clicked confirm
    // twice (or a network retry happened) after the first confirm
    // already succeeded. We must NOT show an error and the server must
    // NOT reapply cashback (which it doesn't, because the PI was
    // created once and cashback is consumed at PI creation).
    const decision = classifyStripeConfirm({
      errorCode: "payment_intent_unexpected_state",
      errorMessage:
        "This PaymentIntent could not be confirmed because it has a status of succeeded.",
      paymentIntentStatus: "succeeded",
    });
    expect(decision).toEqual({ kind: "alreadySucceededOnRetry" });
  });

  it("propagates real Stripe failures with their message", () => {
    const decision = classifyStripeConfirm({
      errorCode: "card_declined",
      errorMessage: "Seu cartão foi recusado.",
      paymentIntentStatus: "requires_payment_method",
    });
    expect(decision).toEqual({
      kind: "fail",
      message: "Seu cartão foi recusado.",
    });
  });

  it("falls back to a generic error message when Stripe omits one", () => {
    const decision = classifyStripeConfirm({
      errorCode: "card_declined",
      paymentIntentStatus: "requires_payment_method",
    });
    expect(decision).toEqual({
      kind: "fail",
      message: "Pagamento não autorizado.",
    });
  });

  it("fails when PI ends up in a non-succeeded state without an error", () => {
    const decision = classifyStripeConfirm({
      paymentIntentStatus: "requires_action",
    });
    expect(decision).toEqual({
      kind: "fail",
      message: "Pagamento não foi concluído. Tente novamente.",
    });
  });
});