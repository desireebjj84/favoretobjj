import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n, LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/favoreto-logo.jpg.asset.json";

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
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex gap-1 self-end overflow-hidden rounded-md bg-foreground/5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={cn(
                "px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <img
          src={logoAsset.url}
          alt="Favoreto Brazilian Jiu-Jitsu"
          className="mt-6 size-40 rounded-2xl object-contain"
        />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">{t("auth.title")}</h1>
        <p className="label-mono mt-1">{t("auth.subtitle")}</p>
        <p className="mt-4 text-sm text-muted-foreground">{t("auth.hero")}</p>

        <Link to="/auth" className="mt-8 w-full">
          <Button variant="accent" className="w-full">
            {t("auth.enter")}
          </Button>
        </Link>

        <div className="mt-10 grid w-full grid-cols-3 gap-2">
          {["Brickell", "Coconut Grove", "Hialeah"].map((u) => (
            <div key={u} className="surface rounded-xl px-2 py-3">
              <span className="text-xs font-semibold">{u}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
