import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isValidCPF } from "@/lib/cpfValidator";

/**
 * Detects users with incomplete onboarding and redirects them to the proper
 * dashboard tab to complete their profile.
 *
 * - Students: missing CPF or unverified phone -> /dashboard/student?tab=personal
 * - Teachers: missing CPF, address, or PIX key -> /dashboard/teacher?tab=personal
 *
 * Admins are never redirected.
 */
const EXEMPT_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/payment-success",
  "/payment-canceled",
  "/unsubscribe",
  "/email-seguranca",
];

const isExempt = (pathname: string) =>
  EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const OnboardingGuard = () => {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      notifiedRef.current = false;
      return;
    }
    if (role !== "student" && role !== "teacher") return;
    if (isExempt(location.pathname)) return;

    const cpfMissing = !profile.cpf || !isValidCPF(profile.cpf);

    let msg: string | null = null;
    let target: string | null = null;

    if (role === "student") {
      const phoneMissing = !profile.phone_verified;
      if (!cpfMissing && !phoneMissing) {
        notifiedRef.current = false;
        return;
      }
      msg = cpfMissing && phoneMissing
        ? "Complete seu CPF e verifique seu telefone para continuar."
        : cpfMissing
          ? "Complete seu CPF para continuar."
          : "Verifique seu telefone para continuar.";
      target = "/dashboard/student?tab=personal";
    } else {
      // teacher
      const addressMissing = !profile.address || !profile.address.trim();
      const pixMissing = !profile.pix_key || !profile.pix_key.trim();
      if (!cpfMissing && !addressMissing && !pixMissing) {
        notifiedRef.current = false;
        return;
      }
      const missing: string[] = [];
      if (cpfMissing) missing.push("CPF");
      if (addressMissing) missing.push("endereço");
      if (pixMissing) missing.push("chave PIX");
      msg = `Complete ${missing.join(", ")} para continuar.`;
      target = "/dashboard/teacher?tab=personal";
    }

    if (notifiedRef.current) return;
    notifiedRef.current = true;

    toast.info(msg);
    navigate(target, { replace: true });
  }, [user, profile, role, loading, location.pathname, navigate]);

  return null;
};

export default OnboardingGuard;
