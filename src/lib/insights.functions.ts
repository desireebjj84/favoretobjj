import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Analysis } from "@/lib/ai/insights.server";

export type { Analysis as AnalysisDTO };

export const analyzeAttendancePatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { locationId: string | null; days: number; lang: "en" | "pt" | "es" }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { runAnalysis } = await import("@/lib/ai/insights.server");
    return runAnalysis(supabase, data);
  });
