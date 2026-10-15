import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Button, Card, Empty, Field, Input, SectionTitle, Select, Tag } from "@/components/ui-kit";
import { useEmbedded } from "@/lib/embed";
import {
  BELT_DOT,
  fetchAttendance,
  fetchBookedStudentIds,
  fetchClasses,
  fetchStudents,
  fmtTime,
  getOrCreateSession,
  isoDate,
  setAttendance,
  type StudentRow,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/checkin")({
  validateSearch: (search: Record<string, unknown>) => ({
    classId: typeof search["classId"] === "string" ? (search["classId"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "QR Check-in — Favoreto BJJ" },
      { name: "description", content: "Scan student QR codes and mark attendance for a class." },
      { property: "og:title", content: "QR Check-in — Favoreto BJJ" },
      { property: "og:description", content: "Scan student QR codes and mark attendance for a class." },
    ],
  }),
  component: CheckinPage,
});

function CheckinPage() {
  const { t, lang } = useI18n();
  const { locationId, isStaff } = useApp();
  const embedded = useEmbedded();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const todayStr = isoDate(new Date());
  const [dateStr, setDateStr] = useState<string>(todayStr);
  const dateObj = useMemo(() => new Date(dateStr + "T12:00:00"), [dateStr]);
  const dow = dateObj.getDay();
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const dateLabel = `${t(`day.${dow}`)} · ${dateObj.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents });

  const todayClasses = (classesQ.data ?? []).filter(
    (c) => c.weekday === dow && (!locationId || c.location_id === locationId),
  );

  const [classId, setClassId] = useState<string>(search.classId);
  useEffect(() => {
    if (!classId && todayClasses[0]) setClassId(todayClasses[0].id);
  }, [classId, todayClasses]);
  useEffect(() => {
    if (classId && todayClasses.length > 0 && !todayClasses.some((c) => c.id === classId)) {
      setClassId(todayClasses[0]!.id);
    }
  }, [classId, todayClasses]);

  const selected = todayClasses.find((c) => c.id === classId) ?? null;

  const sessionQ = useQuery({
    queryKey: ["session", classId, dateStr],
    enabled: !!classId && isStaff,
    queryFn: () => getOrCreateSession(classId!, dateStr),
  });
  const sessionId = sessionQ.data?.id;

  const attQ = useQuery({
    queryKey: ["attendance-session", sessionId],
    enabled: !!sessionId,
    queryFn: () => fetchAttendance([sessionId!]),
  });
  const bookedQ = useQuery({
    queryKey: ["booked-students", sessionId],
    enabled: !!sessionId,
    queryFn: () => fetchBookedStudentIds(sessionId!),
  });
  const attendance = attQ.data ?? [];
  const statusByStudent = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attendance) m.set(a.student_id, a.status);
    return m;
  }, [attendance]);

  const bookedIds = useMemo(() => new Set(bookedQ.data ?? []), [bookedQ.data]);
  // Alunos de outra unidade que reservaram esta aula também aparecem na lista.
  const roster: StudentRow[] = (studentsQ.data ?? []).filter(
    (s) => !selected || s.location_id === selected.location_id || bookedIds.has(s.id),
  );

  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  async function mark(student: StudentRow, status: "present" | "absent", method: string) {
    if (!sessionId) {
      setFeedback({ tone: "err", text: t("checkin.noClass") });
      return;
    }
    await setAttendance(sessionId, student.id, status, method);
    await queryClient.invalidateQueries({ queryKey: ["attendance-session", sessionId] });
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    setFeedback({ tone: "ok", text: `${student.full_name} — ${t("checkin.success")}` });
  }

  async function handleCode(code: string) {
    const clean = code.trim();
    const student = (studentsQ.data ?? []).find((s) => s.qr_code === clean || s.id === clean);
    if (!student) {
      setFeedback({ tone: "err", text: t("checkin.notFound") });
      return;
    }
    if (statusByStudent.get(student.id) === "present") {
      setFeedback({ tone: "err", text: `${student.full_name} — ${t("checkin.already")}` });
      return;
    }
    await mark(student, "present", "qr");
  }

  async function startCamera() {
    setFeedback(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          void handleCode(decoded);
        },
        () => {},
      );
    } catch {
      setScanning(false);
      setFeedback({ tone: "err", text: t("checkin.cameraError") });
    }
  }

  async function stopCamera() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  if (!isStaff) {
    return <Empty label={t("settings.roleHint")} />;
  }

  return (
    <div className="space-y-5">
      <SectionTitle right={dateLabel}>{t("checkin.title")}</SectionTitle>

      <Card>
        <Field label={t("checkin.date")}>
          <Input type="date" value={dateStr} onChange={(e) => e.target.value && setDateStr(e.target.value)} />
        </Field>

        <div className="mt-3">
          <Field label={t("checkin.chooseClass")}>
            <Select value={classId ?? ""} onChange={(e) => setClassId(e.target.value)}>
              {todayClasses.length === 0 ? <option value="">{t("today.noClasses")}</option> : null}
              {todayClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {dateLabel} · {c.name} · {fmtTime(c.start_time)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex gap-2">
          {scanning ? (
            <Button variant="outline" className="flex-1" onClick={stopCamera}>
              {t("checkin.stopCamera")}
            </Button>
          ) : (
            <Button variant="accent" className="flex-1" onClick={startCamera} disabled={!classId}>
              {t("checkin.startCamera")}
            </Button>
          )}
        </div>

        {embedded ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t("checkin.embedHint")}
          </p>
        ) : null}

        <div id="qr-reader" className={scanning ? "mt-3 overflow-hidden rounded-xl" : "hidden"} />

        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCode(manual);
            setManual("");
          }}
        >
          <div className="flex-1">
            <Field label={t("checkin.code")}>
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="a1b2c3d4" />
            </Field>
          </div>
          <Button type="submit">{t("checkin.confirm")}</Button>
        </form>

        {feedback ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
              feedback.tone === "ok" ? "bg-green/10 text-green" : "bg-clay/10 text-clay"
            }`}
          >
            {feedback.text}
          </p>
        ) : null}
      </Card>

      <section>
        <SectionTitle right={selected ? `${selected.name} · ${fmtTime(selected.start_time)}` : undefined}>
          {t("roster.title")}
        </SectionTitle>
        <div className="mt-2 space-y-2">
          {roster.length === 0 ? <Empty label={t("students.none")} /> : null}
          {roster.map((s) => {
            const status = statusByStudent.get(s.id);
            return (
              <Card key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className={`size-1.5 shrink-0 rounded-full ${BELT_DOT[s.belt]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{t(`belt.${s.belt}`)}</p>
                </div>
                {status ? (
                  <Tag tone={status === "absent" ? "clay" : "green"}>
                    {t(status === "absent" ? "common.absent" : "common.present")}
                  </Tag>
                ) : (
                  <Tag>{t("common.pending")}</Tag>
                )}
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => void mark(s, "present", "manual")}>
                    ✓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void mark(s, "absent", "manual")}>
                    ✕
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
