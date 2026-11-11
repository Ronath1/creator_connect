import "server-only";

/** No provider credentials are required or read in Phase 1. */
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
