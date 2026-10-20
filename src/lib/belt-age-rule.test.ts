import { test } from "node:test";
import { strict as assert } from "node:assert";
import { under15StripeClasses } from "./belt-age-rule";
test("white under 15 needs exactly 15 classes",()=>assert.equal(under15StripeClasses({belt:"white",birth_date:"2012-10-20"},new Date(2026,9,20)),15));
test("grey under 15 needs exactly 15 classes",()=>assert.equal(under15StripeClasses({belt:"grey",birth_date:"2012-10-20"},new Date(2026,9,20)),15));
test("the rule stops on the fifteenth birthday",()=>assert.equal(under15StripeClasses({belt:"grey",birth_date:"2011-10-20"},new Date(2026,9,20)),null));
test("other belts retain their requirement",()=>assert.equal(under15StripeClasses({belt:"yellow",birth_date:"2012-10-20"},new Date(2026,9,20)),null));