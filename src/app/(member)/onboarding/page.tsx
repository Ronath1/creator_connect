import { redirect } from "next/navigation";
import { getOwnProfile } from "@/server/services/profile";
import { getIntegrationConfig } from "@/server/config";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  if (!getIntegrationConfig()) return null; // Layout supplies the unavailable state.
  const { member, values } = await getOwnProfile();
  if (member.role === "admin") redirect("/dashboard");
  return (
    <>
      <span className="eyebrow">LET’S MAKE AN INTRODUCTION</span>
      <h1>Your story starts here.</h1>
      <p className="member-intro">
        Share a little about{" "}
        {member.role === "brand" ? "your brand" : "your creativity"}. You can
        return to finish or update these details.
      </p>
      <OnboardingForm role={member.role} initialValues={values} />
    </>
  );
}
