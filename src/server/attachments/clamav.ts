import "server-only";
import { lookup } from "node:dns/promises";
import { isIP, createConnection } from "node:net";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export class AttachmentError extends Error {}
export type ScanProof = {
  scanner_version: string;
  signature_version: string;
  signature_at: string;
};
type ScannerConfig = { host: string; port: number; timeoutMs?: number };
function privateAddress(address: string): boolean {
  const value = address.replace(/^::ffff:/i, "");
  if (value === "::1" || /^(fc|fd)[0-9a-f]{2}:/i.test(value)) return true;
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split(".").map(Number);
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}
export async function scannerConfig(): Promise<ScannerConfig> {
  const host = process.env.CLAMAV_HOST,
    port = Number(process.env.CLAMAV_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new AttachmentError(
      "File scanning is unavailable. Please try again later.",
    );
  const addresses = await lookup(host, { all: true });
  if (
    !addresses.length ||
    addresses.some((value) => !privateAddress(value.address))
  )
    throw new AttachmentError(
      "File scanning is unavailable. Please try again later.",
    );
  // Connect to the already validated address, avoiding a second DNS lookup.
  return { host: addresses[0].address, port, timeoutMs: 15_000 };
}
async function command(
  config: ScannerConfig,
  kind: "VERSION" | "INSTREAM",
  bytes?: Uint8Array,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AttachmentError("The upload timed out. Please try again."));
      return;
    }
    const socket = createConnection({ host: config.host, port: config.port });
    let response = Buffer.alloc(0),
      finished = false;
    const timer = setTimeout(
      () =>
        done(
          new AttachmentError(
            "File scanning timed out. Please try again later.",
          ),
        ),
      config.timeoutMs ?? 15_000,
    );
    const abort = () =>
      done(new AttachmentError("The upload timed out. Please try again."));
    signal?.addEventListener("abort", abort, { once: true });
    function done(error?: Error, value?: string) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      if (error) reject(error);
      else resolve(value ?? "");
    }
    socket.on("error", () =>
      done(
        new AttachmentError(
          "File scanning is unavailable. Please try again later.",
        ),
      ),
    );
    socket.on("end", () => {
      if (!finished)
        done(
          new AttachmentError("The scanner returned an incomplete response."),
        );
    });
    socket.on("data", (chunk) => {
      response = Buffer.concat([response, chunk]);
      if (response.length > 4096) {
        done(new AttachmentError("The scanner returned an invalid response."));
        return;
      }
      const end = response.indexOf(0);
      if (end >= 0) {
        if (end !== response.length - 1) {
          done(
            new AttachmentError("The scanner returned an invalid response."),
          );
          return;
        }
        done(undefined, response.subarray(0, end).toString("utf8"));
      }
    });
    socket.on("connect", () => {
      socket.write(`z${kind}\0`);
      if (kind === "INSTREAM" && bytes) {
        for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
          const part = bytes.subarray(offset, offset + 64 * 1024),
            size = Buffer.alloc(4);
          size.writeUInt32BE(part.length);
          socket.write(size);
          socket.write(part);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });
}
export function parseScannerVersion(
  reply: string,
  now = Date.now(),
): ScanProof {
  const match = /^ClamAV (\d+\.\d+\.\d+)\/(\d+)\/(.+)$/.exec(reply);
  if (!match)
    throw new AttachmentError("The scanner version could not be verified.");
  const [major, minor, patch] = match[1].split(".").map(Number);
  if (
    major !== 1 ||
    !((minor === 4 && patch >= 6) || (minor === 5 && patch >= 4))
  )
    throw new AttachmentError("The scanner needs a supported security update.");
  // clamd VERSION has no timezone: the configured daemon must run with TZ=UTC.
  const timestamp = Date.parse(`${match[3]} UTC`);
  if (
    !Number.isFinite(timestamp) ||
    timestamp < now - 48 * 3600_000 ||
    timestamp > now + 5 * 60_000
  )
    throw new AttachmentError(
      "File scanning definitions need an update. Please try again later.",
    );
  return {
    scanner_version: match[1],
    signature_version: match[2],
    signature_at: new Date(timestamp).toISOString(),
  };
}
/** No mock mode. Tests may supply a transport endpoint; production resolves a
 * private, operator-configured address. Only exact framed stream: OK is clean. */
export async function scanAttachment(
  bytes: Uint8Array,
  config?: ScannerConfig,
  signal?: AbortSignal,
): Promise<ScanProof> {
  if (bytes.length < 1 || bytes.length > MAX_ATTACHMENT_BYTES)
    throw new AttachmentError("Choose a file no larger than 10 MB.");
  const target = config ?? (await scannerConfig());
  if (!privateAddress(target.host))
    throw new AttachmentError("Scanner must use a private network address.");
  const proof = parseScannerVersion(
    await command(target, "VERSION", undefined, signal),
  );
  const result = await command(target, "INSTREAM", bytes, signal);
  if (result !== "stream: OK")
    throw new AttachmentError(
      result.includes("FOUND")
        ? "This file was rejected by the security scanner."
        : "This file could not be verified by the security scanner.",
    );
  return proof;
}
