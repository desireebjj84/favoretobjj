import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Bar, Button, Card, Empty, SectionTitle, Tag } from "@/components/ui-kit";
import {
  TONE_BAR,
  addDays,
  ensureSessions,
  fetchAttendance,
  fetchClasses,
  fetchLocations,
  fetchSessions,
  fetchStudents,
  fmtTime,
  isoDate,
  occupancyTone,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Favoreto BJJ" },
      {
        name: "description",
        content: "Attendance reports by unit and time slot, full classes, low turnout and demand for new classes.",
      },
      { property: "og:title", content: "Reports — Favoreto BJJ" },
      {
        property: "og:description",
        content: "Attendance by unit and time slot, plus demand signals for opening new classes.",
      },
    ],
  }),
  component: ReportsPage,
});

const RANGES = [7, 30, 90];

function ReportsPage() {
  const { t } = useI18n();
  const { isStaff, settings } = useApp();
  const [days, setDays] = useState(30);

  const to = isoDate(new Date());
  const from = isoDate(addDays(new Date(), -days));

  useEffect(() => {
    void ensureSessions(from, to);
  }, [from, to]);

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const sessionsQ = useQuery({ queryKey: ["sessions", from, to], queryFn: () => fetchSessions(from, to) });
  const ids = useMemo(() => (sessionsQ.data ?? []).map((s) => s.id), [sessionsQ.data]);
  const attQ = useQuery({
    queryKey: ["attendance", from, to, ids.length],
    enabled: ids.length > 0,
    queryFn: () => fetchAttendance(ids),
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attQ.data ?? []) {
      if (a.status === "absent") continue;
      m.set(a.session_id, (m.get(a.session_id) ?? 0) + 1);
    }
    return m;
  }, [attQ.data]);

  const classes = classesQ.data ?? [];
  const locations = locationsQ.data ?? [];
  const sessions = sessionsQ.data ?? [];

  const perClass = useMemo(
    () =>
      classes.map((c) => {
        const cs = sessions.filter((s) => s.class_id === c.id);
        const total = cs.reduce((sum, s) => sum + (counts.get(s.id) ?? 0), 0);
        const avg = cs.length ? total / cs.length : 0;
        return { cls: c, total, avg, ratio: c.capacity ? avg / c.capacity : 0, sessions: cs.length };
      }),
    [classes, sessions, counts],
  );

  const perLocation = locations.map((l) => {
    const rows = perClass.filter((p) => p.cls.location_id === l.id);
    const total = rows.reduce((s, r) => s + r.total, 0);
    const cap = rows.reduce((s, r) => s + r.cls.capacity * r.sessions, 0);
    return { loc: l, total, ratio: cap ? total / cap : 0 };
  });

  const bySlot = useMemo(() => {
    const m = new Map<string, { total: number; cap: number }>();
    for (const p of perClass) {
      const key = `${p.cls.weekday}|${p.cls.start_time}`;
      const cur = m.get(key) ?? { total: 0, cap: 0 };
      cur.total += p.total;
      cur.cap += p.cls.capacity * p.sessions;
      m.set(key, cur);
    }
    return [...m.entries()]
      .map(([key, v]) => {
        const [wd, time] = key.split("|");
        return { weekday: Number(wd), time: time!, ...v, ratio: v.cap ? v.total / v.cap : 0 };
      })
      .sort((a, b) => b.ratio - a.ratio);
  }, [perClass]);

  const full = perClass.filter((p) => p.ratio >= 0.9).sort((a, b) => b.ratio - a.ratio);
  const low = perClass.filter((p) => p.sessions > 0 && p.ratio < 0.4).sort((a, b) => a.ratio - b.ratio);
  const demand = bySlot.filter((s) => s.ratio >= 0.85);

  // Absence alerts
  const alerts = useMemo(() => {
    const byStudent = new Map<string, number>();
    for (const a of attQ.data ?? []) {
      if (a.status !== "absent") continue;
      byStudent.set(a.student_id, (byStudent.get(a.student_id) ?? 0) + 1);
    }
    return (studentsQ.data ?? [])
      .map((s) => ({ student: s, missed: byStudent.get(s.id) ?? 0 }))
      .filter((r) => r.missed >= settings.absence_threshold)
      .sort((a, b) => b.missed - a.missed);
  }, [attQ.data, studentsQ.data, settings.absence_threshold]);

  if (!isStaff) return <Empty label={t("settings.roleHint")} />;

  return (
    <div className="space-y-5">
      <SectionTitle right={`${days}d`}>{t("reports.title")}</SectionTitle>

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <Button key={r} size="sm" variant={days === r ? "accent" : "outline"} onClick={() => setDays(r)}>
            {r}d
          </Button>
        ))}
      </div>

      <Card>
        <SectionTitle right={t("reports.occupancy")}>{t("reports.byUnit")}</SectionTitle>
        <div className="mt-3 space-y-3">
          {perLocation.map((p) => (
            <div key={p.loc.id}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{p.loc.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {p.total} · {Math.round(p.ratio * 100)}%
                </p>
              </div>
              <Bar ratio={p.ratio} tone={TONE_BAR[occupancyTone(p.ratio)]!} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={t("reports.occupancy")}>{t("reports.bySlot")}</SectionTitle>
        <div className="mt-3 space-y-3">
          {bySlot.length === 0 ? <Empty label={t("common.none")} /> : null}
          {bySlot.slice(0, 10).map((s) => (
            <div key={`${s.weekday}-${s.time}`}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">
                  {t(`day.${s.weekday}`)}{" "}
                  <span className="font-mono text-[11px] text-muted-foreground">{fmtTime(s.time)}</span>
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">{Math.round(s.ratio * 100)}%</p>
              </div>
              <Bar ratio={s.ratio} tone={TONE_BAR[occupancyTone(s.ratio)]!} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={`${full.length}`}>{t("reports.fullClasses")}</SectionTitle>
        <div className="mt-2 space-y-2">
          {full.length === 0 ? <Empty label={t("common.none")} /> : null}
          {full.map((p) => (
            <Row
              key={p.cls.id}
              title={p.cls.name}
              sub={`${t(`day.${p.cls.weekday}`)} ${fmtTime(p.cls.start_time)}`}
              value={`${p.avg.toFixed(0)}/${p.cls.capacity}`}
              tone="clay"
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={`${low.length}`}>{t("reports.lowClasses")}</SectionTitle>
        <div className="mt-2 space-y-2">
          {low.length === 0 ? <Empty label={t("common.none")} /> : null}
          {low.map((p) => (
            <Row
              key={p.cls.id}
              title={p.cls.name}
              sub={`${t(`day.${p.cls.weekday}`)} ${fmtTime(p.cls.start_time)}`}
              value={`${p.avg.toFixed(0)}/${p.cls.capacity}`}
              tone="blue"
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={`${demand.length}`}>{t("reports.demand")}</SectionTitle>
        <p className="mt-1 text-xs text-muted-foreground">{t("reports.demandHint")}</p>
        <div className="mt-2 space-y-2">
          {demand.length === 0 ? <Empty label={t("common.none")} /> : null}
          {demand.map((s) => (
            <Row
              key={`${s.weekday}-${s.time}`}
              title={`${t(`day.${s.weekday}`)} ${fmtTime(s.time)}`}
              sub={t("reports.demandHint")}
              value={`${Math.round(s.ratio * 100)}%`}
              tone="brown"
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={`${alerts.length}`}>{t("reports.alerts")}</SectionTitle>
        <div className="mt-2 space-y-2">
          {alerts.length === 0 ? <Empty label={t("common.none")} /> : null}
          {alerts.slice(0, 20).map((a) => (
            <Row
              key={a.student.id}
              title={a.student.full_name}
              sub={t("students.missed")}
              value={`${a.missed}`}
              tone="clay"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({
  title,
  sub,
  value,
  tone,
}: {
  title: string;
  sub: string;
  value: string;
  tone: "clay" | "blue" | "brown" | "green";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-foreground/5 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <Tag tone={tone}>{value}</Tag>
    </div>
  );
}
