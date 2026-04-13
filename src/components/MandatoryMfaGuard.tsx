import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Wraps admin pages. If platform setting `admin_2fa_required` is true
 * and the current admin has no verified TOTP factor, blocks access
 * until they enrol.
 */
const MandatoryMfaGuard = ({ children }: { children: React.ReactNode }) => {
  const { role } = useAuth();
  const [checking, setChecking] = useState(true);
  const [mustSetup, setMustSetup] = useState(false);

  useEffect(() => {
    if (role !== "admin") {
      setChecking(false);
      return;
    }

    const check = async () => {
      try {
        // Check if setting is enabled
        const { data: setting } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "admin_2fa_required")
          .maybeSingle();

        const required = setting?.value === true;
        if (!required) {
          setChecking(false);
          return;
        }

        // Check if user already has 2FA
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const hasVerified = factors?.totp?.some((f) => f.status === "verified");
        setMustSetup(!hasVerified);
      } catch {
        // fail-open
      } finally {
        setChecking(false);
      }
    };

    check();
  }, [role]);

  if (checking) return null;

  if (mustSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="font-display text-2xl font-bold">2FA Obrigatório</h2>
            <p className="text-sm text-muted-foreground">
              A política da plataforma exige que administradores ativem a autenticação de dois fatores antes de continuar.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <TwoFactorSetup onSetupComplete={() => setMustSetup(false)} />
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MandatoryMfaGuard;
