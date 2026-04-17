import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isValidCPF } from "@/lib/cpfValidator";

/**
 * Detects users with incomplete onboarding (missing CPF or unverified phone)
 * after they log in (typically via Google OAuth, since signup forms enforce
 * these fields up-front). Redirects them to the student dashboard with the
 * "Dados Pessoais" tab open so they can complete their profile.
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
    // Only enforce for students. Teachers have their own contract/data flow,
    // and admins shouldn't be redirected.
    if (role !== "student") return;
    if (isExempt(location.pathname)) return;

    const cpfMissing = !profile.cpf || !isValidCPF(profile.cpf);
    const phoneMissing = !(profile as any).phone_verified;

    if (!cpfMissing && !phoneMissing) {
      notifiedRef.current = false;
      return;
    }

    if (notifiedRef.current) return;
    notifiedRef.current = true;

    const msg = cpfMissing && phoneMissing
      ? "Complete seu CPF e verifique seu telefone para continuar."
      : cpfMissing
        ? "Complete seu CPF para continuar."
        : "Verifique seu telefone para continuar.";
    toast.info(msg);
    navigate("/dashboard/student?tab=personal", { replace: true });
  }, [user, profile, role, loading, location.pathname, navigate]);

  return null;
};

export default OnboardingGuard;
