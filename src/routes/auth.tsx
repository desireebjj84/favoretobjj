import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Button, Field, Input } from "@/components/ui-kit";
import logoAsset from "@/assets/favoreto-logo.jpg.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Favoreto BJJ" },
      { name: "description", content: "Sign in to the Favoreto BJJ attendance app." },
      { property: "og:title", content: "Sign in — Favoreto BJJ" },
      { property: "og:description", content: "Sign in to the Favoreto BJJ attendance app." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const { session } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/today", replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) setMsg(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMsg(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMsg(String(result.error));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/today", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src={logoAsset.url} alt="Favoreto BJJ" className="size-20 rounded-xl object-contain" />
          <h1 className="mt-4 font-display text-2xl uppercase tracking-wide">{t("auth.title")}</h1>
          <p className="label-mono mt-1">{t("auth.subtitle")}</p>
        </div>

        <div className="surface mt-6 rounded-2xl p-4">
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" ? (
              <Field label={t("common.fullName")}>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
            ) : null}
            <Field label={t("common.email")}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label={t("common.password")}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </Field>
            <Button type="submit" variant="accent" className="w-full" disabled={busy}>
              {mode === "signup" ? t("common.signUp") : t("common.signIn")}
            </Button>
          </form>

          <Button variant="outline" className="mt-3 w-full" onClick={google}>
            {t("auth.google")}
          </Button>

          {msg ? <p className="mt-3 text-center text-xs text-clay">{msg}</p> : null}

          <button
            className="mt-4 w-full text-center text-xs font-medium text-muted-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
