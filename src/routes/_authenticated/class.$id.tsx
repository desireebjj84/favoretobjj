import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button, Card, Empty, SectionTitle, Tag } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import {
  BELT_DOT,
  addDays,
  confirmAttendance,
  fetchAttendance,
  fetchBookedStudentIds,
  fetchLocations,
  fetchStudents,
  fmtTime,
  getOrCreateSession,
  isoDate,
  setAttendance,
  type Belt,
  type ClassRow,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/class/$id")({
  head: () => ({
    meta: [
      { title: "Class — Favoreto BJJ" },
      {
        name: "description",
        content: "See who checked in to a class, who booked and who was absent.",
      },
      { property: "og:title", content: "Class — Favoreto BJJ" },
      {
        property: "og:description",
        content: "See who checked in to a class, who booked and who was absent.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { date?: string } => {
    const raw = search["date"];
    return typeof raw === "string" ? { date: raw } : {};
  },
  component: ClassPage,
});

function ClassPage() {
  const { t, lang } = useI18n();
  const { isStaff } = useApp();
  const { id } = Route.useParams();
  const { date: searchDate } = Route.useSearch();
  const date = searchDate || isoDate(new Date());

  const classQ = useQuery({
    queryKey: ["class", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as ClassRow | null;
    },
  });
  const cls = classQ.data ?? null;
  const dow = new Date(date + "T12:00:00").getDay();
  const runsThatDay = !!cls && cls.weekday === dow;

  const sessionQ = useQuery({
    queryKey: ["class-day-session", id, date],
    enabled: isStaff && runsThatDay,
    queryFn: () => getOrCreateSession(id, date),
  });
  const sid = sessionQ.data?.id;

  const attQ = useQuery({
    queryKey: ["class-day-attendance", sid],
    enabled: !!sid,
    queryFn: () => fetchAttendance([sid!]),
  });
  const bookedQ = useQuery({
    queryKey: ["class-day-booked", sid],
    enabled: !!sid,
    queryFn: () => fetchBookedStudentIds(sid!),
  });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents, enabled: isStaff });
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (ids: string[], attended: boolean) => {
    setBusy(ids.length > 1 ? "all" : (ids[0] ?? null));
    try {
      for (const x of ids) await confirmAttendance(x, attended);
      await qc.invalidateQueries({ queryKey: ["class-day-attendance", sid] });
    } finally {
      setBusy(null);
    }
  };
  const markAllAbsent = async () => {
    if (!sid) return;
    setBusy("all");
    try {
      for (const x of bookedOnly) await setAttendance(sid, x, "absent", "manual");
      await qc.invalidateQueries({ queryKey: ["class-day-attendance", sid] });
      await qc.invalidateQueries({ queryKey: ["class-day-booked", sid] });
    } finally {
      setBusy(null);
    }
  };
  const students = studentsQ.data ?? [];
  const byId = new Map(students.map((s) => [s.id, s]));
  const att = attQ.data ?? [];
  const checkedIn = att
    .filter((a) => a.status !== "absent")
    .sort((a, b) => (a.checked_in_at < b.checked_in_at ? -1 : 1));
  const absent = att.filter((a) => a.status === "absent");
  const inIds = new Set(checkedIn.map((a) => a.student_id));
  const absentIds = new Set(absent.map((a) => a.student_id));
  const bookedOnly = (bookedQ.data ?? []).filter((x) => !inIds.has(x) && !absentIds.has(x));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const endMin = cls ? Number(cls.end_time.slice(0, 2)) * 60 + Number(cls.end_time.slice(3, 5)) : 0;
  const classEnded = date < isoDate(new Date()) || (date === isoDate(new Date()) && nowMin > endMin);
  const adultEnded = !!cls && cls.kind === "adult" && classEnded;

  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const dayObj = new Date(date + "T12:00:00");
  const dateLabel = `${t(`day.${dayObj.getDay()}`)} · ${dayObj.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  })}`;
  const unit = (locationsQ.data ?? []).find((l) => l.id === cls?.location_id)?.short_name ?? "";

  const Person = ({ sid2 }: { sid2: string }) => {
    const st = byId.get(sid2);
    const belt = (st?.belt ?? "white") as Belt;
    return (
      <div className="flex items-center gap-2.5">
        <span className={cn("size-3 shrink-0 rounded-full", BELT_DOT[belt])} />
        <span className="min-w-0 flex-1 truncate text-sm">{st?.full_name ?? "—"}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t(`belt.${belt}`)}
        </span>
      </div>
    );
  };

  if (!isStaff) return <Empty label={t("common.none")} />;

  const shift = (n: number) => isoDate(addDays(dayObj, n));

  return (
    <div className="space-y-4">
      <SectionTitle right={unit}>{t("class.title")}</SectionTitle>

      {!cls ? (
        <Empty label={t("common.none")} />
      ) : (
        <Card>
          <p className="font-display text-lg uppercase tracking-wide">{cls.name}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {fmtTime(cls.start_time)}–{fmtTime(cls.end_time)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              to="/class/$id"
              params={{ id }}
              search={{ date: shift(-1) }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs"
            >
              ‹
            </Link>
            <span className="flex-1 text-center font-mono text-xs">{dateLabel}</span>
            <Link
              to="/class/$id"
              params={{ id }}
              search={{ date: shift(1) }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs"
            >
              ›
            </Link>
          </div>
          <div className="mt-3 flex gap-2">
            <Link to="/class/$id" params={{ id }} search={{ date: isoDate(new Date()) }} className="flex-1">
              <Button size="sm" variant="outline" className="w-full">
                {t("class.today")}
              </Button>
            </Link>
            <Link to="/checkin" search={{ classId: id }} className="flex-1">
              <Button size="sm" className="w-full">
                {t("nav.checkin")}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {!runsThatDay ? <Empty label={t("class.notThatDay")} /> : null}

      {runsThatDay ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3">
              <p className="label-mono">{t("class.checkins")}</p>
              <p className="font-display text-2xl">{checkedIn.length}</p>
            </Card>
            <Card className="p-3">
              <p className="label-mono">{t("bookings.title")}</p>
              <p className="font-display text-2xl">{(bookedQ.data ?? []).length}</p>
            </Card>
            <Card className="p-3">
              <p className="label-mono">{t("class.absent")}</p>
              <p className="font-display text-2xl">{absent.length}</p>
            </Card>
          </div>

          <Card>
            <SectionTitle right={`${checkedIn.length}`}>{t("class.whoIn")}</SectionTitle>
            <div className="mt-3 space-y-2">
              {checkedIn.length === 0 ? <Empty label={t("class.noCheckins")} /> : null}
              {checkedIn.some((a) => !a.confirmed) ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={busy !== null}
                  onClick={() => decide(checkedIn.filter((a) => !a.confirmed).map((a) => a.id), true)}
                >
                  {t("class.confirmAll")}
                </Button>
              ) : null}
              {checkedIn.map((a) => (
                <div key={a.id} className="rounded-lg border border-border/70 p-2.5">
                  <Person sid2={a.student_id} />
                  {a.confirmed ? (
                    <div className="mt-2 flex items-center justify-between">
                      <Tag tone="green">{t("class.confirmed")}</Tag>
                      <button
                        className="font-mono text-[10px] uppercase text-muted-foreground underline"
                        disabled={busy !== null}
                        onClick={() => decide([a.id], false)}
                      >
                        {t("class.noShow")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="min-h-[40px] flex-1" disabled={busy !== null} onClick={() => decide([a.id], true)}>
                        {t("class.confirm")}
                      </Button>
                      <Button size="sm" variant="outline" className="min-h-[40px] flex-1" disabled={busy !== null} onClick={() => decide([a.id], false)}>
                        {t("class.noShow")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {bookedOnly.length > 0 ? (
            <Card>
              <SectionTitle right={`${bookedOnly.length}`}>{t("class.bookedNotIn")}</SectionTitle>
              {adultEnded ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground">{t("adult.checkinNote")}</p>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void markAllAbsent()}>
                    {t("class.markAllAbsent")}
                  </Button>
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                {bookedOnly.map((x) => (
                  <div key={x} className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <Person sid2={x} />
                    </div>
                    {adultEnded ? <Tag tone="clay">{t("class.lostSpot")}</Tag> : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {absent.length > 0 ? (
            <Card>
              <SectionTitle right={`${absent.length}`}>{t("class.absent")}</SectionTitle>
              <div className="mt-3 space-y-2">
                {absent.map((a) => (
                  <Person key={a.id} sid2={a.student_id} />
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
