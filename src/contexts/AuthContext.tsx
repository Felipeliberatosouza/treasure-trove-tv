import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "student" | "teacher" | "admin" | null;
type AllRoles = ("student" | "teacher" | "admin")[];

interface Profile {
  name: string;
  email: string;
  bio: string | null;
  expertise_area: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  phone: string | null;
  areas: string[] | null;
  cpf: string | null;
  phone_verified?: boolean | null;
  address?: string | null;
  pix_key?: string | null;
}

interface SubscriptionStatus {
  subscribed: boolean;
  priceId: string | null;
  productId: string | null;
  subscriptionEnd: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole;
  allRoles: AllRoles;
  profile: Profile | null;
  loading: boolean;
  subscription: SubscriptionStatus;
  subscriptionUnavailable: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<{ subscribed: boolean; priceId: string | null; productId: string | null; subscriptionEnd: string | null } | null>;
  addStudentRole: () => Promise<void>;
}

const defaultSubscription: SubscriptionStatus = {
  subscribed: false,
  priceId: null,
  productId: null,
  subscriptionEnd: null,
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  allRoles: [],
  profile: null,
  loading: true,
  subscription: defaultSubscription,
  subscriptionUnavailable: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSubscription: async () => null,
  addStudentRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [allRoles, setAllRoles] = useState<AllRoles>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>(defaultSubscription);
  const [subscriptionUnavailable, setSubscriptionUnavailable] = useState(false);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (data && data.length > 0) {
      const roles = data.map((r) => r.role);
      setAllRoles(roles as AllRoles);
      if (roles.includes("admin")) setRole("admin");
      else if (roles.includes("teacher")) setRole("teacher");
      else setRole("student");
    } else {
      setRole(null);
      setAllRoles([]);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("name, email, bio, expertise_area, avatar_url, birth_date, phone, areas, active, referral_code, cpf, slug, profile_title, address, pix_key, accepts_marketing, phone_verified")
      .eq("user_id", userId)
      .single();
    
    const isRecoveryFlow =
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/reset-password") ||
        window.location.hash.includes("type=recovery"));

    if (data && data.active === false && !isRecoveryFlow) {
      await supabase.auth.signOut();
      setProfile(null);
      setRole(null);
      setAllRoles([]);
      setUser(null);
      setSession(null);
      return false;
    }
    
    setProfile(data ?? null);
    return true;
  };

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return null;

      // Invoke with a single silent retry on transient 5xx / network errors
      let data: any = null;
      let error: any = null;
      // Retry up to 3 times with exponential backoff for transient runtime
      // errors (e.g. SUPABASE_EDGE_RUNTIME_ERROR / 503 during cold start).
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await supabase.functions.invoke("check-subscription");
          data = res.data;
          error = res.error;
        } catch (invokeErr) {
          // FunctionsHttpError can throw synchronously on 5xx — treat as transient
          error = invokeErr;
        }
        if (!error) break;
        await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
      }
      if (error) {
        // Transient — silent. Will retry on next 60s polling cycle.
        // Do not log to console to avoid triggering global error reporters.
        setSubscriptionUnavailable(true);
        return null;
      }
      if (data) {
        if (data.fallback) {
          // Edge function returned a graceful fallback (e.g. Stripe down)
          setSubscriptionUnavailable(true);
          return null;
        }
        setSubscriptionUnavailable(false);
        const next = {
          subscribed: data.subscribed ?? false,
          priceId: data.price_id ?? null,
          productId: data.product_id ?? null,
          subscriptionEnd: data.subscription_end ?? null,
        };
        setSubscription(next);
        return next;
      }
      return null;
    } catch (err) {
      // Silent — transient failures are expected during edge runtime cold starts
      setSubscriptionUnavailable(true);
      return null;
    }
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const refreshSubscription = useCallback(async () => {
    return await checkSubscription();
  }, [checkSubscription]);

  const addStudentRole = useCallback(async () => {
    if (!user) return;
    if (allRoles.includes("student")) return;
    const { error } = await supabase.rpc("add_student_role_to_self" as any);
    if (!error) {
      await fetchRole(user.id);
    }
  }, [user, allRoles]);

  useEffect(() => {
    let cancelled = false;

    const loadAuthState = async (nextSession: Session | null) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setAllRoles([]);
        setProfile(null);
        setSubscription(defaultSubscription);
        if (!cancelled) setLoading(false);
        return;
      }

      const profileActive = await fetchProfile(nextSession.user.id);
      if (cancelled || !profileActive) {
        if (!cancelled) setLoading(false);
        return;
      }
      await fetchRole(nextSession.user.id);
      if (!cancelled) setLoading(false);
    };

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void loadAuthState(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadAuthState(session);
    });

    return () => {
      cancelled = true;
      authSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user, checkSubscription]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setAllRoles([]);
    setProfile(null);
    setSubscription(defaultSubscription);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        allRoles,
        profile,
        loading,
        subscription,
        subscriptionUnavailable,
        signOut,
        refreshProfile,
        refreshSubscription,
        addStudentRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
