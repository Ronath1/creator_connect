import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { getIntegrationConfig } from "@/server/config";

const withClerk = clerkMiddleware();

export default function proxy(
  request: NextRequest,
  event: Parameters<typeof withClerk>[1],
) {
  // Pages/actions also check configuration and trusted identity before data access.
  if (!getIntegrationConfig()) return NextResponse.next();
  return withClerk(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
