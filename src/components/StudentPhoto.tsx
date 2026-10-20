import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

/** Uploads the photo (upsert, single file per student) and saves the path on the student. */
export async function uploadStudentPhoto(studentId: string, file: File) {
  const path = `students/${studentId}.jpg`;
  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { error: dbError } = await supabase.from("students").update({ photo_url: path }).eq("id", studentId);
  if (dbError) throw dbError;
}

export async function removeStudentPhoto(studentId: string, path: string | null) {
  if (path) {
    const { error } = await supabase.storage.from("profile-photos").remove([path]);
    if (error) throw error;
  }
  const { error } = await supabase.from("students").update({ photo_url: null }).eq("id", studentId);
  if (error) throw error;
}

function useSignedPhoto(path: string | null | undefined) {
  return useQuery({
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryKey: ["photo-url", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(path as string, 60 * 60 * 6);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}

export function StudentPhoto({
  studentId,
  path,
  size = 40,
  className = "",
}: {
  studentId: string;
  path: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const { data: url } = useSignedPhoto(path);
  const initials = "…";
  if (!url) {
    return (
      <span
        style={{ width: size, height: size }}
        className={`grid shrink-0 place-items-center rounded-full bg-foreground/10 font-mono text-[10px] text-muted-foreground ${className}`}
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={`student-${studentId}`}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

/** Small "add/change photo" button; caller decides who is allowed to use it. */
export function StudentPhotoControls({
  studentId,
  path,
  onChanged,
  compact = false,
}: {
  studentId: string;
  path: string | null | undefined;
  onChanged: () => void | Promise<void>;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await uploadStudentPhoto(studentId, file);
      await qc.invalidateQueries({ queryKey: ["photo-url"] });
      await qc.invalidateQueries({ queryKey: ["students"] });
      await onChanged();
    } catch (error) {
      setErr(error instanceof Error ? error.message : t("photo.error"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col items-start gap-1" : "flex flex-col gap-1"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="label-mono text-gold underline-offset-2 hover:underline disabled:opacity-50"
      >
        {busy ? "…" : path ? t("photo.change") : t("photo.add")}
      </button>
      {err ? <p className="text-[10px] text-clay">{err}</p> : null}
    </div>
  );
}
