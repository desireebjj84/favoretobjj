import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Button, Card, Empty, Field, Input, SectionTitle, Select } from "@/components/ui-kit";
import { StudentPhoto } from "@/components/StudentPhoto";
import { BELT_DOT, BELTS, fetchLocations, type StudentRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/my-students")({
  head: () => ({
    meta: [
      { title: "My Students — Favoreto BJJ" },
      { name: "description", content: "Register yourself or your children and manage their QR codes." },
      { property: "og:title", content: "My Students — Favoreto BJJ" },
      { property: "og:description", content: "Register yourself or your children and manage their QR codes." },
    ],
  }),
  component: MyStudentsPage,
});

function MyStudentsPage() {
  const { t } = useI18n();
  const { session } = useApp();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const uid = session?.user.id ?? "";

  const studentsQ = useQuery({
    queryKey: ["my-students", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .or(`guardian_id.eq.${uid},user_id.eq.${uid}`)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    },
  });
  const locationsQ = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const students = studentsQ.data ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle right={`${students.length}`}>{t("myStudents.title")}</SectionTitle>
      <p className="text-xs text-muted-foreground">{t("myStudents.hint")}</p>

      <Button variant={adding ? "outline" : "accent"} className="w-full" onClick={() => setAdding(!adding)}>
        {adding ? t("common.cancel") : t("myStudents.add")}
      </Button>

      {adding && uid ? (
        <RegisterForm
          uid={uid}
          locations={(locationsQ.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
          onDone={async () => {
            setAdding(false);
            await queryClient.invalidateQueries({ queryKey: ["my-students", uid] });
            await queryClient.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      ) : null}

      <div className="space-y-2">
        {students.length === 0 && !adding ? <Empty label={t("myStudents.none")} /> : null}
        {students.map((s) => (
          <Link key={s.id} to="/students/$id" params={{ id: s.id }} className="block">
            <Card className="flex items-center gap-3 px-3 py-2.5">
              <StudentPhoto studentId={s.id} path={s.photo_url} size={36} />
              <span className={`size-2 shrink-0 rounded-full ${BELT_DOT[s.belt]}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.full_name}</p>
                {!s.approved ? <p className="text-[11px] font-semibold text-clay">{t("students.awaiting")}</p> : null}
                <p className="text-[11px] text-muted-foreground">
                  {t(`belt.${s.belt}`)} · {t(s.is_minor ? "common.kids" : "common.adult")}
                  {s.user_id === uid ? ` · ${t("myStudents.me")}` : ""}
                </p>
              </div>
              <span className="label-mono">{t("students.qr")} →</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RegisterForm({
  uid,
  locations,
  onDone,
}: {
  uid: string;
  locations: { id: string; name: string }[];
  onDone: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [who, setWho] = useState<"child" | "me">("child");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [belt, setBelt] = useState("white");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isMinor = who === "child";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const locationId = loc || locations[0]?.id || "";
      const { error } = await supabase.from("students").insert({
        full_name: fullName.trim(),
        birth_date: birthDate || null,
        is_minor: isMinor,
        belt: belt as StudentRow["belt"],
        location_id: locationId,
        guardian_id: who === "child" ? uid : null,
        user_id: who === "me" ? uid : null,
      });
      if (error) throw error;
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
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={who === "child" ? "accent" : "outline"} onClick={() => setWho("child")}>
            {t("myStudents.child")}
          </Button>
          <Button type="button" variant={who === "me" ? "accent" : "outline"} onClick={() => setWho("me")}>
            {t("myStudents.myself")}
          </Button>
        </div>
        <Field label={t("common.fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
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
          <Select value={loc || locations[0]?.id || ""} onChange={(e) => setLoc(e.target.value)}>
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
