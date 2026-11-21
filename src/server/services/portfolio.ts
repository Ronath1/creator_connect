import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import {
  portfolioContent,
  portfolioOwner,
  portfolioSlug,
} from "@/lib/portfolio";
import { getIntegrationConfig } from "@/server/config";
import { AppError } from "@/server/errors";
import { marketplaceContext } from "./marketplace";

export async function creatorPortfolioContext() {
  const context = await marketplaceContext();
  if (context.member.role !== "influencer") redirect("/dashboard");
  return context;
}
export async function getOwnPortfolio() {
  const { client } = await creatorPortfolioContext();
  const { data, error } = await client
    .rpc("creator_portfolio_editor")
    .abortSignal(AbortSignal.timeout(15_000));
  if (error)
    throw new AppError(
      "UNAVAILABLE",
      "We couldn’t load your portfolio. Please try again.",
    );
  return portfolioOwner.parse(data);
}
export async function getPublicPortfolio(slug: string) {
  if (!portfolioSlug.safeParse(slug).success) return null;
  const config = getIntegrationConfig();
  if (!config)
    throw new AppError(
      "UNAVAILABLE",
      "Public portfolios are unavailable in this environment.",
    );
  // Publishable key only, deliberately anonymous even for signed-in visitors.
  // No private profile client, current-user token or privileged worker key.
  const client = createClient<Database>(
    config.supabaseUrl,
    config.supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
  const { data, error } = await client
    .rpc("creator_portfolio", { p_slug: slug })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error)
    throw new AppError(
      "UNAVAILABLE",
      "This portfolio could not be loaded. Please try again.",
    );
  return data === null ? null : portfolioContent.parse(data);
}
