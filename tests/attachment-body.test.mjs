import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedBody } from "../src/server/attachments/body.ts";
test("actual streamed bytes are capped even with absent or lying Content-Length", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(8));
          controller.enqueue(new Uint8Array(8));
          controller.close();
        },
      }),
      duplex: "half",
    });
    await assert.rejects(boundedBody(request, 10), /too large/);
  }
});
test("slow/chunked body abort cancels its reader instead of buffering indefinitely", async () => {
  let cancelled = false;
  const request = new Request("http://localhost/upload", {
    method: "POST",
    body: new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
    duplex: "half",
  });
  const controller = new AbortController();
  const result = boundedBody(request, 10, controller.signal);
  controller.abort();
  await assert.rejects(result);
  assert.equal(cancelled, true);
});
