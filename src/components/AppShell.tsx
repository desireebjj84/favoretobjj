import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { LANGS, useI18n } from "@/lib/i18n";
import { fetchLocations } from "@/lib/data";
import { cn } from "@/lib/utils";
import { openInNewTab, useEmbedded } from "@/lib/embed";
import logoUrl from "@/assets/favoreto-logo.png";

const NAV = [
  { to: "/today", key: "nav.today" },
  { to: "/calendar", key: "nav.calendar" },
  { to: "/bookings", key: "nav.bookings" },
  { to: "/students", key: "nav.students" },
  { to: "/my-students", key: "nav.myStudents" },
  { to: "/profile", key: "nav.profile" },
  { to: "/stripe-forms", key: "nav.forms" },
  { to: "/reports", key: "nav.reports" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { settings, locationId, setLocationId, isStaff, isAdmin } = useApp();
  const embedded = useEmbedded();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const nav = NAV.filter(
    (n) =>
      (n.to !== "/reports" || isStaff) &&
      (n.to !== "/students" || isStaff) &&
      (n.to !== "/bookings" || isStaff) &&
      (n.to !== "/stripe-forms" || !isStaff || isAdmin),
  );

  // No rodapé do celular a equipe não precisa de "Meus alunos" — já tem "Alunos".
  const bottomNav = isStaff ? nav.filter((n) => n.to !== "/my-students") : nav;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-gold/20 bg-noir/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-2 pt-3">
          <Link to="/today" className="flex items-center gap-2.5">
            <img
              src={settings.logo_url || logoUrl}
              alt={settings.org_name}
              className="size-9 object-contain"
            />
            <span className="leading-none">
              <BrandName name={settings.org_name} />
              <span className="label-mono-light mt-0.5 block">Brazilian Jiu-Jitsu</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDrawerOpen(true)}
              className="grid size-9 place-items-center rounded-md border border-gold/30 bg-paper/10 text-sm text-paper md:hidden"
              aria-label="Menu"
            >
              ☰
            </button>
            <div className="flex overflow-hidden rounded-md bg-paper/10">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                    lang === l.code ? "bg-gold text-noir" : "text-paper/80",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {embedded ? (
              <button
                onClick={openInNewTab}
                className="grid size-9 place-items-center rounded-md border border-gold/30 bg-paper/10 font-mono text-[11px] text-paper/80"
                aria-label={t("common.openPortal")}
                title={t("common.openPortal")}
              >
                ↗
              </button>
            ) : null}
            {isAdmin ? (
              <Link
                to="/settings"
                className="grid size-9 place-items-center rounded-md border border-gold/30 bg-paper/10 font-mono text-[11px] text-paper/80"
                aria-label={t("nav.settings")}
              >
                ⚙
              </Link>
            ) : null}
            <button
              onClick={signOut}
              className="grid size-9 place-items-center rounded-md bg-gold font-mono text-[11px] text-noir"
              aria-label={t("common.signOut")}
            >
              ⏻
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
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

      <main className="mx-auto max-w-3xl px-4 pb-36 pt-3 md:ml-56 md:max-w-4xl md:pb-8">{children}</main>

      {/* Desktop: menu lateral esquerdo */}
      <nav className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r border-gold/20 bg-noir/95 pt-40 backdrop-blur-md md:flex">
        <div className="flex flex-col gap-1 px-3">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  active
                    ? "bg-gold/15 font-semibold text-paper"
                    : "font-medium text-paper/65 hover:bg-paper/10",
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", active ? "bg-gold" : "bg-paper/25")}
                />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Celular: menu lateral deslizante (todos os usuários) */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            className="absolute inset-0 bg-noir/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar menu"
          />
          <nav className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-gold/20 bg-noir pt-4">
            <div className="flex items-center justify-between px-4 pb-3">
              <BrandName name={settings.org_name} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="grid size-8 place-items-center rounded-md border border-gold/30 text-xs text-paper"
                aria-label="Fechar menu"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1 px-3">
              {nav.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      active
                        ? "bg-gold/15 font-semibold text-paper"
                        : "font-medium text-paper/65 hover:bg-paper/10",
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", active ? "bg-gold" : "bg-paper/25")}
                    />
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      ) : null}

      {/* Celular: menu no rodapé */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gold/20 bg-noir/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-3xl overflow-x-auto">
          {bottomNav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-w-16 flex-1 flex-col items-center gap-1 px-1 py-3"
              >
                <span
                  className={cn("size-1.5 rounded-full", active ? "bg-gold" : "bg-paper/25")}
                />
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px]",
                    active ? "font-semibold text-paper" : "font-medium text-paper/60",
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

/** Nome da academia no menu: tudo dourado, menos a última palavra (ex.: "BJJ") em branco. */
function BrandName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? (parts.pop() as string) : "";
  const first = parts.join(" ");
  return (
    <span className="block font-display text-lg uppercase tracking-wide">
      <span className="text-gold">{first}</span>
      {last ? <span className="text-paper"> {last}</span> : null}
    </span>
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
        "shrink-0 rounded-lg px-3 py-2 text-xs",
        active
          ? "bg-gold font-semibold text-noir"
          : "bg-paper/10 font-medium text-paper/70 hover:bg-paper/15",
      )}
    >
      {children}
    </button>
  );
}
