import { cleanupAttachments } from "../src/server/attachments/worker-client.ts";
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
do {
  try {
    const result = await cleanupAttachments();
    process.stdout.write(
      `${JSON.stringify({ event: "attachment_cleanup", ...result })}\n`,
    );
    if (process.argv.includes("--once") && result.failed) process.exitCode = 1;
  } catch {
    process.stderr.write(
      "Attachment cleanup unavailable; retrying without releasing quota.\n",
    );
    if (process.argv.includes("--once")) process.exitCode = 1;
  }
  if (process.argv.includes("--once") || stopping) break;
  await new Promise((resolve) => setTimeout(resolve, 30_000));
} while (!stopping);
