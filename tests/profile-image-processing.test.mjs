import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  prepareProfileImage,
  PROFILE_IMAGE_MAX_BYTES,
  ProfileImageValidationError,
} from "../src/server/profile-image-processing.ts";

function createImage(width = 32, height = 24) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 35, g: 120, b: 110, alpha: 0.8 },
    },
  });
}

test("actual JPEG/PNG/WebP pixels become bounded WebP with no metadata", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const input = await createImage(1600, 1200)
      .toFormat(format)
      .withExif({ IFD0: { Artist: "Synthetic test metadata" } })
      .toBuffer();
    const output = await prepareProfileImage(input);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "webp");
    assert.ok(metadata.width <= 1024 && metadata.height <= 1024);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.ok(output.byteLength <= PROFILE_IMAGE_MAX_BYTES);
  }
});

test("orientation is applied to pixels rather than preserved as EXIF", async () => {
  const input = await createImage(20, 40)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const output = await prepareProfileImage(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 20);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
});

test("SVG/HTML/GIF and forged or truncated image headers are rejected", async () => {
  const values = [
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    ),
    Buffer.from("<html><script>alert(1)</script></html>"),
    Buffer.from("GIF89a"),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from([255, 216, 255, 1, 2, 3]),
    Buffer.from("RIFFxxxxWEBP<html>spoofed image/webp</html>"),
  ];
  for (const input of values)
    await assert.rejects(
      prepareProfileImage(input),
      ProfileImageValidationError,
    );
});

test("empty/oversize input and decompression-heavy pixel dimensions are rejected", async () => {
  await assert.rejects(
    prepareProfileImage(new Uint8Array()),
    ProfileImageValidationError,
  );
  await assert.rejects(
    prepareProfileImage(new Uint8Array(PROFILE_IMAGE_MAX_BYTES + 1)),
    ProfileImageValidationError,
  );
  const largeDimensions = await createImage(4001, 4000).png().toBuffer();
  assert.ok(largeDimensions.byteLength < PROFILE_IMAGE_MAX_BYTES);
  await assert.rejects(
    prepareProfileImage(largeDimensions),
    ProfileImageValidationError,
  );
});

test("animated WebP is rejected instead of silently accepting many frames", async () => {
  const frame = await createImage(8, 8).png().toBuffer();
  const secondFrame = await createImage(8, 8).negate().png().toBuffer();
  const animation = await sharp([frame, secondFrame], {
    join: { animated: true },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  const metadata = await sharp(animation, { animated: true }).metadata();
  assert.ok(metadata.pages > 1);
  await assert.rejects(prepareProfileImage(animation), /still image/);
});

test("a direct-storage MIME spoof is rejected on the same delivery pipeline", async () => {
  await assert.rejects(
    prepareProfileImage(
      Buffer.from("<script>not pixels despite image/webp metadata</script>"),
    ),
    ProfileImageValidationError,
  );
  const valid = await createImage().webp().toBuffer();
  assert.equal(
    (await sharp(await prepareProfileImage(valid)).metadata()).format,
    "webp",
  );
});
