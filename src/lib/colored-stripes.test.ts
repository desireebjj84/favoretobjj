import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isUnder16, validStripeColors } from "./colored-stripes";
test("colored stripes are available before, but not on, the sixteenth birthday", () => {
  const student = { birth_date: "2010-10-20", is_minor: true };
  assert.equal(isUnder16(student, new Date(2026, 9, 19)), true);
  assert.equal(isUnder16(student, new Date(2026, 9, 20)), false);
});
test("accepts the four chosen colors in any order, including repeated colors", () => {
  assert.equal(validStripeColors(["green", "red", "yellow", "blue", "red"]), true);
  assert.equal(validStripeColors(["purple"]), false);
});