import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createUserSupabaseClient } from "@/server/supabase";
import { getIntegrationConfig } from "@/server/config";
import { AppError } from "@/server/errors";

export type Membership = {
  id: string;
  clerk_user_id: string;
  role: "brand" | "influencer" | "admin";
  status: "active" | "suspended";
};

export const loadMembership = cache(async () => {
  if (!getIntegrationConfig())
    throw new AppError(
      "UNAVAILABLE",
      "Account access is unavailable. Please try again later.",
    );
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const client = await createUserSupabaseClient();
  const { data, error } = await client
    .from("app_users")
    .select("id,clerk_user_id,role,status")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error)
    throw new AppError(
      "UNAVAILABLE",
      "We couldn’t check your pilot access. Please try again.",
    );
  if (!data) return { member: null, client };
  if (
    data.role !== "brand" &&
    data.role !== "influencer" &&
    data.role !== "admin"
  )
    throw new AppError("UNAVAILABLE", "Pilot access could not be verified.");
  if (data.status !== "active" && data.status !== "suspended")
    throw new AppError("UNAVAILABLE", "Pilot access could not be verified.");
  const member: Membership = { ...data, role: data.role, status: data.status };
  return { member, client };
});

export const requireMember = cache(async () => {
  const { member, client } = await loadMembership();
  if (!member) redirect("/access-pending");
  if (member.status === "suspended") redirect("/access-restricted");
  return { member, client };
});
