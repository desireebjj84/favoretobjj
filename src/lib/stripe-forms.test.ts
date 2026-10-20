import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ANSWER_SCHEMAS, meetsMinimum } from "./stripe-forms";
test("red needs 30 parent and 35 school points", () => {
  assert.equal(meetsMinimum("red", {parent_name:"Parent",parent_scores:[10,10,10,0],teacher_scores:[10,10,10,5,0]}), true);
  assert.equal(meetsMinimum("red", {parent_name:"Parent",parent_scores:[10,10,9,0],teacher_scores:[10,10,10,5,0]}), false);
  assert.equal(meetsMinimum("red", {parent_name:"Parent",parent_scores:[10,10,10,0],teacher_scores:[10,10,10,4,0]}), false);
});
test("yellow needs 55 points", () => {
  assert.equal(meetsMinimum("yellow", {parent_name:"Parent",parent_scores:[10,10,10,10,10,5,0,0]}), true);
  assert.equal(meetsMinimum("yellow", {parent_name:"Parent",parent_scores:[10,10,10,10,10,4,0,0]}), false);
});
test("scores are whole numbers from zero to ten", () => {
  assert.equal(ANSWER_SCHEMAS.yellow.safeParse({parent_name:"Parent",parent_scores:[11,0,0,0,0,0,0,0]}).success, false);
  assert.equal(ANSWER_SCHEMAS.yellow.safeParse({parent_name:"Parent",parent_scores:[0,1,2,3,4,5,6,10]}).success, true);
});
test("green requires six answers and five dated food entries", () => {
  assert.equal(ANSWER_SCHEMAS.green.safeParse({parent_name:"Parent",habits:[true,false,true,true,true,true],foods:Array.from({length:5},()=>({description:"Fruit",date:"2026-10-20"}))}).success,true);
  assert.equal(ANSWER_SCHEMAS.green.safeParse({parent_name:"Parent",habits:[true],foods:[]}).success,false);
});