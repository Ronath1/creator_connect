import "server-only";
import { z } from "zod";
import { redirect } from "next/navigation";
import { getOwnProfile } from "./profile";
import { requireMember } from "./membership";
import { AppError } from "@/server/errors";
import {
  applicationRecord,
  detailRecord,
  memberProfile,
  opportunityRecord,
  uuid,
} from "@/lib/marketplace";
import type { Json } from "@/lib/database.types";

export async function marketplaceContext() {
  const profile = await getOwnProfile();
  if (!profile.complete) redirect("/onboarding");
  const { client } = await requireMember();
  return { ...profile, client };
}
function unavailable() {
  return new AppError(
    "UNAVAILABLE",
    "We couldn’t load the marketplace. Please try again.",
  );
}
export async function readMarketplace(
  kind: "discover" | "own" | "detail" | "applications",
  id?: string,
  filters: Record<string, string | number> = {},
) {
  const context = await marketplaceContext();
  if (kind === "own" && context.member.role !== "brand")
    redirect("/opportunities");
  if (kind === "applications" && context.member.role !== "influencer")
    redirect("/dashboard");
  if (id && !uuid.safeParse(id).success) return { ...context, data: null };
  const response = await context.client
    .rpc("marketplace_read", {
      p_kind: kind,
      ...(id ? { p_id: id } : {}),
      p_filters: filters,
    })
    .abortSignal(AbortSignal.timeout(15_000));
  if (response.error) throw unavailable();
  if (response.data === null) return { ...context, data: null };
  const schema =
    kind === "detail"
      ? detailRecord
      : kind === "applications"
        ? z.object({ items: z.array(applicationRecord), total: z.number() })
        : z.object({ items: z.array(opportunityRecord), total: z.number() });
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) throw unavailable();
  return { ...context, data: parsed.data };
}
export async function getOpportunity(id: string, offset = 0) {
  const result = await readMarketplace("detail", id, { offset });
  return {
    ...result,
    data: result.data ? detailRecord.parse(result.data) : null,
  };
}
export async function getOpportunities(
  kind: "discover" | "own",
  filters: Record<string, string | number>,
) {
  const result = await readMarketplace(kind, undefined, filters);
  return {
    ...result,
    data: z
      .object({ items: z.array(opportunityRecord), total: z.number() })
      .parse(result.data),
  };
}
export async function getApplications(offset: number) {
  const result = await readMarketplace("applications", undefined, { offset });
  return {
    ...result,
    data: z
      .object({ items: z.array(applicationRecord), total: z.number() })
      .parse(result.data),
  };
}
export async function getMemberProfile(id: string) {
  const context = await marketplaceContext();
  if (!uuid.safeParse(id).success) return null;
  const { data, error } = await context.client
    .rpc("member_profile", {
      p_id: id,
    })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) throw unavailable();
  return data === null ? null : memberProfile.parse(data);
}
export async function marketplaceCommand(
  action: string,
  id: string | undefined,
  data: Json = {},
) {
  const context = await marketplaceContext();
  const response = await context.client
    .rpc("marketplace_command", {
      p_action: action,
      ...(id ? { p_id: id } : {}),
      p_data: data,
    })
    .abortSignal(AbortSignal.timeout(15_000));
  return { ...context, response };
}
