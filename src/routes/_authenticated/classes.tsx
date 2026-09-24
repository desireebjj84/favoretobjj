import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Button, Card, Empty, Field, Input, SectionTitle, Select, Tag } from "@/components/ui-kit";
import { fetchClasses, fetchLocations, fmtTime, type ClassRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Manage classes — Favoreto BJJ" },
      { name: "description", content: "Add and edit the weekly class schedule for each Favoreto BJJ academy." },
      { property: "og:title", content: "Manage classes — Favoreto BJJ" },
      { property: "og:description", content: "Weekly class schedule for each Favoreto BJJ academy." },
    ],
  }),
  component: ClassesPage,
});

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
};

function ClassesPage() {
  const { t } = useI18n();
  const { isAdmin, locationId } = useApp();
  const qc = useQueryClient();
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isAdmin) return <Empty label={t("settings.roleHint")} />;

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
      capacity: 20,
      instructor_name: "",
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
              {list.map((c) => (
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
                  <Tag>{`${c.capacity}`}</Tag>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
