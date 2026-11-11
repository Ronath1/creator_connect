import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { IntegrationUnavailable } from "@/components/integration-unavailable";
import { getIntegrationConfig } from "@/server/config";
import { clerkAppearance } from "@/lib/clerk-appearance";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  if (!getIntegrationConfig()) return <IntegrationUnavailable />;
  if ((await auth()).userId) redirect("/dashboard");
  return (
    <main id="main-content" className="container auth-page">
      <div>
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Good to see you.</h1>
        <p>
          Sign in to your account. Marketplace access is reserved for approved
          pilot members.
        </p>
      </div>
      <SignIn
        appearance={clerkAppearance}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
