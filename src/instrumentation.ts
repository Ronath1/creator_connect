import type { Instrumentation } from "next";

/** Minimal server error hook; never log request headers, input, URLs, or secrets. */
export const onRequestError: Instrumentation.onRequestError = (
  _error,
  _request,
  context,
) => {
  console.error(
    JSON.stringify({
      event: "server_request_error",
      routeType: context.routeType,
      routerKind: context.routerKind,
      timestamp: new Date().toISOString(),
    }),
  );
};
