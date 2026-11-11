import "server-only";

export class AppError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Expose only deliberately safe messages at future request boundaries. */
export function publicError(error: unknown) {
  return error instanceof AppError
    ? { code: error.code, message: error.message }
    : {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      };
}
