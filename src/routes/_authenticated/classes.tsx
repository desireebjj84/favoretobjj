import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { StudentPhoto } from "@/components/StudentPhoto";
import { Button, Card, Empty, Field, Input, SectionTitle, Select, Tag } from "@/components/ui-kit";
import {
  BELT_DOT,
  ageLabel,
  fetchClasses,
  fetchLocations,
  fetchStudents,
  fmtTime,
  setStudentApproval,
  type ClassRow,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Administration — Favoreto BJJ" },
      { name: "description", content: "Manage classes, schedules and students for Favoreto BJJ." },
      { property: "og:title", content: "Administration — Favoreto BJJ" },
      { property: "og:description", content: "Manage classes, schedules and students for Favoreto BJJ." },
    ],
  }),
  component: AdminPage,
});

type Tab = "classes" | "schedule" | "students";
type Draft = {
  id?: string;
  location_id: string;
  name: string;
  kind: "adult" | "kids";
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  instructor_name: string;
  min_age: string;
  max_age: string;
};

function AdminPage() {
  const { t } = useI18n();
  const { isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>("classes");

  if (!isAdmin) return <Empty label={t("settings.roleHint")} />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "classes", label: t("admin.tabClasses") },
    { id: "schedule", label: t("admin.tabSchedule") },
    { id: "students", label: t("admin.tabStudents") },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle>{t("nav.admin")}</SectionTitle>
      <div className="flex gap-2">
        {tabs.map((x) => (
          <Button key={x.id} size="sm" variant={tab === x.id ? "accent" : "outline"} onClick={() => setTab(x.id)}>
            {x.label}
          </Button>
        ))}
      </div>
      {tab === "classes" ? <ClassesTab /> : null}
      {tab === "schedule" ? <ScheduleTab /> : null}
      {tab === "students" ? <StudentsTab /> : null}
    </div>
  );
}

function ageTag(c: ClassRow, years: string): string | null {
  return ageLabel(c.min_age, c.max_age, years);
}

/* ---------------- Turmas ---------------- */

function ClassesTab() {
  const { t } = useI18n();
  const { locationId } = useApp();
  const qc = useQueryClient();
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const locations = (locationsQ.data ?? []).filter((l) => !locationId || l.id === locationId);
  const classes = classesQ.data ?? [];

  function blank(loc: string): Draft {
    return {
      location_id: loc,
      name: "",
      kind: "adult",
      weekday: 1,
      start_time: "19:00",
      end_time: "20:00",
      capacity: 15,
      instructor_name: "",
      min_age: "",
      max_age: "",
    };
  }

  function edit(c: ClassRow) {
    setDraft({
      id: c.id,
      location_id: c.location_id,
      name: c.name,
      kind: c.kind,
      weekday: c.weekday,
      start_time: fmtTime(c.start_time),
      end_time: fmtTime(c.end_time),
      capacity: c.capacity,
      instructor_name: c.instructor_name ?? "",
      min_age: c.min_age != null ? String(c.min_age) : "",
      max_age: c.max_age != null ? String(c.max_age) : "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setErr(null);
    const row = {
      location_id: draft.location_id,
      name: draft.name,
      kind: draft.kind,
      weekday: draft.weekday,
      start_time: draft.start_time,
      end_time: draft.end_time,
      capacity: draft.capacity,
      instructor_name: draft.instructor_name || null,
      min_age: draft.min_age ? Number(draft.min_age) : null,
      max_age: draft.max_age ? Number(draft.max_age) : null,
    };
    const { error } = draft.id
      ? await supabase.from("classes").update(row).eq("id", draft.id)
      : await supabase.from("classes").insert(row);
    if (error) return setErr(error.message);
    setDraft(null);
    await qc.invalidateQueries({ queryKey: ["classes"] });
  }

  async function remove(id: string) {
    if (!confirm(t("classes.confirmRemove"))) return;
    const { error } = await supabase.from("classes").update({ active: false }).eq("id", id);
    if (error) return setErr(error.message);
    setDraft(null);
    await qc.invalidateQueries({ queryKey: ["classes"] });
  }

  return (
    <div className="space-y-5">
      <Link to="/settings" className="label-mono">
        ‹ {t("settings.title")}
      </Link>
      <SectionTitle right={`${classes.length}`}>{t("classes.title")}</SectionTitle>
      {err ? <p className="text-xs text-clay">{err}</p> : null}

      {locations.map((loc) => {
        const list = classes.filter((c) => c.location_id === loc.id);
        const editingHere = draft && draft.location_id === loc.id;
        return (
          <Card key={loc.id}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base uppercase tracking-wide">{loc.name}</h2>
              <Button size="sm" variant="accent" onClick={() => setDraft(blank(loc.id))}>
                + {t("classes.add")}
              </Button>
            </div>

            {editingHere ? (
              <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-foreground/5 p-3">
                <Field label={t("classes.name")}>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Fundamentals, No-Gi, Kids 5-8…"
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("classes.day")}>
                    <Select
                      value={draft.weekday}
                      onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <option key={d} value={d}>
                          {t(`day.${d}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("classes.type")}>
                    <Select
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value as "adult" | "kids" })}
                    >
                      <option value="adult">{t("common.adult")}</option>
                      <option value="kids">{t("common.kids")}</option>
                    </Select>
                  </Field>
                  <Field label={t("classes.start")}>
                    <Input
                      type="time"
                      value={draft.start_time}
                      onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={t("classes.end")}>
                    <Input
                      type="time"
                      value={draft.end_time}
                      onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={t("classes.minAge")}>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.min_age}
                      onChange={(e) => setDraft({ ...draft, min_age: e.target.value })}
                    />
                  </Field>
                  <Field label={t("classes.maxAge")}>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.max_age}
                      onChange={(e) => setDraft({ ...draft, max_age: e.target.value })}
                    />
                  </Field>
                  <Field label={t("common.capacity")}>
                    <Input
                      type="number"
                      min={1}
                      value={draft.capacity}
                      onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) || 1 })}
                    />
                  </Field>
                  <Field label={t("classes.instructor")}>
                    <Input
                      value={draft.instructor_name}
                      onChange={(e) => setDraft({ ...draft, instructor_name: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="accent" className="flex-1">
                    {t("common.save")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                    {t("common.cancel")}
                  </Button>
                  {draft.id ? (
                    <Button type="button" variant="ghost" onClick={() => void remove(draft.id!)}>
                      {t("classes.remove")}
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            <div className="mt-3 space-y-2">
              {list.length === 0 ? <Empty label={t("common.none")} /> : null}
              {list.map((c) => {
                const age = ageTag(c, t("common.years"));
                return (
                  <button
                    key={c.id}
                    onClick={() => edit(c)}
                    className="flex w-full items-center gap-3 rounded-xl bg-foreground/5 px-3 py-2 text-left"
                  >
                    <span className="w-10 shrink-0 font-mono text-[11px] uppercase text-muted-foreground">
                      {t(`day.${c.weekday}`)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                        {c.instructor_name ? ` · ${c.instructor_name}` : ""}
                      </p>
                    </div>
                    {age ? <Tag tone="blue">{age}</Tag> : null}
                    <Tag>{`${c.capacity}`}</Tag>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- Horários ---------------- */

function ScheduleTab() {
  const { t } = useI18n();
  const { locationId } = useApp();
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });

  const locations = (locationsQ.data ?? []).filter((l) => !locationId || l.id === locationId);
  const classes = classesQ.data ?? [];

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{t("admin.scheduleHint")}</p>
      {locations.map((loc) => (
        <Card key={loc.id}>
          <h2 className="font-display text-base uppercase tracking-wide">{loc.name}</h2>
          <div className="mt-3 space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const day = classes
                .filter((c) => c.location_id === loc.id && c.weekday === d)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              if (day.length === 0) return null;
              return (
                <div key={d}>
                  <p className="label-mono mb-1">{t(`day.${d}`)}</p>
                  <div className="space-y-1.5">
                    {day.map((c) => {
                      const age = ageTag(c, t("common.years"));
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 rounded-xl bg-foreground/5 px-3 py-2 text-sm"
                        >
                          <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
                            {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                          </span>
                          <p className="min-w-0 flex-1 truncate font-semibold">{c.name}</p>
                          {age ? <Tag tone="blue">{age}</Tag> : null}
                          <Tag>{`${c.capacity}`}</Tag>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {classes.filter((c) => c.location_id === loc.id).length === 0 ? (
              <Empty label={t("common.none")} />
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Alunos ---------------- */

function StudentsTab() {
  const { t } = useI18n();
  const { locationId } = useApp();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const studentsQ = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (studentsQ.data ?? [])
      .filter((s) => !locationId || s.location_id === locationId)
      .filter((s) => s.approved || !s.active)
      .filter((s) => !q || s.full_name.toLowerCase().includes(q));
  }, [studentsQ.data, query, locationId]);

  const pending = (studentsQ.data ?? []).filter(
    (s) => !s.approved && s.active && (!locationId || s.location_id === locationId),
  );

  async function decide(id: string, ok: boolean) {
    await setStudentApproval(id, ok);
    await queryClient.invalidateQueries({ queryKey: ["students"] });
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("students.search")}
      />

      {pending.length > 0 ? (
        <Card className="space-y-2 border-accent">
          <SectionTitle right={`${pending.length}`}>{t("students.pending")}</SectionTitle>
          {pending.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.full_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(locationsQ.data ?? []).find((l) => l.id === s.location_id)?.short_name} ·{" "}
                  {t(s.is_minor ? "common.kids" : "common.adult")}
                </p>
              </div>
              <Button variant="accent" onClick={() => void decide(s.id, true)}>{t("students.approve")}</Button>
              <Button variant="outline" onClick={() => void decide(s.id, false)}>{t("students.reject")}</Button>
            </div>
          ))}
        </Card>
      ) : null}

      <SectionTitle right={`${students.length}`}>{t("students.title")}</SectionTitle>
      <div className="space-y-2">
        {students.length === 0 ? <Empty label={t("students.none")} /> : null}
        {students.map((s) => (
          <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="block">
            <Card className="flex items-center gap-3 px-3 py-2.5">
              <StudentPhoto studentId={s.id} path={s.photo_url} size={36} />
              <span className={`size-2 shrink-0 rounded-full ${BELT_DOT[s.belt]}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.full_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t(`belt.${s.belt}`)} · {t(s.is_minor ? "common.kids" : "common.adult")}
                </p>
              </div>
              <Tag>{s.active ? t("common.active") : t("common.inactive")}</Tag>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
