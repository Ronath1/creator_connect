"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  brandOnboarding,
  influencerOnboarding,
  readOnboardingForm,
  type OnboardingState,
} from "@/lib/onboarding";
import { requireMember } from "@/server/services/membership";

export async function saveOnboarding(
  _previous: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const values = readOnboardingForm(form);
  let context;
  try {
    context = await requireMember();
  } catch (error) {
    unstable_rethrow(error);
    return {
      values,
      errors: {},
      message:
        "We couldn’t check your account access. Please try again when your connection is ready.",
    };
  }
  const { member, client } = context;
  if (member.role === "admin") redirect("/dashboard");
  const result = (
    member.role === "brand" ? brandOnboarding : influencerOnboarding
  ).safeParse(values);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues)
      errors[issue.path.join(".")] ??= issue.message;
    return {
      values,
      errors,
      message:
        "Please check the highlighted fields. Your profile has not been saved.",
    };
  }
  const common = {
    p_display_name: result.data.display_name,
    p_location: result.data.location,
    p_categories: result.data.categories,
  };
  let saveError = false;
  try {
    const { error } =
      member.role === "brand"
        ? await client.rpc("complete_brand_onboarding", {
            ...common,
            p_description: result.data.description,
            p_website: "website" in result.data ? result.data.website : "",
          })
        : await client.rpc("complete_influencer_onboarding", {
            ...common,
            p_bio: result.data.description,
            p_links: "links" in result.data ? result.data.links : [],
          });
    saveError = Boolean(error);
  } catch (error) {
    unstable_rethrow(error);
    saveError = true;
  }
  if (saveError)
    return {
      values,
      errors: {},
      message:
        "We couldn’t save your profile. Your access may have changed or the connection may be interrupted. Please try again.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}
