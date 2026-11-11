import { AccountMenu } from "@/components/account-menu";
import { redirect } from "next/navigation";
import { IntegrationUnavailable } from "@/components/integration-unavailable";
import { getIntegrationConfig } from "@/server/config";
import { ActionLink, Badge } from "@/components/ui";
import { loadMembership } from "@/server/services/membership";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Access restricted",
  robots: { index: false, follow: false },
};

export default async function AccessRestricted() {
  if (!getIntegrationConfig()) return <IntegrationUnavailable />;
  const { member } = await loadMembership();
  if (!member) redirect("/access-pending");
  if (member.status === "active") redirect("/dashboard");
  return (
    <main id="main-content" className="container unavailable">
      <Badge>Access restricted</Badge>
      <h1>Let’s check your access.</h1>
      <p>
        Your pilot access is currently restricted. Please contact the pilot team
        through the contact they provided for help.
      </p>
      <div className="account-help">
        <AccountMenu />
        <span>Your account menu remains available so you can sign out.</span>
      </div>
      <ActionLink href="/">Back to the introduction</ActionLink>
    </main>
  );
}
