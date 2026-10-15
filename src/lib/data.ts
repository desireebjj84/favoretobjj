import { supabase } from "@/integrations/supabase/client";

export type Belt =
  | "white"
  | "grey"
  | "yellow"
  | "orange"
  | "green"
  | "blue"
  | "purple"
  | "brown"
  | "black";

export const BELTS: Belt[] = [
  "white",
  "grey",
  "yellow",
  "orange",
  "green",
  "blue",
  "purple",
  "brown",
  "black",
];

/** Static class strings so Tailwind keeps them in the build. */
export const BELT_DOT: Record<Belt, string> = {
  white: "bg-belt-white",
  grey: "bg-belt-grey",
  yellow: "bg-belt-yellow",
  orange: "bg-belt-orange",
  green: "bg-belt-green",
  blue: "bg-belt-blue",
  purple: "bg-belt-purple",
  brown: "bg-belt-brown",
  black: "bg-belt-black",
};

export type Location = {
  id: string;
  name: string;
  short_name: string;
  city: string;
  sort_order: number;
};

export type ClassRow = {
  id: string;
  location_id: string;
  name: string;
  kind: "adult" | "kids";
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  instructor_id: string | null;
  instructor_name: string | null;
  active: boolean;
};

export type StudentRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  is_minor: boolean;
  belt: Belt;
  location_id: string;
  guardian_id: string | null;
  user_id: string | null;
  qr_code: string;
  active: boolean;
  approved: boolean;
  stripes: number;
  rank_since: string;
};

export type SessionRow = {
  id: string;
  class_id: string;
  session_date: string;
};

export type AttendanceRow = {
  id: string;
  session_id: string;
  student_id: string;
  status: "present" | "absent" | "late";
  method: string;
  checked_in_at: string;
};

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function fmtTime(t: string) {
  return t.slice(0, 5);
}

export async function fetchLocations(): Promise<Location[]> {
  const { data, error } = await supabase.from("locations").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Location[];
}

export async function fetchClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("active", true)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function fetchStudents(): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as StudentRow[];
}

export async function ensureSessions(from: string, to: string) {
  const { error } = await supabase.rpc("ensure_sessions", { _from: from, _to: to });
  if (error) throw error;
}

export async function fetchSessions(from: string, to: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, class_id, session_date")
    .gte("session_date", from)
    .lte("session_date", to);
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export async function fetchAttendance(sessionIds: string[]): Promise<AttendanceRow[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("attendance")
    .select("id, session_id, student_id, status, method, checked_in_at")
    .in("session_id", sessionIds);
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export type HistoryRow = {
  id: string;
  status: "present" | "absent" | "late";
  session_date: string;
  class_id: string | null;
};

export async function fetchStudentAttendance(
  studentId: string,
  from: string,
  to: string,
): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, status, session_id, class_sessions!inner(session_date, class_id)")
    .eq("student_id", studentId)
    .gte("class_sessions.session_date", from)
    .lte("class_sessions.session_date", to)
    .limit(300);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    status: "present" | "absent" | "late";
    class_sessions: { session_date: string; class_id: string } | null;
  }[];
  return rows
    .map((r) => ({
      id: r.id,
      status: r.status,
      session_date: r.class_sessions?.session_date ?? "",
      class_id: r.class_sessions?.class_id ?? null,
    }))
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1));
}

export async function createStudent(input: {
  full_name: string;
  birth_date: string | null;
  is_minor: boolean;
  belt: string;
  location_id: string;
  guardian_id?: string | null;
}) {
  const { error } = await supabase.from("students").insert({
    full_name: input.full_name,
    birth_date: input.birth_date,
    is_minor: input.is_minor,
    belt: input.belt as Belt,
    location_id: input.location_id,
    guardian_id: input.guardian_id ?? null,
  });
  if (error) throw error;
}


/** Creates (if needed) and returns the session row for a class on a date. */
export async function getOrCreateSession(classId: string, date: string): Promise<SessionRow> {
  const existing = await supabase
    .from("class_sessions")
    .select("id, class_id, session_date")
    .eq("class_id", classId)
    .eq("session_date", date)
    .maybeSingle();
  if (existing.data) return existing.data as SessionRow;
  const { data, error } = await supabase
    .from("class_sessions")
    .insert({ class_id: classId, session_date: date })
    .select("id, class_id, session_date")
    .single();
  if (error) throw error;
  return data as SessionRow;
}

export async function setAttendance(
  sessionId: string,
  studentId: string,
  status: "present" | "absent" | "late",
  method: string,
) {
  const { error } = await supabase
    .from("attendance")
    .upsert(
      { session_id: sessionId, student_id: studentId, status, method },
      { onConflict: "session_id,student_id" },
    );
  if (error) throw error;
}

export function occupancyTone(ratio: number) {
  if (ratio >= 1) return "clay" as const;
  if (ratio >= 0.8) return "brown" as const;
  if (ratio < 0.4) return "blue" as const;
  return "green" as const;
}

export const TONE_BAR: Record<string, string> = {
  clay: "bg-clay",
  brown: "bg-brown",
  blue: "bg-blue",
  green: "bg-green",
};

export async function setStudentApproval(id: string, approved: boolean) {
  const { error } = approved
    ? await supabase.from("students").update({ approved: true }).eq("id", id)
    : await supabase.from("students").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export const BELT_ORDER: Belt[] = ["white","grey","yellow","orange","green","blue","purple","brown","black"];
export const ADULT_BELT_ORDER: Belt[] = ["white","blue","purple","brown","black"];

/** Next belt by age: 16+ follows the adult sequence (white→blue…); kids belts (grey…green) only under 16. */
export function nextBeltFor(student: { belt: Belt; birth_date: string | null; is_minor: boolean }): Belt {
  const age = student.birth_date
    ? (Date.now() - new Date(student.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)
    : null;
  const isKid = age !== null ? age < 16 : student.is_minor;
  const order = isKid ? BELT_ORDER : ADULT_BELT_ORDER;
  const idx = order.indexOf(student.belt);
  if (idx === -1) return "blue"; // adult currently on a kids belt
  return order[Math.min(idx + 1, order.length - 1)] ?? student.belt;
}

/** Previous belt in the same age-appropriate sequence (for correcting mistakes). */
export function prevBeltFor(student: { belt: Belt; birth_date: string | null; is_minor: boolean }): Belt {
  const age = student.birth_date
    ? (Date.now() - new Date(student.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)
    : null;
  const isKid = age !== null ? age < 16 : student.is_minor;
  const order = isKid ? BELT_ORDER : ADULT_BELT_ORDER;
  const idx = order.indexOf(student.belt);
  if (idx <= 0) return order[0] ?? student.belt;
  return order[idx - 1] ?? student.belt;
}
export async function countClassesSince(studentId: string, since: string): Promise<number> {
  const { count, error } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .neq("status", "absent")
    .gte("checked_in_at", since);
  if (error) throw error;
  return count ?? 0;
}
export async function setRank(studentId: string, belt: Belt, stripes: number) {
  const { error } = await supabase.from("students").update({ belt, stripes }).eq("id", studentId);
  if (error) throw error;
}
