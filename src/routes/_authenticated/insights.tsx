import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { fetchLocations } from "@/lib/data";
import { Button, Card, Empty, Field, SectionTitle, Select, Tag } from "@/components/ui-kit";
import { analyzeAttendancePatterns, type AnalysisDTO } from "@/lib/insights.functions";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — Favoreto BJJ" },
      { name: "description", content: "AI analysis of attendance patterns and suggested schedules for new classes." },
      { property: "og:title", content: "AI Insights — Favoreto BJJ" },
      { property: "og:description", content: "Attendance patterns and suggested schedules for new classes, powered by AI." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useApp();
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const [locationId, setLocationId] = useState("");
  const [days, setDays] = useState(30);
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AnalysisDTO | null>(null);
  const [error, setError] = useState("");

  const analyzeFn = useServerFn(analyzeAttendancePatterns);

  if (!isAdmin) return <Empty label={t("settings.roleHint")} />;

  async function analyze() {
    setPhase("loading");
    setError("");
    try {
      const r = await analyzeFn({ data: { locationId: locationId || null, days, lang } });
      setResult(r);
      setPhase("done");
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <SectionTitle>{t("insights.title")}</SectionTitle>
      <p className="mb-4 text-sm text-muted-foreground">{t("insights.desc")}</p>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("insights.unit")}>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {(locationsQ.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("insights.period")}>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={30}>30d</option>
              <option value={60}>60d</option>
              <option value={90}>90d</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={analyze} disabled={phase === "loading"}>
            {phase === "loading" ? t("insights.loading") : t("insights.analyze")}
          </Button>
        </div>
        {phase === "error" && (
          <p className="mt-3 text-sm text-clay">
            {t("insights.error")}
            {error}
          </p>
        )}
      </Card>

      {result && (
        <div className="mt-6 space-y-6">
          <Card className="p-4">
            <SectionTitle>{t("insights.summary")}</SectionTitle>
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          </Card>

          <div>
            <SectionTitle>{t("insights.patterns")}</SectionTitle>
            <div className="space-y-3">
              {result.patterns.map((p, i) => (
                <Card key={i} className="p-4">
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>{t("insights.suggestions")}</SectionTitle>
            <div className="space-y-3">
              {result.suggestions.map((s, i) => (
                <Card key={i} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-gold">
                      {t(`day.${s.weekday}`)}
                    </span>
                    <span className="font-mono text-sm">{s.time}</span>
                    <Tag tone={s.kind === "adult" ? "clay" : "blue"}>
                      {s.kind === "adult" ? t("insights.kind.adult") : t("insights.kind.kids")}
                    </Tag>
                    <Tag tone={s.expectedDemand === "high" ? "green" : s.expectedDemand === "medium" ? "blue" : "muted"}>
                      {t("insights.demand")}: {t(`insights.demand.${s.expectedDemand}`)}
                    </Tag>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{s.className}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.reason}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
