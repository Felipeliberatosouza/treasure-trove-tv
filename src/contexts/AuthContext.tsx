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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
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
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSubscription: async () => {},
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
    
    if (data && data.active === false) {
      await supabase.auth.signOut();
      setProfile(null);
      setRole(null);
      setAllRoles([]);
      setUser(null);
      setSession(null);
      return;
    }
    
    setProfile(data ?? null);
  };

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;

      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("Error checking subscription:", error);
        return;
      }
      if (data) {
        setSubscription({
          subscribed: data.subscribed ?? false,
          priceId: data.price_id ?? null,
          productId: data.product_id ?? null,
          subscriptionEnd: data.subscription_end ?? null,
        });
      }
    } catch (err) {
      console.error("Failed to check subscription:", err);
    }
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const refreshSubscription = useCallback(async () => {
    await checkSubscription();
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
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchRole(session.user.id);
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setAllRoles([]);
          setProfile(null);
          setSubscription(defaultSubscription);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => authSub.unsubscribe();
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
