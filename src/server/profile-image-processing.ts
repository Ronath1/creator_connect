import "server-only";
import sharp from "sharp";

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_PIXELS = 16_000_000;
export const PROFILE_IMAGE_EDGE = 1024;

export class ProfileImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileImageValidationError";
  }
}

function imageSignature(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "png";
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

/** Used before upload AND on delivery: direct Storage clients are untrusted too. */
export async function prepareProfileImage(bytes: Uint8Array): Promise<Buffer> {
  if (bytes.byteLength === 0 || bytes.byteLength > PROFILE_IMAGE_MAX_BYTES) {
    throw new ProfileImageValidationError(
      "Choose an image no larger than 5 MB.",
    );
  }
  const format = imageSignature(bytes);
  if (!format)
    throw new ProfileImageValidationError(
      "Choose a JPEG, PNG, or WebP image. SVG, HTML, HEIC and other formats are not supported.",
    );
  try {
    const image = sharp(bytes, {
      limitInputPixels: PROFILE_IMAGE_MAX_PIXELS,
      failOn: "warning",
      animated: true,
    });
    const metadata = await image.metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height) {
      throw new ProfileImageValidationError(
        "This file could not be read as a supported image.",
      );
    }
    if ((metadata.pages ?? 1) !== 1)
      throw new ProfileImageValidationError(
        "Choose a still image rather than an animation.",
      );
    if (metadata.width * metadata.height > PROFILE_IMAGE_MAX_PIXELS) {
      throw new ProfileImageValidationError(
        "Choose an image of 16 megapixels or fewer.",
      );
    }
    // Sharp strips metadata by default. Do not add keepMetadata/withMetadata.
    const output = await image
      .autoOrient()
      .resize({
        width: PROFILE_IMAGE_EDGE,
        height: PROFILE_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (output.byteLength > PROFILE_IMAGE_MAX_BYTES)
      throw new ProfileImageValidationError(
        "This image is too large to save. Please choose a smaller image.",
      );
    return output;
  } catch (error) {
    if (error instanceof ProfileImageValidationError) throw error;
    throw new ProfileImageValidationError(
      "This image could not be processed. Choose a valid still JPEG, PNG, or WebP image of 16 megapixels or fewer.",
    );
  }
}
