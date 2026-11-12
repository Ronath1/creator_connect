"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import {
  profileImageContext,
  saveProfileImage,
  removeProfileImage,
} from "@/server/services/profile-image";
import { ProfileImageValidationError } from "@/server/profile-image-processing";
import { AppError } from "@/server/errors";

export type ProfileImageState = {
  outcome: "saved" | "removed" | null;
  error: boolean;
  message: string;
  revision: number;
};

export async function changeProfileImage(
  previous: ProfileImageState,
  form: FormData,
): Promise<ProfileImageState> {
  let outcome: "saved" | "removed";
  try {
    // Even malformed/direct action requests check the current membership.
    await profileImageContext();
    const operation = form.get("operation");
    if (operation === "remove") {
      await removeProfileImage();
      outcome = "removed";
    } else if (operation === "upload") {
      const image = form.get("image");
      if (!(image instanceof File) || image.size === 0)
        throw new ProfileImageValidationError(
          "Choose an image to upload first.",
        );
      await saveProfileImage(image);
      outcome = "saved";
    } else {
      throw new ProfileImageValidationError(
        "Choose whether to upload or remove your image.",
      );
    }
  } catch (error) {
    unstable_rethrow(error);
    return {
      // Retain only display state after failure; it never authorizes file access.
      outcome:
        previous?.outcome === "saved" || previous?.outcome === "removed"
          ? previous.outcome
          : null,
      error: true,
      message:
        error instanceof ProfileImageValidationError ||
        error instanceof AppError
          ? error.message
          : "We couldn’t confirm the image change. Refresh before trying again.",
      revision: Number.isSafeInteger(previous?.revision)
        ? previous.revision
        : 0,
    };
  }
  revalidatePath("/profile");
  return {
    outcome,
    error: false,
    message:
      outcome === "saved"
        ? "Your profile image was saved."
        : "Your profile image was removed.",
    revision: Date.now(),
  };
}
