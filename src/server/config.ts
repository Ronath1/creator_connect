import "server-only";

/** Metadata configuration never exposes credentials. */
export function getAppOrigin(): URL {
  const origin = new URL(process.env.APP_URL ?? "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    (origin.protocol !== "https:" && !(local && origin.protocol === "http:")) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      "APP_URL must be a plain HTTPS origin, or an HTTP localhost origin.",
    );
  }
  return origin;
}

export function getIntegrationConfig() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey || !secretKey || !supabaseUrl || !supabaseKey)
    return null;
  try {
    const url = new URL(supabaseUrl);
    if (
      !/^pk_(test|live)_/.test(publishableKey) ||
      !/^sk_(test|live)_/.test(secretKey) ||
      !supabaseKey.startsWith("sb_publishable_") ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return { publishableKey, supabaseUrl: url.origin, supabaseKey };
  } catch {
    return null;
  }
}
