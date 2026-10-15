import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n, LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/favoreto-logo.png";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Favoreto BJJ — Attendance Control" },
      {
        name: "description",
        content:
          "Check-in, class calendar and attendance reports for Favoreto Brazilian Jiu-Jitsu in Brickell, Coconut Grove and Hialeah.",
      },
      { property: "og:title", content: "Favoreto BJJ — Attendance Control" },
      {
        property: "og:description",
        content: "QR check-in, rosters and attendance reports across all three Favoreto BJJ units.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, lang, setLang } = useI18n();
  const { session, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/today", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-noir px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex gap-1 self-end overflow-hidden rounded-md bg-paper/10">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={cn(
                "px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                lang === l.code ? "bg-gold text-noir" : "text-paper/80",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <img
          src={logoUrl}
          alt="Favoreto Brazilian Jiu-Jitsu"
          className="mt-6 size-44 object-contain drop-shadow-2xl"
        />
        <h1 className="mt-5 font-display text-4xl uppercase tracking-wide text-gold">
          {t("auth.title")}
        </h1>
        <p className="label-mono-light mt-1">{t("auth.subtitle")}</p>
        <p className="mt-4 text-sm text-paper/70">{t("auth.hero")}</p>

        <Link to="/auth" className="mt-8 w-full">
          <Button variant="gold" className="w-full">
            {t("auth.enter")}
          </Button>
        </Link>

        <div className="mt-10 grid w-full grid-cols-3 gap-2">
          {["Brickell", "Coconut Grove", "Hialeah"].map((u) => (
            <div key={u} className="rounded-xl border border-gold/25 bg-paper/5 px-2 py-3">
              <span className="text-xs font-semibold text-paper">{u}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
