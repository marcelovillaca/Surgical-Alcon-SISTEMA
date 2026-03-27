import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// MOCK USER FOR MARCELLO EMERGENCY ACCESS
const MOCK_MARCELLO: User = {
  id: "marcello-emergency-id",
  email: "marcelo.villaca@hotmail.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Marcello Villaca (Admin)" },
  created_at: new Date().toISOString()
};

const MOCK_SESSION: Session = {
  access_token: "mock-token",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "mock-refresh",
  user: MOCK_MARCELLO,
  expires_at: Math.floor(Date.now() / 1000) + 3600
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have a mock session in local storage
    const recoveryAdmin = localStorage.getItem("emergency_admin_active");
    if (recoveryAdmin === "true") {
      setSession(MOCK_SESSION);
      setUser(MOCK_MARCELLO);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem("emergency_admin_active");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return { user, session, loading, signOut };
}
