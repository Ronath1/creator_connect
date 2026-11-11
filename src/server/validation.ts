import "server-only";
import { AppError } from "./errors";

/** Shared bound for later list services; no database requests exist in Phase 1. */
export function parsePageSize(value: unknown): number {
  if (value === undefined || value === null) return 20;
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    value === ""
  ) {
    throw new AppError(
      "INVALID_INPUT",
      "Page size must be a whole number from 1 to 50.",
    );
  }
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > 50) {
    throw new AppError(
      "INVALID_INPUT",
      "Page size must be a whole number from 1 to 50.",
    );
  }
  return size;
}
