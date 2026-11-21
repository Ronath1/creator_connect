import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { getIntegrationConfig } from "@/server/config";
import { loadMembership } from "@/server/services/membership";
import { uuid } from "@/lib/marketplace";
import {
  PROFILE_IMAGE_BUCKET,
  profileImagePath,
} from "@/server/services/profile-image";
import {
  PROFILE_IMAGE_MAX_BYTES,
  prepareProfileImage,
  ProfileImageValidationError,
} from "@/server/profile-image-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
};

function unavailable(status: number) {
  return new Response("Profile image unavailable.", {
    status,
    headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  if (!getIntegrationConfig()) return unavailable(503);
  try {
    // API requests receive status codes, never an image redirecting to auth HTML.
    if (!(await auth()).userId) return unavailable(401);
    const { member, client } = await loadMembership();
    const target = new URL(request.url).searchParams.get("member");
    if (
      !member ||
      member.status !== "active" ||
      (!target && member.role === "admin")
    )
      return unavailable(403);
    if (target) {
      if (!uuid.safeParse(target).success) return unavailable(404);
      const visible = await client
        .rpc("member_profile", { p_id: target })
        .abortSignal(AbortSignal.timeout(15_000));
      if (visible.error)
        return unavailable(visible.error.code === "42501" ? 403 : 503);
      if (!visible.data) return unavailable(404);
    }
    const storage = client.storage.from(PROFILE_IMAGE_BUCKET);
    const path = profileImagePath(target ?? member.id);
    // Metadata is authoritative for current existence; a cached byte response
    // must not resurrect a deleted object. A version nonce also separates replacements.
    const current = await storage.info(path);
    if (current.error)
      return unavailable(
        current.error.status === 404 ||
          current.error.statusCode === "404" ||
          ("code" in current.error && current.error.code === "NoSuchKey")
          ? 404
          : 503,
      );
    if (!current.data || (current.data.size ?? 0) > PROFILE_IMAGE_MAX_BYTES)
      return unavailable(404);
    const { data, error } = await storage.download(
      path,
      { cacheNonce: current.data.version || String(Date.now()) },
      { cache: "no-store" },
    );
    if (error)
      return unavailable(
        error.status === 404 ||
          error.statusCode === "404" ||
          ("code" in error && error.code === "NoSuchKey")
          ? 404
          : 503,
      );
    if (!data || data.size > PROFILE_IMAGE_MAX_BYTES) return unavailable(404);
    // Bucket MIME is not a byte validator. Sanitize even direct-API uploads.
    const image = await prepareProfileImage(
      new Uint8Array(await data.arrayBuffer()),
    );
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "image/webp",
        "Content-Disposition": 'inline; filename="profile.webp"',
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return unavailable(
      error instanceof ProfileImageValidationError ? 404 : 503,
    );
  }
}
