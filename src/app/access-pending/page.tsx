import { AccountMenu } from "@/components/account-menu";
import { redirect } from "next/navigation";
import { IntegrationUnavailable } from "@/components/integration-unavailable";
import { getIntegrationConfig } from "@/server/config";
import { ActionLink, Badge } from "@/components/ui";
import { loadMembership } from "@/server/services/membership";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pilot access",
  robots: { index: false, follow: false },
};

export default async function AccessPending() {
  if (!getIntegrationConfig()) return <IntegrationUnavailable />;
  const { member } = await loadMembership();
  if (member?.status === "active") redirect("/dashboard");
  if (member?.status === "suspended") redirect("/access-restricted");
  return (
    <main id="main-content" className="container unavailable">
      <Badge>Pilot membership required</Badge>
      <h1>
        Your account is ready.
        <br />
        Your invitation comes next.
      </h1>
      <p>
        You’re signed in, but this account has not been approved for the private
        pilot. The pilot team will arrange your access and role directly.
      </p>
      <div className="account-help">
        <AccountMenu />
        <span>Use your account menu to sign out or switch accounts.</span>
      </div>
      <ActionLink href="/">Back to the introduction</ActionLink>
    </main>
  );
}
