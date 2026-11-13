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
            : "Your administrator membership is active. Member-management and support screens are not available yet."}
      </p>
      <div className="dashboard-empty">
        <span className="eyebrow">A CLEAR START</span>
        <h2>
          {member.role === "admin"
            ? "Support tools are on the way."
            : "You’re ready for the next step."}
        </h2>
        <p>
          {member.role === "admin"
            ? "Member-management tools are not available yet. Please contact the pilot owner to arrange access changes."
            : "Open your marketplace to see the latest opportunities and application statuses. Agreement confirmation and delivery tools are being prepared."}
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
      </div>
      <div className="notice">
        <strong>Payments are not enabled</strong>
        <p>No funds are collected, held, or paid through the pilot.</p>
      </div>
    </>
  );
}
