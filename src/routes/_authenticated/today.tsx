import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Bar, Card, Empty, SectionTitle, Tag } from "@/components/ui-kit";
import {
  BELT_DOT,
  TONE_BAR,
  addDays,
  ensureSessions,
  fetchAttendance,
  fetchClasses,
  fetchSessions,
  fetchStudents,
  fmtTime,
  isoDate,
  occupancyTone,
  startOfWeek,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Favoreto BJJ" },
      { name: "description", content: "Live check-ins, today's classes and mat occupancy." },
      { property: "og:title", content: "Today — Favoreto BJJ" },
      { property: "og:description", content: "Live check-ins, today's classes and mat occupancy." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { t, lang } = useI18n();
  const { locationId, isStaff, settings } = useApp();

  const today = new Date();
  const dateStr = isoDate(today);
  const weekStart = startOfWeek(today);
  const weekFrom = isoDate(weekStart);
  const weekTo = isoDate(addDays(weekStart, 6));

  useEffect(() => {
    void ensureSessions(weekFrom, weekTo);
  }, [weekFrom, weekTo]);

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const sessionsQ = useQuery({
    queryKey: ["sessions", weekFrom, weekTo],
    queryFn: () => fetchSessions(weekFrom, weekTo),
  });
  const sessionIds = useMemo(() => (sessionsQ.data ?? []).map((s) => s.id), [sessionsQ.data]);
  const attendanceQ = useQuery({
    queryKey: ["attendance", weekFrom, weekTo, sessionIds.length],
    enabled: sessionIds.length > 0,
    queryFn: () => fetchAttendance(sessionIds),
  });
  const bookingsQ = useQuery({
    queryKey: ["week-bookings", weekFrom, weekTo, sessionIds.length],
    enabled: sessionIds.length > 0 && isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, session_id, student_id")
        .in("session_id", sessionIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const classes = (classesQ.data ?? []).filter((c) => !locationId || c.location_id === locationId);
  const sessions = sessionsQ.data ?? [];
  const attendance = attendanceQ.data ?? [];
  const students = studentsQ.data ?? [];

  const presentBySession = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attendance) {
      if (a.status === "absent") continue;
      map.set(a.session_id, (map.get(a.session_id) ?? 0) + 1);
    }
    return map;
  }, [attendance]);

  const todaySessions = sessions.filter((s) => s.session_date === dateStr);
  const sessionByClassToday = new Map(todaySessions.map((s) => [s.class_id, s]));

  const tomorrow = addDays(today, 1);
  const tomorrowStr = isoDate(tomorrow);
  const tomorrowSessions = sessions.filter((s) => s.session_date === tomorrowStr);
  const sessionByClassTomorrow = new Map(tomorrowSessions.map((s) => [s.class_id, s]));
  const tomorrowClasses = classes.filter((c) => c.weekday === tomorrow.getDay());
  const bookings = bookingsQ.data ?? [];
  const bookingsBySession = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of bookings) {
      const arr = map.get(b.session_id) ?? [];
      arr.push(b.student_id);
      map.set(b.session_id, arr);
    }
    return map;
  }, [bookings]);

  const dow = today.getDay();
  const todayClasses = classes.filter((c) => c.weekday === dow);

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const toMin = (t2: string) => Number(t2.slice(0, 2)) * 60 + Number(t2.slice(3, 5));

  let checkins = 0;
  let onMat = 0;
  let fullCount = 0;
  for (const c of todayClasses) {
    const s = sessionByClassToday.get(c.id);
    const count = s ? (presentBySession.get(s.id) ?? 0) : 0;
    checkins += count;
    if (nowMinutes >= toMin(c.start_time) && nowMinutes <= toMin(c.end_time)) onMat += count;
    if (count >= c.capacity) fullCount += 1;
  }

  // Weekly capacity per class
  const weekly = classes.map((c) => {
    const cls = sessions.filter((s) => s.class_id === c.id);
    const total = cls.reduce((sum, s) => sum + (presentBySession.get(s.id) ?? 0), 0);
    const avg = cls.length ? total / cls.length : 0;
    return { cls: c, avg, ratio: c.capacity ? avg / c.capacity : 0 };
  });

  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const dateLabel = today.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  const todaySessionIds = new Map(todaySessions.map((s) => [s.id, s.class_id]));
  const todayCheckins = attendance
    .filter((a) => a.status !== "absent" && todaySessionIds.has(a.session_id))
    .map((a) => ({
      a,
      st: students.find((x) => x.id === a.student_id),
      cls: classes.find((c) => c.id === todaySessionIds.get(a.session_id)),
    }))
    .filter((x) => x.cls)
    .sort((x, y) => y.a.checked_in_at.localeCompare(x.a.checked_in_at));

  if (!isStaff) return <GuardianToday />;

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <p className="label-mono">
            {t("today.title")} · {dateLabel}
          </p>
          <p className="label-mono">{today.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label={t("today.checkins")} value={checkins} />
          <Stat label={t("today.onMat")} value={onMat} />
          <Stat label={t("today.full")} value={fullCount} tone />
        </div>
      </section>

      <Link to="/checkin" search={{ classId: "" }} className="block">
        <Card className="flex items-center gap-3">
          <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary">
            <QrGlyph />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg uppercase tracking-wide">{t("checkin.title")}</p>
            <p className="text-xs text-muted-foreground">{t("today.scan")}</p>
          </div>
          <span className="label-mono">›</span>
        </Card>
      </Link>

      <section>
        <SectionTitle right={settings.org_name}>{t("today.classes")}</SectionTitle>
        <div className="mt-2 space-y-2">
          {todayClasses.length === 0 ? <Empty label={t("today.noClasses")} /> : null}
          {todayClasses.map((c) => {
            const s = sessionByClassToday.get(c.id);
            const count = s ? (presentBySession.get(s.id) ?? 0) : 0;
            const ratio = c.capacity ? count / c.capacity : 0;
            return (
              <Link key={c.id} to="/checkin" search={{ classId: c.id }} className="block">
                <Card className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold">{c.name}</p>
                    <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {count}
                      <span className="opacity-40">/{c.capacity}</span>
                    </p>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.instructor_name ?? ""} · {t(c.kind === "kids" ? "common.kids" : "common.adult")}
                  </p>
                  <Bar ratio={ratio} tone={TONE_BAR[occupancyTone(ratio)]!} />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <Card>
        <SectionTitle right={`${todayCheckins.length}`}>{t("today.whoChecked")}</SectionTitle>
        <div className="mt-3 space-y-2">
          {todayCheckins.length === 0 ? <Empty label={t("today.noCheckins")} /> : null}
          {todayCheckins.map(({ a, st, cls }) => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(a.checked_in_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{st?.full_name ?? "—"}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {cls?.name} {cls ? fmtTime(cls.start_time) : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          right={tomorrow.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
        >
          {t("today.tomorrow")}
        </SectionTitle>
        <div className="mt-3 space-y-3">
          {tomorrowClasses.length === 0 ? <Empty label={t("today.noTomorrow")} /> : null}
          {tomorrowClasses.map((c) => {
            const s = sessionByClassTomorrow.get(c.id);
            const bookedIds = s ? (bookingsBySession.get(s.id) ?? []) : [];
            const names = bookedIds
              .map((id) => students.find((x) => x.id === id)?.full_name)
              .filter(Boolean) as string[];
            return (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">{c.name}</p>
                  <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {bookedIds.length}
                    <span className="opacity-40">/{c.capacity}</span> {t("today.booked")}
                  </p>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {fmtTime(c.start_time)}
                </p>
                {names.length > 0 ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{names.join(", ")}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle right={t("common.capacity")}>{t("today.thisWeek")}</SectionTitle>
        <div className="mt-3 space-y-3">
          {weekly.length === 0 ? <Empty label={t("common.none")} /> : null}
          {weekly.map(({ cls, avg, ratio }) => (
            <div key={cls.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  {cls.name}
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    {t(`day.${cls.weekday}`)} {fmtTime(cls.start_time)}
                  </span>
                </p>
                <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {avg.toFixed(0)}
                  <span className="opacity-40">/{cls.capacity}</span>
                </p>
              </div>
              <Bar ratio={ratio} tone={TONE_BAR[occupancyTone(ratio)]!} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle right={`${students.length}`}>{t("nav.students")}</SectionTitle>
        <div className="mt-3 space-y-2">
          {students.slice(0, 5).map((s) => (
            <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="flex items-center gap-3">
              <span className={`size-1.5 shrink-0 rounded-full ${BELT_DOT[s.belt]}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.full_name}</span>
              <Tag>{t(`belt.${s.belt}`)}</Tag>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: boolean }) {
  return (
    <Card className="animate-rise p-3">
      <p className="label-mono">{label}</p>
      <p className={`stat-num mt-1 text-2xl ${tone ? "text-clay" : ""}`}>{value}</p>
    </Card>
  );
}

function QrGlyph() {
  return (
    <div className="grid size-10 grid-cols-5 gap-[2px]">
      {[
        1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1,
      ].map((v, i) => (
        <span key={i} className={v ? "bg-primary-foreground" : "bg-primary-foreground/25"} />
      ))}
    </div>
  );
}

function GuardianToday() {
  const { t } = useI18n();
  const { settings } = useApp();
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const students = studentsQ.data ?? [];

  const from = isoDate(addDays(new Date(), -30));
  const to = isoDate(new Date());
  const sessionsQ = useQuery({ queryKey: ["sessions", from, to], queryFn: () => fetchSessions(from, to) });
  const ids = (sessionsQ.data ?? []).map((s) => s.id);
  const attQ = useQuery({
    queryKey: ["attendance", from, to, ids.length],
    enabled: ids.length > 0,
    queryFn: () => fetchAttendance(ids),
  });
  const attendance = attQ.data ?? [];

  return (
    <div className="space-y-5">
      <SectionTitle right={settings.org_name}>{t("today.myChildren")}</SectionTitle>
      {students.length === 0 ? <Empty label={t("students.none")} /> : null}
      <div className="space-y-2">
        {students.map((s) => {
          const own = attendance.filter((a) => a.student_id === s.id);
          const present = own.filter((a) => a.status !== "absent").length;
          const missed = own.filter((a) => a.status === "absent").length;
          return (
            <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="block">
              <Card className="flex items-center gap-3">
                <span className={`size-2 shrink-0 rounded-full ${BELT_DOT[s.belt]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{t(`belt.${s.belt}`)}</p>
                </div>
                <div className="text-right">
                  <p className="label-mono">{t("students.rate")}</p>
                  <p className="stat-num text-xl">{present}</p>
                </div>
              </Card>
              {missed >= settings.absence_threshold ? (
                <p className="mt-1 rounded-lg bg-clay/10 px-3 py-2 text-xs font-medium text-clay">
                  {missed} {t("students.missed")}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
