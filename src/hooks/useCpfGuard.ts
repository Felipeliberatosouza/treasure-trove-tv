import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isValidCPF } from "@/lib/cpfValidator";

/**
 * Hook that checks if the current user has a valid CPF.
 * Returns a guard function and modal state.
 * Usage:
 *   const { requireCpf, showCpfModal, setShowCpfModal } = useCpfGuard();
 *   // Before purchase: requireCpf(() => proceedWithCheckout());
 */
export function useCpfGuard() {
  const { profile } = useAuth();
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireCpf = useCallback(
    (action: () => void) => {
      const cpf = (profile as any)?.cpf;
      if (cpf && isValidCPF(cpf)) {
        action();
      } else {
        setPendingAction(() => action);
        setShowCpfModal(true);
      }
    },
    [profile]
  );

  const onCpfComplete = useCallback(() => {
    setShowCpfModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  return { requireCpf, showCpfModal, setShowCpfModal, onCpfComplete };
}
