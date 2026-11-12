"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  changeProfileImage,
  type ProfileImageState,
} from "@/app/(member)/profile/image-actions";

const initial: ProfileImageState = {
  outcome: null,
  error: false,
  message: "",
  revision: 0,
};

function ProfileImagePicker({ disabled }: { disabled: boolean }) {
  const [error, setError] = useState("");
  return (
    <div className="field">
      <label htmlFor="profile-image-file">Choose an image</label>
      <p id="profile-image-help" className="form-help">
        JPEG, PNG or WebP still images, up to 5 MB and 16 megapixels. Photos are
        resized for your profile; image metadata is removed.
      </p>
      <input
        id="profile-image-file"
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={`profile-image-help${error ? " profile-image-file-error" : ""}`}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          const message =
            file && file.size > 5 * 1024 * 1024
              ? "Choose an image no larger than 5 MB."
              : "";
          event.currentTarget.setCustomValidity(message);
          setError(message);
        }}
      />
      {error ? (
        <p id="profile-image-file-error" className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PrivateImagePreview({ revision }: { revision: number }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <div className="profile-image-placeholder">Image unavailable</div>;
  // Unoptimized keeps the request in the browser, with Clerk cookies, rather
  // than sending private images through the shared Next image optimizer.
  return (
    <Image
      src={`/api/profile-image?v=${revision}`}
      unoptimized
      width={96}
      height={96}
      alt="Your saved profile image"
      onError={() => setFailed(true)}
    />
  );
}

export function ProfileImageForm({
  currentStatus,
  brand,
}: {
  currentStatus: "present" | "absent" | "unavailable";
  brand: boolean;
}) {
  const [state, action, pending] = useActionState(changeProfileImage, initial);
  const present =
    state.outcome === "saved" ||
    (state.outcome !== "removed" && currentStatus === "present");
  return (
    <section
      className="profile-image-section"
      aria-labelledby="profile-image-title"
    >
      <h2 id="profile-image-title">
        {brand ? "Brand logo" : "Profile photo"} <span>(optional)</span>
      </h2>
      <div className="profile-image-preview">
        {present ? (
          <PrivateImagePreview key={state.revision} revision={state.revision} />
        ) : (
          <div className="profile-image-placeholder">
            {currentStatus === "unavailable" && state.outcome !== "removed"
              ? "Image unavailable"
              : "No image yet"}
          </div>
        )}
        <p className="form-help">
          Your saved image is private in this pilot. You can finish your text
          profile without adding an image.
        </p>
      </div>
      {currentStatus === "unavailable" ? (
        <p className="field-error" role="status">
          We couldn’t check your current image. You can try uploading again or
          refresh this page.
        </p>
      ) : null}
      <form action={action} className="profile-image-form">
        <ProfileImagePicker key={state.revision} disabled={pending} />
        <div className="form-row-actions">
          <button
            type="submit"
            name="operation"
            value="upload"
            className="action action-primary"
            disabled={pending}
          >
            {pending ? "Updating image…" : "Save image"}
          </button>
          {present ? (
            <button
              type="submit"
              name="operation"
              value="remove"
              formNoValidate
              className="action action-secondary"
              disabled={pending}
            >
              Remove image
            </button>
          ) : null}
        </div>
        {state.message ? (
          <p
            className={state.error ? "field-error" : "form-help"}
            role={state.error ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}
        <p className="form-help" role="status">
          {pending
            ? "Keep this page open while your image updates."
            : "Selecting a file alone does not replace your saved image."}
        </p>
      </form>
    </section>
  );
}
