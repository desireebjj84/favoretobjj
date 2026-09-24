import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Bar, Card, Empty, SectionTitle, Tag } from "@/components/ui-kit";
import {
  BELT_DOT,
  addDays,
  fetchClasses,
  fetchStudentAttendance,
  fetchStudents,
  fmtTime,
  isoDate,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({
    meta: [
      { title: "Student history — Favoreto BJJ" },
      { name: "description", content: "Individual attendance history, belt and personal QR code." },
      { property: "og:title", content: "Student history — Favoreto BJJ" },
      { property: "og:description", content: "Individual attendance history, belt and personal QR code." },
    ],
  }),
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const { t, lang } = useI18n();
  const { settings } = useApp();
  const [qr, setQr] = useState<string | null>(null);

  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const student = (studentsQ.data ?? []).find((s) => s.id === id) ?? null;

  const from = isoDate(addDays(new Date(), -90));
  const to = isoDate(new Date());
  const historyQ = useQuery({
    queryKey: ["student-attendance", id, from, to],
    queryFn: () => fetchStudentAttendance(id, from, to),
  });

  useEffect(() => {
    if (!student) return;
    void QRCode.toDataURL(student.qr_code, { margin: 1, width: 240 }).then(setQr);
  }, [student]);

  if (studentsQ.isLoading) return <Empty label="…" />;
  if (!student) return <Empty label={t("students.none")} />;

  const rows = historyQ.data ?? [];
  const present = rows.filter((r) => r.status !== "absent").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const total = rows.length;
  const rate = total ? present / total : 0;
  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const classNameById = new Map((classesQ.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <Link to="/students" className="label-mono">
        ‹ {t("nav.students")}
      </Link>

      <Card>
        <div className="flex items-center gap-3">
          <span className={`size-3 shrink-0 rounded-full ${BELT_DOT[student.belt]}`} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl uppercase tracking-wide">{student.full_name}</h1>
            <p className="text-[11px] text-muted-foreground">
              {t(`belt.${student.belt}`)} · {t(student.is_minor ? "common.kids" : "common.adult")}
            </p>
          </div>
          <Tag>{student.active ? t("common.active") : t("common.inactive")}</Tag>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label={t("common.present")} value={present} />
          <Metric label={t("common.absent")} value={absent} tone={absent >= settings.absence_threshold} />
          <Metric label={t("students.rate")} value={`${Math.round(rate * 100)}%`} />
        </div>
        <Bar ratio={rate} tone="bg-green" />

        {absent >= settings.absence_threshold ? (
          <p className="mt-3 rounded-lg bg-clay/10 px-3 py-2 text-xs font-medium text-clay">
            {t("students.alert")} — {absent} {t("students.missed")}
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle right={t("students.qrHint")}>{t("students.qr")}</SectionTitle>
        <div className="mt-3 flex flex-col items-center">
          {qr ? <img src={qr} alt="QR" className="size-48 rounded-xl bg-white p-2" /> : null}
          <p className="mt-2 font-mono text-xs text-muted-foreground">{student.qr_code}</p>
        </div>
      </Card>

      <section>
        <SectionTitle right={`${total}`}>{t("students.history")}</SectionTitle>
        <div className="mt-2 space-y-2">
          {rows.length === 0 ? <Empty label={t("students.noHistory")} /> : null}
          {rows.map((r) => {
            const cls = r.class_id ? classNameById.get(r.class_id) : undefined;
            return (
              <Card key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{cls?.name ?? "—"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {new Date(`${r.session_date}T12:00:00`).toLocaleDateString(locale, {
                      day: "2-digit",
                      month: "short",
                    })}
                    {cls ? ` · ${fmtTime(cls.start_time)}` : ""}
                  </p>
                </div>
                <Tag tone={r.status === "absent" ? "clay" : "green"}>
                  {t(r.status === "absent" ? "common.absent" : "common.present")}
                </Tag>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: boolean }) {
  return (
    <div className="rounded-xl bg-foreground/5 p-2 text-center">
      <p className="label-mono">{label}</p>
      <p className={`stat-num text-xl ${tone ? "text-clay" : ""}`}>{value}</p>
    </div>
  );
}
