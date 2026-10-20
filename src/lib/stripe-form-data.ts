import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isUnder16 } from "./colored-stripes";
import type { StudentRow } from "./data";
import { ANSWER_SCHEMAS, type FormAnswers, type FormColor } from "./stripe-forms";
import type { Json } from "@/integrations/supabase/types";

export type Submission = { id:string; student_id:string; color:FormColor; answers:FormAnswers; student_snapshot:{full_name:string;belt:string;stripes:number;birth_date:string|null}; status:"pending"|"approved"|"rejected"; submitted_at:string; reviewed_at:string|null; review_note:string };
export const stripeFormsOptions = queryOptions({
 queryKey:["stripe-forms"],
 queryFn: async () => {
  const {data,error}=await supabase.from("stripe_submissions").select("*").order("submitted_at",{ascending:false});
  if(error) throw error;
  return (data ?? []) as unknown as Submission[];
 },
});
export const stripeChildrenOptions = queryOptions({
 queryKey:["stripe-form-children"],
 queryFn: async () => {
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError || !auth.user) throw new Error("Sign in required");
  const {data,error}=await supabase.from("students").select("*").eq("guardian_id",auth.user.id).eq("approved",true).eq("active",true).order("full_name");
  if(error) throw error;
  return ((data ?? []) as StudentRow[]).filter(s=>isUnder16(s));
 },
});
export async function submitStripe(studentId:string,color:FormColor,answers:unknown) {
 const parsed=ANSWER_SCHEMAS[color].parse(answers);
 const {error}=await supabase.rpc("submit_stripe_form",{_student_id:studentId,_color:color,_answers:parsed as Json});
 if(error) throw error;
}
export async function reviewStripe(id:string,approve:boolean,note:string) {
 if(note.length>1000) throw new Error("Note too long");
 const {error}=await supabase.rpc("review_stripe_form",{_id:id,_approve:approve,_note:note.trim()});
 if(error) throw error;
}