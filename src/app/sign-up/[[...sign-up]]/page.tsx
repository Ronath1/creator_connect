import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { IntegrationUnavailable } from "@/components/integration-unavailable";
import { getIntegrationConfig } from "@/server/config";
import { clerkAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export default async function SignUpPage() {
  if (!getIntegrationConfig()) return <IntegrationUnavailable />;
  if ((await auth()).userId) redirect("/dashboard");
  return (
    <main id="main-content" className="container auth-page">
      <div>
        <span className="eyebrow">A CONSIDERED BEGINNING</span>
        <h1>Start with your account.</h1>
        <p>
          Creating a sign-in account does not grant pilot membership. The pilot
          team approves your marketplace role separately.
        </p>
      </div>
      <SignUp
        appearance={clerkAppearance}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
