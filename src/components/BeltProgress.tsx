import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { isUnder16, STRIPE_COLORS, STRIPE_TONE, type StripeColor } from "@/lib/colored-stripes";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Bar, Button, Card, SectionTitle } from "@/components/ui-kit";
import {
  BELT_DOT,
  classesPerStripeFor,
  countClassesSince,
  fetchBeltRequirements,
  nextBeltFor,
  prevBeltFor,
  setRank,
  setColoredStripes,
  type StudentRow,
} from "@/lib/data";

export function BeltProgress({ student }: { student: StudentRow }) {
  const { t } = useI18n();
  const { settings, isStaff } = useApp();
  const qc = useQueryClient();
  const [colorBusy, setColorBusy] = useState(false);
  const [colorError, setColorError] = useState(false);
  const kid = isUnder16(student);
  const colors = student.colored_stripes ?? [];
  async function saveColors(next: StripeColor[]) {
    setColorBusy(true);
    setColorError(false);
    try {
      await setColoredStripes(student.id, next);
      await Promise.all(["students", "my-student", "my-students"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    } catch {
      setColorError(true);
    } finally {
      setColorBusy(false);
    }
  }
  const reqsQ = useQuery({ queryKey: ["belt-requirements"], queryFn: fetchBeltRequirements });
  const per = classesPerStripeFor(student, reqsQ.data ?? [], settings.classes_per_stripe || 20);
  const yearsReq = yearsPerStripeFor(student, reqsQ.data ?? []);
  const doneQ = useQuery({
    queryKey: ["classes-since", student.id, student.rank_since],
    queryFn: () => countClassesSince(student.id, student.rank_since),
  });
  const done = doneQ.data ?? 0;
  const isBlack = student.belt === "black";
  const left = Math.max(0, per - done);
  const nextBelt = nextBeltFor(student);
  const yearsOn =
    isBlack && yearsReq
      ? (Date.now() - new Date(student.rank_since).getTime()) / (365.25 * 24 * 3600 * 1000)
      : 0;
  const yearsNeeded = yearsReq ? yearsReq * (student.stripes + 1) : 0;
  const monthsLeft = Math.max(0, Math.round((yearsNeeded - yearsOn) * 12));
  const timeLeft =
    monthsLeft >= 12
      ? `${(monthsLeft / 12).toFixed(1)} ${t("common.years")}`
      : `${monthsLeft} ${t("belt.months")}`;
  const nextLabel = student.stripes < 4 ? `${student.stripes + 1}º ${t("belt.stripes")}` : t(`belt.${nextBelt}`);

  async function change(belt: typeof student.belt, stripes: number) {
    await setRank(student.id, belt, stripes);
    await qc.invalidateQueries({ queryKey: ["students"] });
  }

  return (
    <Card>
      <SectionTitle right={`${student.stripes}/4 ${t("belt.stripes")}`}>{t("belt.progress")}</SectionTitle>
      <div className="mt-3 flex h-8 overflow-hidden rounded-md border border-border">
        {(kid || colors.length > 0) && (
          <div className={`flex max-w-[45%] items-center gap-1 overflow-x-auto px-2 ${BELT_DOT[student.belt]}`} aria-label={t("belt.coloredStripes")}>
            {colors.map((color, i) => <span key={i} title={t(`stripe.${color}`)} className={`h-6 w-1.5 shrink-0 rounded-sm border border-foreground/20 ${STRIPE_TONE[color]}`} />)}
          </div>
        )}
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
      {(kid || colors.length > 0) && (
        <section className="mt-3 border-t border-border pt-3">
          <p className="label-mono">{t("belt.coloredStripes")} · {colors.length}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((color, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className={`h-5 w-2 rounded-sm ${STRIPE_TONE[color]}`} />
                <span>{t(`stripe.${color}`)}</span>
                {isStaff && <Button variant="ghost" size="sm" disabled={colorBusy} aria-label={`${t("belt.removeStripe")} ${t(`stripe.${color}`)} ${i + 1}`} title={t("belt.removeStripe")} onClick={() => saveColors(colors.filter((_, index) => index !== i))}><X className="size-4" /></Button>}
              </div>
            ))}
          </div>
          {isStaff && kid && <div className="mt-2 flex flex-wrap gap-2">
            {STRIPE_COLORS.map((color) => <Button key={color} variant="outline" size="sm" disabled={colorBusy} aria-label={`${t("belt.addStripe")} ${t(`stripe.${color}`)}`} title={`${t("belt.addStripe")} ${t(`stripe.${color}`)}`} onClick={() => saveColors([...colors, color])}><span className={`size-4 rounded-full ${STRIPE_TONE[color]}`} /><Plus className="size-4" /><span>{t(`stripe.${color}`)}</span></Button>)}
          </div>}
          {colorError && <p role="alert" className="mt-2 text-xs text-destructive">{t("belt.colorError")}</p>}
        </section>
      )}
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
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={student.stripes >= 4} onClick={() => change(student.belt, student.stripes + 1)}>
              {t("belt.addStripe")}
            </Button>
            <Button type="button" variant="accent" className="flex-1" disabled={isBlack} onClick={() => change(nextBelt, 0)}>
              {t("belt.promote")}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={student.stripes <= 0} onClick={() => change(student.belt, student.stripes - 1)}>
              {t("belt.removeStripe")}
            </Button>
            <Button type="button" variant="outline" className="flex-1" disabled={student.belt === "white"} onClick={() => change(prevBeltFor(student), 4)}>
              {t("belt.demote")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
