import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "instructor" | "parent";

export type OrgSettings = {
  org_name: string;
  accent_color: string;
  logo_url: string | null;
  default_language: string;
  absence_threshold: number;
};

type AppValue = {
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  isStaff: boolean;
  settings: OrgSettings;
  refetchSettings: () => void;
  locationId: string | null;
  setLocationId: (id: string | null) => void;
};

const DEFAULT_SETTINGS: OrgSettings = {
  org_name: "Favoreto BJJ",
  accent_color: "#E0422E",
  logo_url: null,
  default_language: "en",
  absence_threshold: 2,
};

const AppContext = createContext<AppValue>({
  session: null,
  loading: true,
  roles: [],
  isAdmin: false,
  isStaff: false,
  settings: DEFAULT_SETTINGS,
  refetchSettings: () => {},
  locationId: null,
  setLocationId: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const rolesQuery = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as Role);
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["org-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_settings")
        .select("org_name, accent_color, logo_url, default_language, absence_threshold")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? DEFAULT_SETTINGS) as OrgSettings;
    },
  });

  const settings = settingsQuery.data ?? DEFAULT_SETTINGS;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--clay", settings.accent_color);
  }, [settings.accent_color]);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  const value: AppValue = {
    session,
    loading,
    roles,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("admin") || roles.includes("instructor"),
    settings,
    refetchSettings: () => void settingsQuery.refetch(),
    locationId,
    setLocationId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
