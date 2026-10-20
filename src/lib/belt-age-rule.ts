/**
 * Age-based class requirements per stripe (Desirèe's rules, 19–20/10/2026):
 * - White belt under 16: 15 classes per stripe (grey keeps the under-15 rule).
 * - Grey belt under 15: 15 classes per stripe.
 * Returns null when the student does not match, so the belt_requirements table applies.
 */
export function under16StripeClasses(student: { belt: string; birth_date: string | null }, today = new Date()): number | null {
  if (!student.birth_date) return null;
  const birth = new Date(`${student.birth_date}T00:00:00`);
  const cutoff = student.belt === "white" ? 16 : student.belt === "grey" ? 15 : null;
  if (cutoff === null) return null;
  const birthday = new Date(birth.getFullYear() + cutoff, birth.getMonth(), birth.getDate());
  return today < birthday ? 15 : null;
}
