import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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

const BOOK_L = {
  en: { book: "Book", booked: "Booked", full: "Full", reserved: "booked" },
  pt: { book: "Reservar", booked: "Reservado", full: "Lotada", reserved: "reservas" },
  es: { book: "Reservar", booked: "Reservado", full: "Llena", reserved: "reservas" },
} as const;

function CalendarPage() {
  const { t, lang } = useI18n();
  const { locationId, isStaff } = useApp();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const L = BOOK_L[(lang as keyof typeof BOOK_L) in BOOK_L ? (lang as keyof typeof BOOK_L) : "en"];

  const weekStart = addDays(startOfWeek(new Date()), offset * 7);
  const from = isoDate(weekStart);
  const to = isoDate(addDays(weekStart, 6));

  const [ready, setReady] = useState(0);
  useEffect(() => {
    void ensureSessions(from, to).then(() => {
      setReady((n) => n + 1);
      void qc.invalidateQueries({ queryKey: ["sessions", from, to] });
    });
  }, [from, to, qc]);

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const sessionsQ = useQuery({ queryKey: ["sessions", from, to], queryFn: () => fetchSessions(from, to) });
  const ids = useMemo(() => (sessionsQ.data ?? []).map((s) => s.id), [sessionsQ.data]);
  const attQ = useQuery({
    queryKey: ["attendance", from, to, ids.length],
    enabled: ids.length > 0,
    queryFn: () => fetchAttendance(ids),
  });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents, enabled: !isStaff });
  const bookCountQ = useQuery({
    queryKey: ["booking-counts", from, to, ids.length, ready],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("session_booking_count", { _session_ids: ids });
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.session_id, Number(r.n)]));
    },
  });
  const myBookingsQ = useQuery({
    queryKey: ["my-bookings", from, to, ids.length],
    enabled: ids.length > 0 && !isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, session_id, student_id").in("session_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggle(sessionId: string, studentId: string) {
    setBusy(sessionId + studentId);
    const existing = (myBookingsQ.data ?? []).find((b) => b.session_id === sessionId && b.student_id === studentId);
    const { error } = existing
      ? await supabase.from("bookings").delete().eq("id", existing.id)
      : await supabase.from("bookings").insert({ session_id: sessionId, student_id: studentId });
    setBusy(null);
    if (error) alert(error.message);
    await qc.invalidateQueries({ queryKey: ["my-bookings"] });
    await qc.invalidateQueries({ queryKey: ["booking-counts"] });
  }

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
  const myStudents = studentsQ.data ?? [];
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
            <div className="mt-4 space-y-4">
              {dayClasses.map((c) => {
                const s = sessions.find((x) => x.class_id === c.id && x.session_date === dateStr);
                const count = s ? (counts.get(s.id) ?? 0) : 0;
                const ratio = c.capacity ? count / c.capacity : 0;
                const locName = locationId
                  ? null
                  : ((locationsQ.data ?? []).find((l) => l.id === c.location_id)?.short_name ?? null);
                const body = (
                  <>
                    {locName ? (
                      <p className="mb-1.5">
                        <Tag tone="clay">{locName}</Tag>
                      </p>
                    ) : null}
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
                    {s && (bookCountQ.data?.get(s.id) ?? 0) > 0 ? (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {bookCountQ.data?.get(s.id)} {L.reserved}
                      </p>
                    ) : null}
                  </>
                );
                const booked = s ? (bookCountQ.data?.get(s.id) ?? 0) : 0;
                const bookable = !isStaff && s && dateStr >= todayStr && myStudents.length > 0;
                const tile = "rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-accent/40";
                return isStaff && dateStr === todayStr ? (
                  <Link
                    key={c.id}
                    to="/checkin"
                    search={{ classId: c.id }}
                    className={cn(tile, "block active:scale-[0.99]")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={c.id} className={cn(tile, bookable && "flex flex-wrap items-center gap-4")}>
                    <div className="min-w-0 flex-1">{body}</div>
                    {bookable ? (
                      <div className="flex shrink-0 flex-wrap gap-3">
                        {myStudents
                          .map((st) => {
                            const mine = (myBookingsQ.data ?? []).some(
                              (b) => b.session_id === s!.id && b.student_id === st.id,
                            );
                            const full = !mine && booked >= c.capacity;
                            return (
                              <Button
                                key={st.id}
                                size="sm"
                                variant={mine ? "accent" : "outline"}
                                className="min-h-[44px] min-w-[92px] px-4 text-sm"
                                disabled={full || busy === s!.id + st.id}
                                onClick={() => void toggle(s!.id, st.id)}
                              >
                                {mine ? `✓ ${L.booked}` : full ? L.full : L.book}
                                {myStudents.length > 1 ? ` · ${st.full_name.split(" ")[0]}` : ""}
                              </Button>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
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
