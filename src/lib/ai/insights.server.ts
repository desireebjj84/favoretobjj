import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError, type ModelMessage } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLovableAiGatewayRunIdFetch } from "./run-id";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const analysisSchema = z.object({
  summary: z.string(),
  patterns: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
    }),
  ),
  suggestions: z.array(
    z.object({
      weekday: z.number(),
      time: z.string(),
      kind: z.enum(["adult", "kids"]),
      className: z.string(),
      reason: z.string(),
      expectedDemand: z.enum(["low", "medium", "high"]),
    }),
  ),
});

export type Analysis = z.infer<typeof analysisSchema>;

type AttendanceRaw = {
  status: string;
  session_id: string;
  class_sessions: {
    session_date: string;
    class_id: string;
    classes: {
      name: string;
      start_time: string;
      kind: string;
      capacity: number;
      location_id: string;
    };
  };
};

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekdayOf(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.getDay();
}

function clampTime(t: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return "09:00";
  const h = Math.min(22, Math.max(6, Number(m[1])));
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function normalize(a: Analysis): Analysis {
  return {
    summary: String(a.summary ?? ""),
    patterns: (a.patterns ?? [])
      .slice(0, 5)
      .map((p) => ({ title: String(p.title ?? ""), detail: String(p.detail ?? "") })),
    suggestions: (a.suggestions ?? [])
      .slice(0, 6)
      .map((s) => ({
        weekday: Math.min(6, Math.max(0, Math.round(Number(s.weekday) || 0))),
        time: clampTime(String(s.time ?? "")),
        kind: s.kind === "adult" ? "adult" : "kids",
        className: String(s.className ?? ""),
        reason: String(s.reason ?? ""),
        expectedDemand: s.expectedDemand === "low" || s.expectedDemand === "medium" ? s.expectedDemand : "medium",
      })),
  };
}

export async function runAnalysis(
  supabase: SupabaseClient,
  input: { locationId: string | null; days: number; lang: string },
): Promise<Analysis> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI key is not configured");

  const days = Math.min(120, Math.max(7, Math.round(input.days || 30)));
  const to = isoDaysAgo(0);
  const from = isoDaysAgo(days - 1);

  const langName = input.lang === "pt" ? "Portuguese" : input.lang === "es" ? "Spanish" : "English";

  // Location name
  let locationName = "All units";
  if (input.locationId) {
    const { data: loc } = await supabase
      .from("locations")
      .select("name")
      .eq("id", input.locationId)
      .maybeSingle();
    if (loc?.name) locationName = loc.name;
  }

  // Current schedule for the location
  let scheduleQ = supabase
    .from("classes")
    .select("name, kind, weekday, start_time, end_time, capacity")
    .eq("active", true)
    .order("weekday")
    .order("start_time");
  if (input.locationId) scheduleQ = scheduleQ.eq("location_id", input.locationId);
  const { data: schedule, error: scheduleError } = await scheduleQ;
  if (scheduleError) throw scheduleError;

  // Attendance rows for the period
  let attQ = supabase
    .from("attendance")
    .select(
      "status, session_id, class_sessions!inner(session_date, class_id, classes!inner(name, start_time, kind, capacity, location_id))",
    )
    .gte("class_sessions.session_date", from)
    .lte("class_sessions.session_date", to);
  if (input.locationId) attQ = attQ.eq("class_sessions.classes.location_id", input.locationId);
  const { data: attRows, error: attError } = await attQ;
  if (attError) throw attError;

  const byClass = new Map<
    string,
    { name: string; start: string; kind: string; cap: number; dates: Set<string>; present: number; absent: number }
  >();
  for (const raw of (attRows ?? []) as unknown as AttendanceRaw[]) {
    const cs = raw.class_sessions;
    const cls = cs.classes;
    let entry = byClass.get(cs.class_id);
    if (!entry) {
      entry = { name: cls.name, start: cls.start_time, kind: cls.kind, cap: cls.capacity, dates: new Set(), present: 0, absent: 0 };
      byClass.set(cs.class_id, entry);
    }
    entry.dates.add(cs.session_date);
    if (raw.status === "absent") entry.absent += 1;
    else entry.present += 1;
  }

  const attendanceByClass = [...byClass.values()].map((e) => {
    const sessions = e.dates.size || 1;
    const avgPresent = e.present / sessions;
    const avgAbsent = e.absent / sessions;
    const cap = e.cap || 15;
    return {
      className: e.name,
      kind: e.kind,
      start: e.start,
      sessionsHeld: e.dates.size,
      avgPresent: Number(avgPresent.toFixed(1)),
      avgAbsent: Number(avgAbsent.toFixed(1)),
      capacity: cap,
      fillPct: Math.round((avgPresent / cap) * 100),
    };
  });

  const stats = {
    academy: "Favoreto BJJ (Miami)",
    location: locationName,
    period: { from, to, days },
    maxStudentsPerClass: 15,
    notes:
      "Attendance statuses: present = attended, absent = no-show, late = attended late. fillPct = average present / capacity. Weekday numbers: 0=Sunday..6=Saturday. Times are 24h HH:MM local.",
    existingSchedule: schedule ?? [],
    attendanceByClass,
  };

  const instructions = [
    "You are an attendance analyst for the Favoreto Brazilian Jiu-Jitsu academies in Miami.",
    "You receive one location's attendance statistics for a past period plus its current class schedule.",
    "Identify 3 to 5 concrete attendance patterns (best and worst slots, kids vs adults, weekday effects, classes near capacity, chronic no-shows, booking pressure) grounded in the numbers.",
    "Suggest 3 to 6 new class slots that would likely fill: weekday (0=Sunday..6=Saturday), start time (24h HH:MM) that does not overlap existing classes at the same location and keeps at least 15 minutes between classes, kind (adult or kids) and a short class name consistent with the academy naming style.",
    "For each suggestion give a one-sentence reason grounded in the data and expectedDemand (low/medium/high). Max 15 students per class.",
    "If there is little or no attendance data, say so in the summary and base patterns on the schedule gaps and typical BJJ demand instead.",
    `Write every text field (summary, pattern titles and details, suggestion names and reasons) in ${langName}.`,
  ].join(" ");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: "user", content: JSON.stringify(stats, null, 2) }] as ModelMessage[],
    output: Output.object({ schema: analysisSchema }),
    maxRetries: 0,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    const output = await result.output;
    return normalize(output);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const text = (error as { text?: string }).text;
      throw new Error(text ? String(text).slice(0, 300) : "The model did not return a valid analysis.");
    }
    const err = error as { message?: string; statusCode?: number; responseBody?: string };
    throw new Error(err?.message ? String(err.message).slice(0, 300) : "The analysis failed.");
  }
}
