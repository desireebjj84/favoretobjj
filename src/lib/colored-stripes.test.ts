import { test, expect } from "bun:test";
import { isUnder16, validStripeColors } from "./colored-stripes";
test("colored stripes are available before, but not on, the sixteenth birthday", () => {
  const student = { birth_date: "2010-10-20", is_minor: true };
  expect(isUnder16(student, new Date(2026, 9, 19))).toBe(true);
  expect(isUnder16(student, new Date(2026, 9, 20))).toBe(false);
});
test("accepts the four chosen colors in any order, including repeated colors", () => {
  expect(validStripeColors(["green", "red", "yellow", "blue", "red"])).toBe(true);
  expect(validStripeColors(["purple"])).toBe(false);
});