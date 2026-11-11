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
          ? "Your brand profile is saved. Opportunity publishing and applications are being prepared."
          : member.role === "influencer"
            ? "Your creator profile is saved. Opportunity discovery and applications are being prepared."
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
            : "There are no marketplace activities to display yet. We’ll keep your profile ready while the rest of the pilot is built."}
        </p>
        {member.role !== "admin" ? (
          <Link className="action action-secondary" href="/profile">
            Review your profile
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
