import "server-only";
import sharp from "sharp";
import { createHash, timingSafeEqual } from "node:crypto";
import { AttachmentError, MAX_ATTACHMENT_BYTES } from "./clamav.ts";

export function attachmentHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
export function verifyAttachment(
  bytes: Uint8Array,
  size: number,
  hash: string,
) {
  if (
    bytes.length !== size ||
    bytes.length > MAX_ATTACHMENT_BYTES ||
    !/^[a-f0-9]{64}$/.test(hash) ||
    !timingSafeEqual(
      Buffer.from(attachmentHash(bytes), "hex"),
      Buffer.from(hash, "hex"),
    )
  )
    throw new AttachmentError(
      "This file could not be verified. Please contact support.",
    );
}
export async function prepareAttachment(bytes: Uint8Array): Promise<{
  bytes: Uint8Array;
  contentType: "image/webp" | "application/pdf";
  extension: string;
}> {
  if (bytes.length < 1 || bytes.length > MAX_ATTACHMENT_BYTES)
    throw new AttachmentError("Choose a file no larger than 10 MB.");
  const data = Buffer.from(bytes);
  if (
    data
      .subarray(0, 8)
      .toString("ascii")
      .match(/^%PDF-[12]\.\d/)
  ) {
    if (!data.subarray(-1024).toString("latin1").trimEnd().endsWith("%%EOF"))
      throw new AttachmentError("Choose a complete PDF file.");
    return { bytes, contentType: "application/pdf", extension: "pdf" };
  }
  const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP";
  if (!jpeg && !png && !webp)
    throw new AttachmentError(
      "Choose a JPEG, PNG, WebP or PDF file. SVG and HTML are not accepted.",
    );
  try {
    const image = sharp(data, {
      limitInputPixels: 16_000_000,
      failOn: "error",
      animated: false,
    }).timeout({ seconds: 5 });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1) throw new Error("Animated image");
    const output = await image
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    if (output.length > MAX_ATTACHMENT_BYTES)
      throw new AttachmentError(
        "This image becomes too large when prepared. Try a smaller image.",
      );
    return { bytes: output, contentType: "image/webp", extension: "webp" };
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError(
      "This image could not be read. Choose a valid static image up to 16 megapixels.",
    );
  }
}
export function safeAttachmentName(name: string, extension: string) {
  const base =
    name
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
      .replace(/\.[^.]*$/, "")
      .trim()
      .slice(0, 140) || "attachment";
  return `${base}.${extension}`;
}
