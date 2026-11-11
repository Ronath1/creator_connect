import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brandOnboarding,
  influencerOnboarding,
  readOnboardingForm,
} from "../src/lib/onboarding.ts";

function form() {
  const data = new FormData();
  data.set("display_name", "Test creator");
  data.set(
    "description",
    "An isolated synthetic profile for validation tests.",
  );
  data.set("location", "Colombo");
  data.append("categories", "Other");
  return data;
}

test("untrusted membership fields are excluded and extra schema keys stripped", () => {
  const data = form();
  data.set("role", "admin");
  data.set("user_id", "victim");
  data.set("status", "active");
  const values = readOnboardingForm(data);
  assert.equal("role" in values, false);
  assert.equal("user_id" in values, false);
  assert.equal("status" in values, false);
  assert.equal(
    "role" in brandOnboarding.parse({ ...values, role: "admin" }),
    false,
  );
});

test("parsed RPC payload normalizes whitespace without changing the preserved form", () => {
  const data = form();
  data.set("platform_0", "Instagram");
  data.set("url_0", "  https://instagram.com/synthetic_test  ");
  const values = readOnboardingForm(data);
  const parsed = influencerOnboarding.parse(values);
  assert.equal(parsed.links[0].url, "https://instagram.com/synthetic_test");
  assert.ok(values.links[0].url.startsWith("  "));
});

test("blank visible middle rows retain their validation and retry indexes", () => {
  const data = form();
  data.set("platform_0", "Instagram");
  data.set("url_0", "https://instagram.com/synthetic_test");
  data.set("platform_1", "YouTube");
  data.set("url_1", "");
  data.set("platform_2", "X");
  data.set("url_2", "https://x.com/synthetic_test");
  const values = readOnboardingForm(data);
  assert.equal(values.links.length, 3);
  assert.equal(values.links[1].url, "");
  const parsed = influencerOnboarding.safeParse(values);
  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error.issues.some((issue) => issue.path.join(".") === "links.1.url"),
  );
  assert.equal(values.links[2].platform, "X");
});

test("creator profiles require a platform URL and resist dangerous/mismatched URLs", () => {
  assert.equal(
    influencerOnboarding.safeParse(readOnboardingForm(form())).success,
    false,
  );
  for (const url of [
    "javascript:alert(1)",
    "http://instagram.com/profile",
    "https://instagram.com.attacker.example/profile",
    "https://instagram.com@attacker.example/profile",
    "https://attacker.example/profile",
    "https://instagram.com/",
  ]) {
    const data = form();
    data.set("platform_0", "Instagram");
    data.set("url_0", url);
    assert.equal(
      influencerOnboarding.safeParse(readOnboardingForm(data)).success,
      false,
      url,
    );
  }
});

test("self-reported metrics require a real nonfuture date and nonnegative integer count", () => {
  for (const [count, date] of [
    ["10", ""],
    ["-1", "2026-01-01"],
    ["1.5", "2026-01-01"],
    ["1", "2026-02-30"],
    ["1", "2099-01-01"],
  ]) {
    const data = form();
    data.set("platform_0", "Instagram");
    data.set("url_0", "https://instagram.com/synthetic_test");
    data.set("count_0", count);
    data.set("date_0", date);
    assert.equal(
      influencerOnboarding.safeParse(readOnboardingForm(data)).success,
      false,
    );
  }
});

test("duplicate platforms and invalid category values are rejected", () => {
  const data = form();
  data.set("platform_0", "X");
  data.set("url_0", "https://x.com/synthetic_test");
  data.set("platform_1", "X");
  data.set("url_1", "https://x.com/other_test");
  assert.equal(
    influencerOnboarding.safeParse(readOnboardingForm(data)).success,
    false,
  );
  const invalidCategory = form();
  invalidCategory.set("categories", "admin");
  assert.equal(
    brandOnboarding.safeParse(readOnboardingForm(invalidCategory)).success,
    false,
  );
});
