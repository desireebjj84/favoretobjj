import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Send, Check, X, FileText } from "lucide-react";
import { Button, Field, Input, Select, SectionTitle, Tag, Empty } from "@/components/ui-kit";
import { useApp } from "@/lib/app-context";
import { useI18n } from "@/lib/i18n";
import { stripeFormsOptions, stripeChildrenOptions, submitStripe, reviewStripe, type Submission } from "@/lib/stripe-form-data";
import { FORM_COLORS, FORM_TITLES, PARENT_QUESTIONS, TEACHER_QUESTIONS, meetsMinimum, type FormAnswers, type FormColor } from "@/lib/stripe-forms";
import { STRIPE_TONE } from "@/lib/colored-stripes";

export const Route = createFileRoute("/_authenticated/stripe-forms")({
 loader: async ({context}) => { await Promise.all([context.queryClient.ensureQueryData(stripeFormsOptions),context.queryClient.ensureQueryData(stripeChildrenOptions)]); },
 head: () => ({meta:[{title:"Colored Stripe Forms — Favoreto BJJ"},{name:"description",content:"Submit your child's colored stripe evaluations and review awards in the Favoreto BJJ portal."},{property:"og:title",content:"Colored Stripe Forms — Favoreto BJJ"},{property:"og:description",content:"Parent evaluations and administrator approval for colored stripes."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),
 component: StripeFormsPage,
});

function StripeFormsPage() {
 const {t,lang}=useI18n(); const {isAdmin,isStaff}=useApp(); const qc=useQueryClient();
 const {data:forms}=useSuspenseQuery(stripeFormsOptions); const {data:children}=useSuspenseQuery(stripeChildrenOptions);
 const [adding,setAdding]=useState(false); const [active,setActive]=useState<Submission|null>(null); const [tab,setTab]=useState("pending");
 const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [note,setNote]=useState("");
 async function refresh() { await Promise.all(["stripe-forms","students","my-students","my-student","stripe-form-children"].map(key=>qc.invalidateQueries({queryKey:[key]}))); }
 async function decide(approve:boolean) {
  if(!active || busy) return;
  if(approve && !window.confirm(t("forms.confirm"))) return;
  setBusy(true);setError("");
  try {await reviewStripe(active.id,approve,note); await refresh();setActive(null);setNote("");} catch {setError(t("forms.error"));} finally {setBusy(false);}
 }
 if(isStaff && !isAdmin) return <Empty label={t("role.admin")} />;
 return <div className="space-y-5">
  <SectionTitle><span className="flex items-center gap-2"><FileText className="size-5"/>{t("forms.title")}</span></SectionTitle>
  {notice && <p role="status" className="text-sm text-green">{notice}</p>}
  {error && <p role="alert" className="text-sm text-clay">{error}</p>}
  {children.length>0 && !active && <Button variant="accent" onClick={()=>{setAdding(!adding);setNotice("");}}>{adding?t("forms.cancel"):t("forms.new")}</Button>}
  {!isAdmin && !children.length && <Empty label={t("forms.noChildren")}/>}
  {adding && !active && <ParentForm childrenList={children} onDone={async()=>{await refresh();setAdding(false);setNotice(t("forms.sent"));}}/>}
  {active ? <section className="space-y-5 border-t border-border pt-4">
   <Button variant="outline" onClick={()=>{setActive(null);setNote("");setError("");}}>{t("common.close")}</Button>
   <h2 className="font-display text-xl">{active.student_snapshot.full_name}</h2>
   <p className="text-sm text-muted-foreground">{t(`belt.${active.student_snapshot.belt}`)} · {active.student_snapshot.stripes} {t("belt.stripes")} · {active.student_snapshot.birth_date}</p>
   <h3 className="flex items-center gap-2 font-semibold"><span className={`h-5 w-2 ${STRIPE_TONE[active.color]}`}/>{t(`stripe.${active.color}`)} — {FORM_TITLES[active.color][lang]}</h3>
   <Tag tone={active.status==="approved"?"green":"muted"}>{t(`forms.${active.status}`)}</Tag>
   <AnswerReview form={active}/>
   {active.review_note && <p className="text-sm">{active.review_note}</p>}
   {isAdmin && active.status==="pending" && <div className="space-y-3 border-t border-border pt-4">
    <Field label={t("forms.note")}><Input maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
    {!meetsMinimum(active.color,active.answers) && <p className="text-sm text-clay">{t("forms.minimum")}</p>}
    <div className="flex flex-wrap gap-3"><Button variant="accent" disabled={busy||!meetsMinimum(active.color,active.answers)} onClick={()=>decide(true)}><Check className="size-4"/>{t("forms.approve")}</Button><Button variant="outline" disabled={busy} onClick={()=>decide(false)}><X className="size-4"/>{t("forms.reject")}</Button></div>
   </div>}
  </section> : <section className="space-y-3">
   <SectionTitle>{t("forms.history")}</SectionTitle>
   <div className="flex flex-wrap gap-2">{(["pending","approved","rejected"] as const).map(status=><Button key={status} size="sm" variant={tab===status?"accent":"outline"} onClick={()=>setTab(status)}>{t(`forms.${status}`)} ({forms.filter(f=>f.status===status).length})</Button>)}</div>
   {!forms.some(f=>f.status===tab) && <Empty label={t("forms.empty")}/>}
   {forms.filter(f=>f.status===tab).map(f=><article key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
    <span className={`h-10 w-2 shrink-0 ${STRIPE_TONE[f.color]}`}/><div className="min-w-0 flex-1"><p className="break-words font-semibold">{f.student_snapshot.full_name}</p><p className="text-xs text-muted-foreground">{t(`stripe.${f.color}`)} · {new Date(f.submitted_at).toLocaleDateString(lang)}</p></div>
    <Button variant="outline" onClick={()=>{setActive(f);setAdding(false);setError("");}}>{t("forms.review")}</Button>
   </article>)}
  </section>}
 </div>;
}

function ParentForm({childrenList,onDone}:{childrenList:{id:string;full_name:string;belt:string;stripes:number;birth_date:string|null}[];onDone:()=>Promise<void>}) {
 const {t,lang}=useI18n(); const [student,setStudent]=useState(childrenList[0]?.id??"");const [color,setColor]=useState<FormColor>("red");
 const [answers,setAnswers]=useState<Record<string,unknown>>({parent_name:""});const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const selected=childrenList.find(s=>s.id===student);
 function scoreAt(key:string,index:number,value:string) {const values=[...(Array.isArray(answers[key])?answers[key]:[])];values[index]=value===""?undefined:Number(value);setAnswers({...answers,[key]:values});}
 async function send(e:React.FormEvent) {e.preventDefault();setBusy(true);setError("");try{await submitStripe(student,color,answers);await onDone();}catch{setError(t("forms.error"));}finally{setBusy(false);}}
 return <form onSubmit={send} className="space-y-5 border-y border-border py-5">
  <Field label={t("forms.student")}><Select value={student} onChange={e=>setStudent(e.target.value)}>{childrenList.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</Select></Field>
  {selected && <p className="text-sm text-muted-foreground">{t(`belt.${selected.belt}`)} · {selected.stripes} {t("belt.stripes")} · {selected.birth_date}</p>}
  <div className="flex flex-wrap gap-2">{FORM_COLORS.map(c=><Button type="button" key={c} variant={c===color?"accent":"outline"} onClick={()=>{setColor(c);setAnswers({parent_name:answers["parent_name"]??""});setError("");}}><span className={`h-4 w-2 ${STRIPE_TONE[c]}`}/>{t(`stripe.${c}`)}</Button>)}</div>
  <h3 className="font-semibold">{FORM_TITLES[color][lang]}</h3>
  <Field label={t("forms.parentName")}><Input required maxLength={100} value={String(answers["parent_name"]??"")} onChange={e=>setAnswers({...answers,parent_name:e.target.value})}/></Field>
  <fieldset className="space-y-3"><legend className="mb-3 font-semibold">{t("forms.parent")}</legend>{PARENT_QUESTIONS[color].map((q,i)=><Field key={q.en} label={q[lang]}>{color==="green"?<Select required value={String((answers["habits"] as (boolean|undefined)[]|undefined)?.[i]??"")} onChange={e=>{const values=[...((answers["habits"] as boolean[])??[])];values[i]=e.target.value==="true";setAnswers({...answers,habits:values});}}><option value="">—</option><option value="true">{t("forms.yes")}</option><option value="false">{t("forms.no")}</option></Select>:<Input aria-label={q[lang]} type="number" required min={0} max={10} step={1} value={(answers["parent_scores"] as number[]|undefined)?.[i]??""} onChange={e=>scoreAt("parent_scores",i,e.target.value)}/>}</Field>)}</fieldset>
  {color!=="green" && <p className="font-mono text-sm">{t("forms.points")}: {((answers["parent_scores"] as number[])??[]).reduce((a,b)=>a+(b??0),0)}/{color==="red"?30:55}</p>}
  {color==="red" && <fieldset className="space-y-3"><legend className="mb-3 font-semibold">{t("forms.school")}</legend><p className="text-xs text-muted-foreground">{t("forms.teacherSource")}</p>{TEACHER_QUESTIONS.map((q,i)=><Field key={q.en} label={q[lang]}><Input type="number" required min={0} max={10} step={1} value={(answers["teacher_scores"] as number[]|undefined)?.[i]??""} onChange={e=>scoreAt("teacher_scores",i,e.target.value)}/></Field>)}<p className="font-mono text-sm">{t("forms.points")}: {((answers["teacher_scores"] as number[])??[]).reduce((a,b)=>a+(b??0),0)}/35</p><Field label={t("forms.teacherName")}><Input required maxLength={100} value={String(answers["teacher_name"]??"")} onChange={e=>setAnswers({...answers,teacher_name:e.target.value})}/></Field><Field label={t("forms.teacherDate")}><Input required type="date" value={String(answers["teacher_date"]??"")} onChange={e=>setAnswers({...answers,teacher_date:e.target.value})}/></Field></fieldset>}
  {color==="green" && <fieldset className="space-y-3"><legend className="mb-3 font-semibold">{t("forms.foods")}</legend>{Array.from({length:5},(_,i)=>{const food=(answers["foods"] as {description:string;date:string}[]|undefined)?.[i];function update(key:string,value:string){const foods=[...((answers["foods"] as {description:string;date:string}[])??[])];foods[i]={description:"",date:"",...foods[i],[key]:value};setAnswers({...answers,foods});}return <div className="grid gap-2 sm:grid-cols-2" key={i}><Field label={`${t("forms.food")} ${i+1}`}><Input required maxLength={200} value={food?.description??""} onChange={e=>update("description",e.target.value)}/></Field><Field label={`${t("forms.date")} ${i+1}`}><Input required type="date" value={food?.date??""} onChange={e=>update("date",e.target.value)}/></Field></div>;})}</fieldset>}
  {error && <p role="alert" className="text-sm text-clay">{error}</p>}
  <Button type="submit" variant="accent" disabled={busy}><Send className="size-4"/>{busy?t("forms.loading"):t("forms.send")}</Button>
 </form>;
}

function AnswerReview({form}:{form:Submission}) {
 const {t,lang}=useI18n();const a=form.answers;
 return <div className="space-y-4 text-sm"><p>{t("forms.parentName")}: <strong>{a.parent_name}</strong></p><h4 className="font-semibold">{t("forms.parent")}</h4><dl className="divide-y divide-border">{PARENT_QUESTIONS[form.color].map((q,i)=><div className="flex justify-between gap-4 py-3" key={q.en}><dt>{q[lang]}</dt><dd className="shrink-0 font-mono">{form.color==="green"?t(a.habits?.[i]?"forms.yes":"forms.no"):`${a.parent_scores?.[i]}/10`}</dd></div>)}</dl>
 {form.color!=="green" && <p>{t("forms.points")}: {(a.parent_scores??[]).reduce((x,y)=>x+y,0)}/{form.color==="red"?30:55}</p>}
 {form.color==="red" && <><h4 className="font-semibold">{t("forms.school")}</h4><p>{t("forms.teacherSource")}: {a.teacher_name} · {a.teacher_date}</p><dl className="divide-y divide-border">{TEACHER_QUESTIONS.map((q,i)=><div key={q.en} className="flex justify-between gap-4 py-3"><dt>{q[lang]}</dt><dd className="shrink-0 font-mono">{a.teacher_scores?.[i]}/10</dd></div>)}</dl><p>{t("forms.points")}: {(a.teacher_scores??[]).reduce((x,y)=>x+y,0)}/35</p></>}
 {form.color==="green" && <><h4 className="font-semibold">{t("forms.foods")}</h4>{a.foods?.map((food,i)=><p key={i}>{i+1}. {food.description} · {food.date}</p>)}</>}
 </div>;
}