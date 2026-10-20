import { z } from "zod";
import type { Lang } from "./i18n";

export const FORM_COLORS = ["red", "yellow", "green"] as const;
export type FormColor = typeof FORM_COLORS[number];
type Text = Record<Lang, string>;
const text = (en: string, pt: string, es: string): Text => ({ en, pt, es });
export const FORM_TITLES = {
  red: text("Academic behavior and effort", "Comportamento e dedicação escolar", "Comportamiento y esfuerzo escolar"),
  yellow: text("Social conduct", "Conduta social", "Conducta social"),
  green: text("Good habits", "Bons hábitos", "Buenos hábitos"),
};
export const PARENT_QUESTIONS = {
  red: [text("Focused on tasks until completion", "Concentra-se na tarefa até terminar", "Se concentra hasta terminar la tarea"), text("Focused on learning something new", "Dedica-se a aprender algo novo", "Se dedica a aprender algo nuevo"), text("Walks with good posture", "Caminha com boa postura", "Camina con buena postura"), text("Reads or listens to a book for 20 minutes", "Lê ou escuta um livro por 20 minutos", "Lee o escucha un libro por 20 minutos")],
  yellow: [text("Cleans own room", "Arruma o próprio quarto", "Ordena su habitación"), text("Puts toys away after playing", "Guarda os brinquedos após brincar", "Guarda los juguetes después de jugar"), text("Respects parents' decisions", "Respeita as decisões dos pais", "Respeta las decisiones de sus padres"), text("Politeness (please, thank you)", "É educado (por favor, obrigado)", "Es cortés (por favor, gracias)"), text("Kindness to others", "É gentil com os outros", "Es amable con los demás"), text("Shares toys with friends", "Compartilha brinquedos com amigos", "Comparte juguetes con amigos"), text("Respects siblings and friends", "Respeita irmãos e amigos", "Respeta a sus hermanos y amigos"), text("Joins family activities", "Participa das atividades em família", "Participa en actividades familiares")],
  green: [text("Participates in beach/park cleanup", "Participa de limpeza de praia/parque", "Participa en limpieza de playa/parque"), text("Helps maintain school/home garden (if applicable)", "Ajuda a cuidar do jardim de casa/escola (se aplicável)", "Ayuda con el jardín de casa/escuela (si aplica)"), text("Helps care for the family pet (if applicable)", "Ajuda a cuidar do animal da família (se aplicável)", "Ayuda a cuidar la mascota (si aplica)"), text("Personal hygiene without complaining", "Cuida da higiene pessoal sem reclamar", "Cuida su higiene personal sin quejarse"), text("Reads or listens to a book for 20 minutes", "Lê ou escuta um livro por 20 minutos", "Lee o escucha un libro por 20 minutos"), text("Visits doctors and dentist as advised by parents", "Vai ao médico e dentista conforme orientação dos pais", "Visita al médico y dentista según sus padres")],
};
export const TEACHER_QUESTIONS = [text("Returns homework on time", "Entrega tarefas no prazo", "Entrega tareas a tiempo"), text("Takes care of school equipment", "Cuida dos equipamentos da escola", "Cuida los materiales escolares"), text("Collaborates with classmates", "Colabora com os colegas nas tarefas", "Colabora con sus compañeros"), text("Good behavior in class", "Bom comportamento na aula", "Buen comportamiento en clase"), text("Good attitude toward teachers and classmates", "Boa atitude com professores e colegas", "Buena actitud con profesores y compañeros")];
const score = z.number().int().min(0).max(10);
const name = z.string().trim().min(1).max(100);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
export const ANSWER_SCHEMAS = {
  red: z.object({ parent_name: name, parent_scores: z.array(score).length(4), teacher_scores: z.array(score).length(5), teacher_name: name, teacher_date: date }),
  yellow: z.object({ parent_name: name, parent_scores: z.array(score).length(8) }),
  green: z.object({ parent_name: name, habits: z.array(z.boolean()).length(6), foods: z.array(z.object({ description: z.string().trim().min(1).max(200), date })).length(5) }),
};
export type FormAnswers = { parent_name: string; parent_scores?: number[]; teacher_scores?: number[]; teacher_name?: string; teacher_date?: string; habits?: boolean[]; foods?: { description: string; date: string }[] };
export function meetsMinimum(color: FormColor, a: FormAnswers) {
  const sum = (values?: number[]) => (values ?? []).reduce((total, n) => total + n, 0);
  return color === "green" || (color === "red" ? sum(a.parent_scores) >= 30 && sum(a.teacher_scores) >= 35 : sum(a.parent_scores) >= 55);
}