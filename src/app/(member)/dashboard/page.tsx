import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui";
import { getIntegrationConfig } from "@/server/config";
import { getOwnProfile } from "@/server/services/profile";

export const metadata = { title: "Your dashboard" };

export default async function DashboardPage() {
  if (!getIntegrationConfig()) return null;
  const { member, values, complete } = await getOwnProfile();
  if (!complete) redirect("/onboarding");
  return (
    <>
      <Badge>Private pilot</Badge>
      <h1>
        {values
          ? `Welcome, ${values.display_name}.`
          : "Pilot support starts here."}
      </h1>
      <p className="member-intro">
        {member.role === "brand"
          ? "Publish a clear opportunity, review applications and reserve your next collaboration."
          : member.role === "influencer"
            ? "Discover opportunities that fit your work and keep track of your applications."
            : "Review assigned cases, manage approved membership and record support interventions."}
      </p>
      <div className="dashboard-empty">
        <span className="eyebrow">A CLEAR START</span>
        <h2>
          {member.role === "admin"
            ? "Support with a clear record."
            : "You’re ready for the next step."}
        </h2>
        <p>
          {member.role === "admin"
            ? "Use the report queue for case-bound private access, membership controls for approved accounts, and audit history to review recorded actions."
            : "Open your opportunities or applications to discover work, then use Collaborations to confirm terms, discuss evidence and review delivery."}
        </p>
        {member.role !== "admin" ? (
          <Link
            className="action action-secondary"
            href={
              member.role === "brand" ? "/my-opportunities" : "/opportunities"
            }
          >
            {member.role === "brand"
              ? "Manage opportunities"
              : "Discover opportunities"}
          </Link>
        ) : null}
        {member.role === "admin" ? (
          <Link className="action action-primary" href="/admin">
            Open pilot support
          </Link>
        ) : (
          <Link className="action action-secondary" href="/collaborations">
            Your collaborations
          </Link>
        )}
      </div>
      <div className="notice">
        <strong>Payments are not enabled</strong>
        <p>No funds are collected, held, or paid through the pilot.</p>
      </div>
    </>
  );
}
