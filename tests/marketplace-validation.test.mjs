import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minorUnits,
  colomboInstant,
  colomboInput,
  readOpportunityForm,
  opportunityInput,
  applicationInput,
} from "../src/lib/marketplace.ts";

test("LKR decimal parsing is exact and rejects rounding, exponent and unsupported amounts", () => {
  assert.equal(minorUnits("100.01"), 10001);
  assert.equal(minorUnits("0.29"), 29);
  assert.equal(minorUnits("10.1"), 1010);
  for (const value of [
    "0",
    "-1",
    "1e3",
    "1.001",
    "1,000",
    "Infinity",
    "1000000000.01",
  ])
    assert.equal(minorUnits(value), null);
});
test("deadline conversion uses Sri Lanka rather than runtime timezone and rejects normalized invalid dates", () => {
  assert.equal(colomboInstant("2026-12-01T09:00"), "2026-12-01T03:30:00.000Z");
  assert.equal(colomboInput("2026-12-01T03:30:00.000Z"), "2026-12-01T09:00");
  for (const value of [
    "2026-02-30T09:00",
    "2026-12-01T25:00",
    "2026-12-01T09:00Z",
    "",
  ])
    assert.equal(colomboInstant(value), null);
});
test("posted role/owner/currency are ignored and blank visible deliverables retain their positions", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: "A clear brief",
    brief: "A sufficiently detailed synthetic promotion brief.",
    category: "Other",
    budget: "100.01",
    application_deadline: "2026-12-01T09:00",
    delivery_deadline: "2026-12-10T09:00",
    revision_allowance: "1",
    role: "admin",
    brand_id: "victim",
    currency: "USD",
  }))
    form.set(key, value);
  form.append("platforms", "Instagram");
  for (let i = 0; i < 3; i++) {
    form.set(`deliverables.${i}.format`, i === 1 ? "" : "Reel");
    form.set(`deliverables.${i}.quantity`, "1");
    form.set(
      `deliverables.${i}.acceptance`,
      i === 1 ? "" : "A clear product introduction",
    );
  }
  const values = readOpportunityForm(form);
  assert.equal("role" in values, false);
  assert.equal("brand_id" in values, false);
  assert.equal("currency" in values, false);
  const parsed = opportunityInput.safeParse(values);
  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error.issues.some(
      (i) => i.path.join(".") === "deliverables.1.format",
    ),
  );
  assert.equal(values.deliverables[2].format, "Reel");
});
test("application payload trims URLs and rejects credentials or active schemes", () => {
  const proposal = "I can deliver a clear product introduction.";
  assert.equal(
    applicationInput.parse({
      proposal,
      work_urls: [" https://example.com/work "],
    }).work_urls[0],
    "https://example.com/work",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "data:text/html,hello",
  ])
    assert.equal(
      applicationInput.safeParse({ proposal, work_urls: [url] }).success,
      false,
    );
});
