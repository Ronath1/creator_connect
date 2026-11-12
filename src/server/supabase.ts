import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getIntegrationConfig } from "./config";
import { AppError } from "./errors";
import type { Database } from "@/lib/database.types";

export async function createUserSupabaseClient() {
  const config = getIntegrationConfig();
  if (!config)
    throw new AppError(
      "UNAVAILABLE",
      "Account access is unavailable. Please try again later.",
    );
  const session = await auth();
  if (!session.userId)
    throw new AppError("UNAVAILABLE", "Please sign in to continue.");
  return createClient<Database>(config.supabaseUrl, config.supabaseKey, {
    accessToken: async () => session.getToken(),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
