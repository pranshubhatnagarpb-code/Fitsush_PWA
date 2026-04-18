import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { Client } from "@/lib/types";

type SignInPayload =
  | { email: string; password: string }
  | { phone: string; password: string };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  clientProfile: Client | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (payload: SignInPayload) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClientProfile = async (userId: string) => {
    // Resolve via client_portal_users → clients
    const { data: link } = await supabase
      .from("client_portal_users")
      .select("client_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!link?.client_id) {
      setClientProfile(null);
      return;
    }
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", link.client_id)
      .maybeSingle();
    setClientProfile(client);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          // defer to avoid deadlock with onAuthStateChange
          setTimeout(() => {
            fetchClientProfile(session.user.id).finally(() => setIsLoading(false));
          }, 0);
        } else {
          setClientProfile(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchClientProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (payload: SignInPayload) => {
    const { error } = await supabase.auth.signInWithPassword(payload as never);
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setClientProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        clientProfile,
        isLoading,
        isAuthenticated: !!session,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
