import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { LANGS, useI18n } from "@/lib/i18n";
import { fetchLocations } from "@/lib/data";
import { cn } from "@/lib/utils";
import { openInNewTab, useEmbedded } from "@/lib/embed";
import logoAsset from "@/assets/favoreto-logo.jpg.asset.json";

const NAV = [
  { to: "/today", key: "nav.today" },
  { to: "/calendar", key: "nav.calendar" },
  { to: "/students", key: "nav.students" },
  { to: "/my-students", key: "nav.myStudents" },
  { to: "/reports", key: "nav.reports" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { settings, locationId, setLocationId, isStaff, isAdmin } = useApp();
  const embedded = useEmbedded();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const nav = NAV.filter(
    (n) =>
      (n.to !== "/reports" || isStaff) &&
      (n.to !== "/students" || isStaff) &&
      (n.to !== "/my-students" || !isStaff),
  );

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-2 pt-3">
          <Link to="/today" className="flex items-center gap-2.5">
            <img
              src={settings.logo_url || logoAsset.url}
              alt={settings.org_name}
              className="size-9 rounded-md object-cover"
            />
            <span className="leading-none">
              <span className="block font-display text-lg uppercase tracking-wide">
                {settings.org_name}
              </span>
              <span className="label-mono mt-0.5 block">Brazilian Jiu-Jitsu</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <div className="flex overflow-hidden rounded-md bg-foreground/5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                    lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {isAdmin ? (
              <Link
                to="/settings"
                className="grid size-9 place-items-center rounded-md border border-border bg-card font-mono text-[11px]"
                aria-label={t("nav.settings")}
              >
                ⚙
              </Link>
            ) : null}
            <button
              onClick={signOut}
              className="grid size-9 place-items-center rounded-md bg-primary font-mono text-[11px] text-primary-foreground"
              aria-label={t("common.signOut")}
            >
              ⏻
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-3 pb-2">
          <LocationTab active={locationId === null} onClick={() => setLocationId(null)}>
            {t("common.all")}
          </LocationTab>
          {locations.map((l) => (
            <LocationTab
              key={l.id}
              active={locationId === l.id}
              onClick={() => setLocationId(l.id)}
            >
              {l.short_name}
            </LocationTab>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-3">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/85 backdrop-blur-md">
        <div className={cn("mx-auto grid max-w-3xl", nav.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-1 py-3"
              >
                <span
                  className={cn("size-1.5 rounded-full", active ? "bg-accent" : "bg-foreground/25")}
                />
                <span
                  className={cn(
                    "text-[10px]",
                    active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {t(item.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function LocationTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 truncate rounded-lg py-2 text-xs",
        active ? "bg-primary font-semibold text-primary-foreground" : "bg-card/60 font-medium text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
