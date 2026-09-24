import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Bar, Button, Card, Empty, SectionTitle } from "@/components/ui-kit";
import {
  TONE_BAR,
  addDays,
  ensureSessions,
  fetchAttendance,
  fetchClasses,
  fetchSessions,
  fmtTime,
  isoDate,
  occupancyTone,
  startOfWeek,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Class calendar — Favoreto BJJ" },
      { name: "description", content: "Weekly class schedule across Brickell, Coconut Grove and Hialeah." },
      { property: "og:title", content: "Class calendar — Favoreto BJJ" },
      {
        property: "og:description",
        content: "Weekly class schedule across Brickell, Coconut Grove and Hialeah.",
      },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { t, lang } = useI18n();
  const { locationId, isStaff } = useApp();
  const [offset, setOffset] = useState(0);

  const weekStart = addDays(startOfWeek(new Date()), offset * 7);
  const from = isoDate(weekStart);
  const to = isoDate(addDays(weekStart, 6));

  useEffect(() => {
    void ensureSessions(from, to);
  }, [from, to]);

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
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

  const classes = (classesQ.data ?? []).filter((c) => !locationId || c.location_id === locationId);
  const sessions = sessionsQ.data ?? [];
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const todayStr = isoDate(new Date());

  return (
    <div className="space-y-4">
      <SectionTitle
        right={`${weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${addDays(
          weekStart,
          6,
        ).toLocaleDateString(locale, { day: "numeric", month: "short" })}`}
      >
        {t("calendar.title")}
      </SectionTitle>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOffset(offset - 1)}>
          ‹ {t("calendar.prev")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOffset(offset + 1)}>
          {t("calendar.next")} ›
        </Button>
      </div>

      {[0, 1, 2, 3, 4, 5, 6].map((d) => {
        const date = addDays(weekStart, d);
        const dateStr = isoDate(date);
        const dayClasses = classes.filter((c) => c.weekday === d);
        if (dayClasses.length === 0) return null;
        return (
          <Card key={d} className={dateStr === todayStr ? "ring-2 ring-accent/40" : ""}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-base uppercase tracking-wide">{t(`day.${d}`)}</h2>
              <span className="label-mono">{date.toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
            </div>
            <div className="mt-3 space-y-3">
              {dayClasses.map((c) => {
                const s = sessions.find((x) => x.class_id === c.id && x.session_date === dateStr);
                const count = s ? (counts.get(s.id) ?? 0) : 0;
                const ratio = c.capacity ? count / c.capacity : 0;
                const body = (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">
                        {c.name}
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                          {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                        </span>
                      </p>
                      <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {count}
                        <span className="opacity-40">/{c.capacity}</span>
                      </p>
                    </div>
                    <Bar ratio={ratio} tone={TONE_BAR[occupancyTone(ratio)]!} />
                  </>
                );
                return isStaff && dateStr === todayStr ? (
                  <Link key={c.id} to="/checkin" search={{ classId: c.id }} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={c.id}>{body}</div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {classes.length === 0 ? <Empty label={t("common.none")} /> : null}
    </div>
  );
}
