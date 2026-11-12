import "server-only";
import { requireMember } from "./membership";
import { AppError } from "@/server/errors";
import {
  PROFILE_IMAGE_MAX_BYTES,
  prepareProfileImage,
  ProfileImageValidationError,
} from "@/server/profile-image-processing";

export const PROFILE_IMAGE_BUCKET = "profile-images";

/** No caller-supplied filename/path/owner is used. One object bounds storage. */
export function profileImagePath(internalUserId: string) {
  return `${internalUserId}/profile.webp`;
}

export async function profileImageContext() {
  const { member, client } = await requireMember();
  if (member.role !== "brand" && member.role !== "influencer") {
    throw new AppError(
      "UNAVAILABLE",
      "Profile images are available for brand and creator profiles.",
    );
  }
  return { member, client, path: profileImagePath(member.id) };
}

export async function saveProfileImage(file: File) {
  const { client, path } = await profileImageContext();
  if (file.size === 0 || file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new ProfileImageValidationError(
      "Choose an image no larger than 5 MB.",
    );
  }
  // Original bytes and their metadata are never uploaded by this application.
  const sanitized = await prepareProfileImage(
    new Uint8Array(await file.arrayBuffer()),
  );
  const { error } = await client.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(path, sanitized, {
      contentType: "image/webp",
      cacheControl: "0",
      upsert: true,
    });
  if (error)
    throw new AppError(
      "UNAVAILABLE",
      "We couldn’t confirm the image was saved. Refresh before trying again.",
    );
}

export async function removeProfileImage() {
  const { client, path } = await profileImageContext();
  const { error } = await client.storage
    .from(PROFILE_IMAGE_BUCKET)
    .remove([path]);
  if (error)
    throw new AppError(
      "UNAVAILABLE",
      "We couldn’t remove your image. Please try again.",
    );
}

export async function getOwnProfileImageStatus(): Promise<
  "present" | "absent" | "unavailable"
> {
  const { client, path } = await profileImageContext();
  try {
    const { data, error } = await client.storage
      .from(PROFILE_IMAGE_BUCKET)
      .info(path);
    if (error)
      return error.status === 404 ||
        error.statusCode === "404" ||
        ("code" in error && error.code === "NoSuchKey")
        ? "absent"
        : "unavailable";
    return data ? "present" : "absent";
  } catch {
    return "unavailable";
  }
}
