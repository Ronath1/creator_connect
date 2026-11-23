#!/usr/bin/env node
// Local, anonymous HTTP elapsed baseline. No SDK, credentials, body logging or writes.
import { lookup } from "node:dns/promises";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

const BODY_LIMIT = 2 * 1024 * 1024;
const HELP = `Usage: npm run perf:baseline -- [options]
  --origin http://localhost:3000  Local HTTP origin only (default shown)
  --samples 10                   Measured requests per target, 1–30
  --warmup 2                     Unmeasured requests per target, 0–5
  --rps 1                        Aggregate start rate, 0.1–2; always sequential
  --timeout-ms 10000             Whole-request deadline, 1000–15000 ms
  --portfolio-slug safe-slug      Optional exact public portfolio target
  --help                         Show usage without requesting any page

GET / always; optionally GET /creators/<slug>. No redirects are followed.
Fixed Accept: */* samples machine HTTP, excluding browser document handshake.
Bodies are drained up to 2 MiB without storage, inspection or output.
Local HTTP elapsed includes application/network/database work, not server-only
p95 or browser performance. HTTP 200 does not prove a portfolio is published.
Exit: 0=all responses drained and 2xx; 1=request/non-2xx failure; 2=invalid config.
`;

function configuration(args) {
  const allowed = new Set([
    "origin",
    "samples",
    "warmup",
    "rps",
    "timeout-ms",
    "portfolio-slug",
  ]);
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (
      !key?.startsWith("--") ||
      !allowed.has(key.slice(2)) ||
      values.has(key.slice(2)) ||
      i + 1 >= args.length ||
      args[i + 1].startsWith("--")
    )
      throw new Error(
        "Invalid, duplicate or unknown option. Use --help; option values are not logged.",
      );
    values.set(key.slice(2), args[i + 1]);
  }
  const origin = values.get("origin") ?? "http://localhost:3000";
  if (!/^http:\/\/localhost(?::[0-9]{1,5})?\/?$/.test(origin))
    throw new Error(
      "Origin must be a plain http://localhost origin with an optional port; no credentials, paths, query or fragment.",
    );
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("Invalid local origin or port.");
  }
  if (url.port === "0") throw new Error("Port must be between 1 and 65535.");
  const number = (name, fallback, min, max, integer = true) => {
    const raw = values.get(name) ?? String(fallback);
    if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(raw))
      throw new Error(`Invalid numeric option: ${name}.`);
    const value = Number(raw);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw new Error(`Out-of-range option: ${name}.`);
    return value;
  };
  const slug = values.get("portfolio-slug");
  if (slug !== undefined && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
    throw new Error(
      "Portfolio slug must be 3–40 lowercase letters/digits/hyphens, starting and ending alphanumerically.",
    );
  return {
    origin: url.origin,
    samples: number("samples", 10, 1, 30),
    warmup: number("warmup", 2, 0, 5),
    rps: number("rps", 1, 0.1, 2, false),
    timeoutMs: number("timeout-ms", 10000, 1000, 15000),
    slug,
  };
}

function aggregate() {
  return {
    count: 0,
    statuses: {},
    non2xx: 0,
    failures: { network: 0, timeout: 0, body_limit: 0 },
    bytes: 0,
    elapsed: [],
    complete2xx: [],
  };
}
async function request(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  let status = null,
    bytes = 0,
    failure = null,
    reader;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "*/*",
        "User-Agent": "CreatorConnectLocalBaseline/1",
      },
    });
    status = response.status;
    const declared = response.headers.get("content-length");
    if (declared && /^\d+$/.test(declared) && Number(declared) > BODY_LIMIT) {
      failure = "body_limit";
      await response.body?.cancel();
    } else if (response.body) {
      reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > BODY_LIMIT) {
          failure = "body_limit";
          controller.abort();
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }
  } catch {
    failure ??= controller.signal.aborted ? "timeout" : "network";
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
  return { status, bytes, failure, elapsed: performance.now() - start };
}
function add(target, result) {
  target.count++;
  target.bytes += result.bytes;
  target.elapsed.push(result.elapsed);
  if (result.status !== null) {
    target.statuses[result.status] = (target.statuses[result.status] ?? 0) + 1;
    if (result.status < 200 || result.status >= 300) target.non2xx++;
  }
  if (result.failure) target.failures[result.failure]++;
  else if (result.status >= 200 && result.status < 300)
    target.complete2xx.push(result.elapsed);
}
function summary(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const value = (q) =>
    Math.round(sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] * 100) /
    100;
  return { min: value(0), p50: value(0.5), p95: value(0.95), max: value(1) };
}
function report(data) {
  return {
    requests: data.count,
    status_counts: data.statuses,
    non_2xx_responses: data.non2xx,
    failures: data.failures,
    bytes_received: data.bytes,
    all_attempt_elapsed_ms: summary(data.elapsed),
    fully_drained_2xx_elapsed_ms: summary(data.complete2xx),
  };
}
function failed(data) {
  return (
    data.non2xx > 0 || Object.values(data.failures).some((count) => count > 0)
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(HELP);
    return;
  }
  let config;
  try {
    config = configuration(args);
    const addresses = await lookup("localhost", { all: true });
    if (
      !addresses.length ||
      addresses.some(
        ({ address }) => address !== "::1" && !/^127\./.test(address),
      )
    )
      throw new Error("Localhost must resolve only to loopback addresses.");
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Invalid configuration."}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const targets = [
    { label: "root", path: "/" },
    ...(config.slug
      ? [{ label: "creator-portfolio", path: `/creators/${config.slug}` }]
      : []),
  ].map((target) => ({
    ...target,
    warmup: aggregate(),
    measured: aggregate(),
  }));
  const started = new Date().toISOString(),
    begin = performance.now();
  let nextStart = begin;
  for (const phase of ["warmup", "measured"]) {
    const count = phase === "warmup" ? config.warmup : config.samples;
    for (let i = 0; i < count; i++)
      for (const target of targets) {
        while (performance.now() < nextStart)
          await sleep(Math.ceil(nextStart - performance.now()));
        nextStart = performance.now() + 1000 / config.rps;
        add(
          target[phase],
          await request(new URL(target.path, config.origin), config.timeoutMs),
        );
      }
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        tool: "creatorconnect-local-http-baseline",
        started_at: started,
        local_origin: config.origin,
        samples_per_target: config.samples,
        warmup_per_target: config.warmup,
        aggregate_rps_cap: config.rps,
        request_accept: "*/*",
        concurrency: 1,
        request_timeout_ms: config.timeoutMs,
        response_byte_limit: BODY_LIMIT,
        total_wall_elapsed_ms:
          Math.round((performance.now() - begin) * 100) / 100,
        semantics:
          "Anonymous machine HTTP GET elapsed through full bounded body drain, excluding browser document handshake. No body inspection; portfolio HTTP 200 does not establish publication. Not server-only p95, browser LCP/CLS/INP, representative load or production capacity.",
        targets: targets.map((target) => ({
          target: target.label,
          warmup: report(target.warmup),
          measured: report(target.measured),
        })),
      },
      null,
      2,
    )}\n`,
  );
  if (
    targets.some((target) => failed(target.warmup) || failed(target.measured))
  )
    process.exitCode = 1;
}
main().catch(() => {
  process.stderr.write(
    "Baseline could not complete; no response contents are logged.\n",
  );
  process.exitCode = 1;
});
