import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { NotificationLink } from "@/components/notification-link";
import { IntegrationUnavailable } from "@/components/integration-unavailable";
import { getIntegrationConfig } from "@/server/config";
import { requireMember } from "@/server/services/membership";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getIntegrationConfig()) return <IntegrationUnavailable />;
  const { member } = await requireMember();
  const role =
    member.role === "influencer"
      ? "Creator"
      : member.role === "brand"
        ? "Brand"
        : "Administrator";
  return (
    <main id="main-content" className="container member-workspace">
      <header className="member-heading">
        <div>
          <span className="eyebrow">YOUR PRIVATE PILOT WORKSPACE</span>
          <p>{role} account</p>
        </div>
        <AccountMenu />
      </header>
      <nav aria-label="Member navigation" className="member-nav">
        <Link href="/dashboard">Dashboard</Link>
        {member.role !== "admin" ? (
          <Link href="/profile">Your profile</Link>
        ) : null}
        <Link href="/opportunities">Discover opportunities</Link>
        {member.role === "brand" ? (
          <Link href="/my-opportunities">My opportunities</Link>
        ) : null}
        {member.role === "influencer" ? (
          <Link href="/applications">My applications</Link>
        ) : null}
        {member.role !== "admin" ? (
          <Link href="/collaborations">Collaborations</Link>
        ) : (
          <Link href="/admin">Pilot support</Link>
        )}
        <NotificationLink />
        {member.role !== "admin" ? (
          <Link href="/reports">Your reports</Link>
        ) : null}
        <Link href="/">Introduction</Link>
      </nav>
      <div className="member-content">{children}</div>
    </main>
  );
}
