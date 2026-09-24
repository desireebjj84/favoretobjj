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

export async function fetchStudentAttendance(studentId: string) {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, status, checked_in_at, session_id, class_sessions(session_date, classes(name, location_id))")
    .eq("student_id", studentId)
    .order("checked_in_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
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
