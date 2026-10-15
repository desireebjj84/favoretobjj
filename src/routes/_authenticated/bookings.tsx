import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { Button, Card, Empty, SectionTitle, Tag } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import {
  BELT_DOT,
  addDays,
  fetchBookings,
  fetchLocations,
  fmtTime,
  isoDate,
  type BookingRow,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — Favoreto BJJ" },
      {
        name: "description",
        content: "See who booked each class today and in the days ahead, with name and belt.",
      },
      { property: "og:title", content: "Bookings — Favoreto BJJ" },
      {
        property: "og:description",
        content: "See who booked each class today and in the days ahead, with name and belt.",
      },
    ],
  }),
  component: BookingsPage,
});

type Tab = "today" | "upcoming" | "past";

function BookingsPage() {
  const { t, lang } = useI18n();
  const { isStaff, locationId } = useApp();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [open, setOpen] = useState<string | null>(null);

  const today = isoDate(new Date());
  const range = useMemo(() => {
    if (tab === "today") return { from: today, to: today };
    if (tab === "past") return { from: isoDate(addDays(new Date(), -30)), to: isoDate(addDays(new Date(), -1)) };
    return { from: today, to: isoDate(addDays(new Date(), 14)) };
  }, [tab, today]);

  const q = useQuery({
    queryKey: ["bookings", range.from, range.to],
    enabled: isStaff,
    queryFn: () => fetchBookings(range.from, range.to),
  });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });

  const rows = (q.data ?? []).filter((r) => !locationId || r.location_id === locationId);

  const days = useMemo(() => {
    const m = new Map<string, Map<string, BookingRow[]>>();
    for (const r of rows) {
      if (!m.has(r.session_date)) m.set(r.session_date, new Map());
      const byClass = m.get(r.session_date)!;
      const key = r.class_id;
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key)!.push(r);
    }
    return [...m.entries()];
  }, [rows]);

  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const dayLabel = (d: string) => {
    const o = new Date(d + "T12:00:00");
    return `${t(`day.${o.getDay()}`)} · ${o.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
  };
  const unitName = (id: string) => locations.find((l) => l.id === id)?.short_name ?? "";

  if (!isStaff) return <Empty label={t("common.none")} />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: t("bookings.tabToday") },
    { id: "upcoming", label: t("bookings.tabUpcoming") },
    { id: "past", label: t("bookings.tabPast") },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle right={tab === "past" ? t("bookings.pastNote") : undefined}>
        {t("bookings.title")}
      </SectionTitle>

      <div className="flex gap-1 overflow-hidden rounded-lg bg-foreground/5 p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => {
              setTab(x.id);
              setOpen(null);
            }}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold",
              tab === x.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {days.length === 0 ? <Empty label={t("bookings.empty")} /> : null}

      {days.map(([date, byClass]) => (
        <div key={date} className="space-y-3">
          <p className="label-mono px-0.5">{dayLabel(date)}</p>
          {[...byClass.entries()].map(([classId, list]) => {
            const first = list[0]!;
            const key = date + classId;
            const isOpen = open === key;
            return (
              <Card key={key} className="p-0">
                <button
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{first.class_name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {fmtTime(first.start_time)}–{fmtTime(first.end_time)}
                      {locationId ? null : ` · ${unitName(first.location_id)}`}
                    </span>
                  </span>
                  <Tag tone="clay">
                    {list.length} {list.length === 1 ? t("bookings.slot") : t("bookings.slots")}
                  </Tag>
                  <span className="font-mono text-xs text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen ? (
                  <div className="border-t border-border/60 px-4 py-3">
                    <p className="label-mono mb-2">{t("bookings.who")}</p>
                    <ul className="space-y-2">
                      {list.map((r) => (
                        <li key={r.id} className="flex items-center gap-2.5">
                          <span className={cn("size-3 shrink-0 rounded-full", BELT_DOT[r.belt])} />
                          <span className="min-w-0 flex-1 truncate text-sm">{r.full_name}</span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t(`belt.${r.belt}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Link to="/class/$id" params={{ id: classId }} search={{ date }} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full">
                          {t("class.whoIn")}
                        </Button>
                      </Link>
                      {date === today ? (
                        <Link to="/checkin" search={{ classId }} className="flex-1">
                          <Button size="sm" className="w-full">
                            {t("nav.checkin")}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
