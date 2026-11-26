/** Presentation links only; authorization/lifecycle decisions remain in RPCs. */
export function opportunityDashboardLink(opportunity: {
  id: string;
  status: string;
  hidden_at: string | null;
}) {
  return opportunity.status === "draft" && !opportunity.hidden_at
    ? {
        href: `/my-opportunities/${opportunity.id}/edit`,
        label: "Continue draft",
      }
    : { href: `/opportunities/${opportunity.id}`, label: "View opportunity" };
}
export function applicationDashboardLink(application: {
  opportunity_id: string;
  status: string;
  opportunity?: { hidden_at: string | null };
}) {
  if (application.status === "selected")
    return { href: "/collaborations", label: "View collaborations" };
  if (!application.opportunity || application.opportunity.hidden_at)
    return { href: "/applications", label: "View application history" };
  return {
    href: `/opportunities/${application.opportunity_id}`,
    label: "View opportunity",
  };
}
export function collaborationDashboardLink(
  collaboration: { id: string; status: string },
  role: "brand" | "influencer",
) {
  const href = `/collaborations/${collaboration.id}`;
  if (collaboration.status === "pending_agreement")
    return { href, label: "Review agreement" };
  if (collaboration.status === "submitted")
    return {
      href: `${href}?tab=deliveries`,
      label: role === "brand" ? "Review submission" : "View submitted work",
    };
  if (collaboration.status === "revision_requested")
    return {
      href: `${href}?tab=deliveries`,
      label:
        role === "influencer"
          ? "View revision feedback"
          : "View revision record",
    };
  if (collaboration.status === "active")
    return role === "influencer"
      ? { href: `${href}?tab=deliveries`, label: "View delivery checklist" }
      : { href, label: "Open workspace" };
  return { href, label: "View collaboration record" };
}
