import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { LANGS, useI18n } from "@/lib/i18n";
import { Button, Card, Empty, Field, Input, SectionTitle, Select } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Favoreto BJJ" },
      { name: "description", content: "Academy name, accent color, default language and absence alert threshold." },
      { property: "og:title", content: "Settings — Favoreto BJJ" },
      { property: "og:description", content: "Customize branding, language and absence alerts." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  const { isAdmin, settings, refetchSettings } = useApp();
  const [orgName, setOrgName] = useState(settings.org_name);
  const [accent, setAccent] = useState(settings.accent_color);
  const [language, setLanguage] = useState(settings.default_language);
  const [threshold, setThreshold] = useState(String(settings.absence_threshold));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isAdmin) return <Empty label={t("settings.roleHint")} />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase
      .from("org_settings")
      .update({
        org_name: orgName,
        accent_color: accent,
        default_language: language,
        absence_threshold: Number(threshold) || 1,
      })
      .eq("id", 1);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    refetchSettings();
    setMsg(t("settings.saved"));
  }

  return (
    <div className="space-y-4">
      <SectionTitle>{t("settings.title")}</SectionTitle>
      <Link to="/classes" className="block">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg uppercase tracking-wide">{t("classes.title")}</p>
            <p className="text-xs text-muted-foreground">{t("classes.manage")}</p>
          </div>
          <span className="label-mono">›</span>
        </Card>
      </Link>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <Field label={t("settings.orgName")}>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
          </Field>
          <Field label={t("settings.accent")}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="size-10 rounded-lg border border-border bg-transparent"
              />
              <Input value={accent} onChange={(e) => setAccent(e.target.value)} />
            </div>
          </Field>
          <Field label={t("settings.language")}>
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("settings.threshold")}>
            <Input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>
            {t("common.save")}
          </Button>
          {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
        </form>
      </Card>
    </div>
  );
}
