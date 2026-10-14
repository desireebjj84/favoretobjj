import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Bar, Button, Card, SectionTitle } from "@/components/ui-kit";
import { BELT_DOT, BELT_ORDER, countClassesSince, setRank, type StudentRow } from "@/lib/data";

export function BeltProgress({ student }: { student: StudentRow }) {
  const { t } = useI18n();
  const { settings, isStaff } = useApp();
  const qc = useQueryClient();
  const per = settings.classes_per_stripe || 20;
  const doneQ = useQuery({
    queryKey: ["classes-since", student.id, student.rank_since],
    queryFn: () => countClassesSince(student.id, student.rank_since),
  });
  const done = doneQ.data ?? 0;
  const isBlack = student.belt === "black";
  const left = Math.max(0, per - done);
  const idx = BELT_ORDER.indexOf(student.belt);
  const nextBelt = BELT_ORDER[Math.min(idx + 1, BELT_ORDER.length - 1)] ?? student.belt;
  const nextLabel = student.stripes < 4 ? `${student.stripes + 1}º ${t("belt.stripes")}` : t(`belt.${nextBelt}`);

  async function change(belt: typeof student.belt, stripes: number) {
    await setRank(student.id, belt, stripes);
    await qc.invalidateQueries({ queryKey: ["students"] });
  }

  return (
    <Card>
      <SectionTitle right={`${student.stripes}/4 ${t("belt.stripes")}`}>{t("belt.progress")}</SectionTitle>
      <div className="mt-3 flex h-8 overflow-hidden rounded-md border border-border">
        <div className={`flex-1 ${BELT_DOT[student.belt]}`} />
        <div className="flex w-20 items-center justify-center gap-1 bg-foreground">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-6 w-1.5 rounded-sm ${i < student.stripes ? "bg-background" : "bg-background/20"}`} />
          ))}
        </div>
        <div className={`w-6 ${BELT_DOT[student.belt]}`} />
      </div>
      <p className="mt-2 text-sm font-semibold">
        {t(`belt.${student.belt}`)} · {student.stripes} {t("belt.stripes")}
      </p>
      {isBlack && student.stripes >= 4 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("belt.blackNote")}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-foreground/5 p-2"><p className="label-mono">{t("belt.done")}</p><p className="stat-num text-xl">{done}</p></div>
            <div className="rounded-xl bg-foreground/5 p-2"><p className="label-mono">{t("belt.left")}</p><p className="stat-num text-xl">{left}</p></div>
            <div className="rounded-xl bg-foreground/5 p-2"><p className="label-mono">{t("belt.next")}</p><p className="text-sm font-semibold">{nextLabel}</p></div>
          </div>
          <Bar ratio={Math.min(1, done / per)} tone="bg-green" />
        </>
      )}
      {isStaff ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" className="flex-1" disabled={student.stripes >= 4} onClick={() => change(student.belt, student.stripes + 1)}>
            {t("belt.addStripe")}
          </Button>
          <Button type="button" variant="accent" className="flex-1" disabled={isBlack} onClick={() => change(nextBelt, 0)}>
            {t("belt.promote")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
