export const STRIPE_COLORS = ["red", "blue", "yellow", "green"] as const;
export type StripeColor = (typeof STRIPE_COLORS)[number];
export const STRIPE_TONE: Record<StripeColor, string> = {
  red: "bg-stripe-red", blue: "bg-belt-blue", yellow: "bg-belt-yellow", green: "bg-belt-green",
};
export function isUnder16(student: { birth_date: string | null; is_minor: boolean }, today = new Date()): boolean {
  if (!student.birth_date) return student.is_minor;
  const [year, month, day] = student.birth_date.split("-").map(Number);
  if (!year || !month || !day) return false;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age < 16;
}
export function validStripeColors(colors: string[]): colors is StripeColor[] {
  return colors.every((color) => STRIPE_COLORS.some((allowed) => allowed === color));
}