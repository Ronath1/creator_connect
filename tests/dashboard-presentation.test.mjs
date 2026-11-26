import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationDashboardLink,
  collaborationDashboardLink,
  opportunityDashboardLink,
} from "../src/lib/dashboard.ts";

test("only an unrestricted draft offers editing; published/restricted records are view-only", () => {
  assert.deepEqual(
    opportunityDashboardLink({ id: "brief", status: "draft", hidden_at: null }),
    { href: "/my-opportunities/brief/edit", label: "Continue draft" },
  );
  for (const state of [
    { status: "draft", hidden_at: "restricted" },
    { status: "open", hidden_at: null },
    { status: "closed", hidden_at: null },
  ])
    assert.deepEqual(opportunityDashboardLink({ id: "brief", ...state }), {
      href: "/opportunities/brief",
      label: "View opportunity",
    });
});
test("application history remains view-only and selection does not assert agreement status", () => {
  for (const status of [
    "pending",
    "rejected",
    "withdrawn",
    "not_selected",
    "match_ended",
  ])
    assert.deepEqual(
      applicationDashboardLink({
        opportunity_id: "brief",
        status,
        opportunity: { hidden_at: null },
      }),
      { href: "/opportunities/brief", label: "View opportunity" },
    );
  assert.deepEqual(
    applicationDashboardLink({
      opportunity_id: "brief",
      status: "selected",
      opportunity: { hidden_at: null },
    }),
    { href: "/collaborations", label: "View collaborations" },
  );
  assert.deepEqual(
    applicationDashboardLink({
      opportunity_id: "brief",
      status: "rejected",
      opportunity: { hidden_at: "restricted" },
    }),
    { href: "/applications", label: "View application history" },
  );
  assert.equal(
    applicationDashboardLink({ opportunity_id: "brief", status: "withdrawn" })
      .href,
    "/applications",
  );
});
test("collaboration links match each role's stage without asking for terminal actions", () => {
  for (const role of ["brand", "influencer"]) {
    assert.deepEqual(
      collaborationDashboardLink(
        { id: "work", status: "pending_agreement" },
        role,
      ),
      { href: "/collaborations/work", label: "Review agreement" },
    );
    for (const status of [
      "completed",
      "declined",
      "expired",
      "cancelled",
      "future_status",
    ])
      assert.deepEqual(
        collaborationDashboardLink({ id: "work", status }, role),
        { href: "/collaborations/work", label: "View collaboration record" },
      );
  }
  assert.deepEqual(
    collaborationDashboardLink({ id: "work", status: "submitted" }, "brand"),
    { href: "/collaborations/work?tab=deliveries", label: "Review submission" },
  );
  assert.equal(
    collaborationDashboardLink(
      { id: "work", status: "submitted" },
      "influencer",
    ).label,
    "View submitted work",
  );
  assert.equal(
    collaborationDashboardLink(
      { id: "work", status: "revision_requested" },
      "influencer",
    ).label,
    "View revision feedback",
  );
  assert.equal(
    collaborationDashboardLink(
      { id: "work", status: "revision_requested" },
      "brand",
    ).label,
    "View revision record",
  );
  assert.equal(
    collaborationDashboardLink({ id: "work", status: "active" }, "influencer")
      .label,
    "View delivery checklist",
  );
  assert.equal(
    collaborationDashboardLink({ id: "work", status: "active" }, "brand").label,
    "Open workspace",
  );
});
