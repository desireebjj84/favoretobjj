import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button, Field, Input } from "@/components/ui-kit";
import logoAsset from "@/assets/favoreto-logo.jpg.asset.json";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New password — Favoreto BJJ" },
      { name: "description", content: "Create a new password for your Favoreto BJJ account." },
      { property: "og:title", content: "New password — Favoreto BJJ" },
      { property: "og:description", content: "Create a new password for your Favoreto BJJ account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const hash = window.location.hash;
    if (hash.includes("error")) setInvalid(true);
    const timer = window.setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) setInvalid(true);
      });
    }, 4000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(t("auth.resetDone"));
    window.setTimeout(() => navigate({ to: "/today", replace: true }), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src={logoAsset.url} alt="Favoreto BJJ" className="size-20 rounded-xl object-contain" />
          <h1 className="mt-4 font-display text-2xl uppercase tracking-wide">{t("auth.resetTitle")}</h1>
        </div>
        <div className="surface mt-6 rounded-2xl p-4">
          {invalid && !ready ? (
            <p className="text-center text-sm text-clay">{t("auth.resetInvalid")}</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <Field label={t("auth.newPassword")}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </Field>
              <Button type="submit" variant="accent" className="w-full" disabled={busy || !ready}>
                {t("auth.savePassword")}
              </Button>
            </form>
          )}
          {msg ? <p className="mt-3 text-center text-xs text-clay">{msg}</p> : null}
          <Link to="/auth" className="mt-4 block text-center text-xs font-medium text-muted-foreground">
            {t("auth.backToSignin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
