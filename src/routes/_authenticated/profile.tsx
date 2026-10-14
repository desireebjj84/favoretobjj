import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { BeltProgress } from "@/components/BeltProgress";
import { Button, Card, Empty, Field, Input, SectionTitle } from "@/components/ui-kit";
import { BELT_DOT, type StudentRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Favoreto BJJ" },
      { name: "description", content: "Your belt, stripes and personal details." },
      { property: "og:title", content: "My profile — Favoreto BJJ" },
      { property: "og:description", content: "Your belt, stripes and personal details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const { session } = useApp();
  const queryClient = useQueryClient();
  const uid = session?.user.id ?? "";

  const profileQ = useQuery({
    queryKey: ["my-profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (error) throw error;
      return data;
    },
  });

  const studentQ = useQuery({
    queryKey: ["my-student", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("user_id", uid).limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as StudentRow | null;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profileQ.data) return;
    setFullName(profileQ.data.full_name ?? "");
    setPhone(profileQ.data.phone ?? "");
    setAddress(profileQ.data.address ?? "");
  }, [profileQ.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, address: address.trim() || null })
        .eq("id", uid);
      if (error) throw error;
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["my-profile", uid] });
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const student = studentQ.data ?? null;

  return (
    <div className="space-y-4">
      <SectionTitle>{t("profile.title")}</SectionTitle>

      {studentQ.isLoading ? null : student ? (
        <Card>
          <div className="flex items-center gap-3">
            <span className={`size-3 shrink-0 rounded-full ${BELT_DOT[student.belt]}`} />
            <div className="min-w-0 flex-1">
              <p className="label-mono">{t("profile.belt")}</p>
              <p className="truncate text-sm font-semibold">
                {student.full_name} · {t(`belt.${student.belt}`)}
              </p>
            </div>
            <Link to="/students/$id" params={{ id: student.id }} className="label-mono shrink-0">
              {t("students.qr")} →
            </Link>
          </div>
          <div className="mt-3">
            <BeltProgress student={student} />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-xs text-muted-foreground">{t("profile.noStudent")}</p>
        </Card>
      )}

      <Card>
        <SectionTitle>{t("profile.myData")}</SectionTitle>
        {profileQ.isLoading ? (
          <Empty label="…" />
        ) : (
          <form onSubmit={save} className="mt-3 space-y-3">
            <Field label={t("common.fullName")}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </Field>
            <Field label={t("profile.phone")}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" />
            </Field>
            <Field label={t("profile.address")}>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
            </Field>
            <Button type="submit" variant="accent" className="w-full" disabled={busy}>
              {t("common.save")}
            </Button>
            {saved ? <p className="text-xs font-semibold text-green">{t("profile.saved")}</p> : null}
            {err ? <p className="text-xs text-clay">{err}</p> : null}
          </form>
        )}
      </Card>
    </div>
  );
}
