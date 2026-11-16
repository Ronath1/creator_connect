import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readCollaborationForm } from "../src/lib/collaboration.ts";

test("ten-item reviews retain every selected deliverable and keep an overflow sentinel", () => {
  const form = new FormData(),
    items = Array.from({ length: 10 }, () => randomUUID());
  for (const id of items) form.append("selected_items", id);
  assert.deepEqual(readCollaborationForm(form).multi.selected_items, items);
  form.append("selected_items", randomUUID());
  form.append("selected_items", randomUUID());
  assert.equal(readCollaborationForm(form).multi.selected_items.length, 11);
});
test("visible blank deliverables preserve their indexes rather than shifting later evidence", () => {
  const form = new FormData();
  for (let i = 0; i < 3; i++) {
    form.set(`format.${i}`, i === 1 ? "" : "Reel");
    form.set(`quantity.${i}`, "1");
    form.set(`acceptance.${i}`, i === 1 ? "" : "A clear introduction.");
  }
  const { values } = readCollaborationForm(form);
  assert.equal(values["format.1"], "");
  assert.equal(values["format.2"], "Reel");
});
test("posted fields and arrays remain bounded, with oversize evidence rejected by the server sentinel", () => {
  const form = new FormData();
  form.set("body", "x".repeat(7000));
  form.set("untrusted_blob", "never retain this");
  for (let i = 0; i < 9; i++) form.append("files", randomUUID());
  const data = readCollaborationForm(form);
  assert.equal(data.values.body.length, 6001);
  assert.equal(data.values.untrusted_blob, undefined);
  assert.equal(data.multi.files.length, 6);
});
