import { test } from "node:test";
import { strict as assert } from "node:assert";
import { under16StripeClasses } from "./belt-age-rule";

// Desirèe's rule (20/10/2026): white belt under 16 needs 15 classes per stripe.
test("white under 16 needs exactly 15 classes", () =>
  assert.equal(under16StripeClasses({ belt: "white", birth_date: "2011-10-21" }, new Date(2026, 9, 20)), 15));
// Grey keeps its earlier rule: under 15 needs 15 classes per stripe.
test("grey under 15 needs exactly 15 classes", () =>
  assert.equal(under16StripeClasses({ belt: "grey", birth_date: "2012-10-20" }, new Date(2026, 9, 20)), 15));
// The white-belt rule stops on the sixteenth birthday.
test("the white rule stops on the sixteenth birthday", () =>
  assert.equal(under16StripeClasses({ belt: "white", birth_date: "2010-10-20" }, new Date(2026, 9, 20)), null));
// The grey-belt rule stops on the fifteenth birthday.
test("the grey rule stops on the fifteenth birthday", () =>
  assert.equal(under16StripeClasses({ belt: "grey", birth_date: "2011-10-20" }, new Date(2026, 9, 20)), null));
// Other belts retain their requirement.
test("other belts retain their requirement", () =>
  assert.equal(under16StripeClasses({ belt: "yellow", birth_date: "2012-10-20" }, new Date(2026, 9, 20)), null));
