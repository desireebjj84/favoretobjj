import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Button, Card, Empty, Field, Input, SectionTitle, Select, Tag } from "@/components/ui-kit";
import {
  BELT_DOT,
  BELTS,
  createStudent,
  fetchLocations,
  fetchStudents,
  setStudentApproval,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/students/")({
  head: () => ({
    meta: [
      { title: "Students — Favoreto BJJ" },
      { name: "description", content: "Adult and kids student roster with belts, units and QR codes." },
      { property: "og:title", content: "Students — Favoreto BJJ" },
      { property: "og:description", content: "Adult and kids student roster with belts, units and QR codes." },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { t } = useI18n();
  const { isStaff, locationId } = useApp();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

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
      <SectionTitle right={`${students.length}`}>{t("students.title")}</SectionTitle>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("students.search")}
      />

      {isStaff ? (
        <>
          <Button variant={adding ? "outline" : "accent"} className="w-full" onClick={() => setAdding(!adding)}>
            {adding ? t("common.cancel") : t("students.add")}
          </Button>
          {adding ? (
            <AddStudentForm
              locations={(locationsQ.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
              defaultLocation={locationId ?? locationsQ.data?.[0]?.id ?? ""}
              onDone={async () => {
                setAdding(false);
                await queryClient.invalidateQueries({ queryKey: ["students"] });
              }}
            />
          ) : null}
        </>
      ) : null}

      {isStaff && pending.length > 0 ? (
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
              <Button variant="accent" onClick={() => decide(s.id, true)}>{t("students.approve")}</Button>
              <Button variant="outline" onClick={() => decide(s.id, false)}>{t("students.reject")}</Button>
            </div>
          ))}
        </Card>
      ) : null}

      <div className="space-y-2">
        {students.length === 0 ? <Empty label={t("students.none")} /> : null}
        {students.map((s) => (
          <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="block">
            <Card className="flex items-center gap-3 px-3 py-2.5">
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

function AddStudentForm({
  locations,
  defaultLocation,
  onDone,
}: {
  locations: { id: string; name: string }[];
  defaultLocation: string;
  onDone: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [belt, setBelt] = useState("white");
  const [loc, setLoc] = useState(defaultLocation);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isMinor = birthDate
    ? new Date().getFullYear() - new Date(birthDate).getFullYear() < 18
    : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createStudent({
        full_name: fullName,
        birth_date: birthDate || null,
        is_minor: isMinor,
        belt,
        location_id: loc,
      });
      await onDone();
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t("common.fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label={t("students.birthDate")}>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label={t("students.belt")}>
          <Select value={belt} onChange={(e) => setBelt(e.target.value)}>
            {BELTS.map((b) => (
              <option key={b} value={b}>
                {t(`belt.${b}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("common.unit")}>
          <Select value={loc} onChange={(e) => setLoc(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="accent" className="w-full" disabled={busy}>
          {t("common.save")}
        </Button>
        {err ? <p className="text-xs text-clay">{err}</p> : null}
      </form>
    </Card>
  );
}
