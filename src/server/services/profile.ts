import "server-only";
import { cache } from "react";
import { requireMember } from "./membership";
import { AppError } from "@/server/errors";
import {
  brandOnboarding,
  influencerOnboarding,
  platforms,
  type OnboardingValues,
} from "@/lib/onboarding";

export const getOwnProfile = cache(async () => {
  const { member, client } = await requireMember();
  if (member.role === "admin") return { member, values: null, complete: true };
  let values: OnboardingValues;
  if (member.role === "brand") {
    const { data, error } = await client
      .from("brand_profiles")
      .select("display_name,description,location,categories,website")
      .eq("user_id", member.id)
      .maybeSingle();
    if (error)
      throw new AppError(
        "UNAVAILABLE",
        "We couldn’t load your profile. Please try again.",
      );
    if (!data) return { member, values: null, complete: false };
    values = { ...data, website: data.website ?? "", links: [] };
  } else {
    const { data, error } = await client
      .from("influencer_profiles")
      .select("display_name,bio,location,categories")
      .eq("user_id", member.id)
      .maybeSingle();
    if (error)
      throw new AppError(
        "UNAVAILABLE",
        "We couldn’t load your profile. Please try again.",
      );
    if (!data) return { member, values: null, complete: false };
    const response = await client
      .from("social_links")
      .select("platform,url,follower_count,metrics_as_of")
      .eq("user_id", member.id)
      .order("platform")
      .limit(5);
    if (response.error)
      throw new AppError(
        "UNAVAILABLE",
        "We couldn’t load your social profiles. Please try again.",
      );
    const links = response.data.map((link) => {
      const platform = platforms.find(
        (candidate) => candidate === link.platform,
      );
      if (!platform)
        throw new AppError(
          "UNAVAILABLE",
          "We couldn’t load your social profiles. Please try again.",
        );
      return { ...link, platform };
    });
    values = {
      display_name: data.display_name,
      description: data.bio,
      location: data.location,
      categories: data.categories,
      website: "",
      links,
    };
  }
  const valid = (
    member.role === "brand" ? brandOnboarding : influencerOnboarding
  ).safeParse(values).success;
  return { member, values, complete: valid };
});
