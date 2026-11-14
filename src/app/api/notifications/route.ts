import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getIntegrationConfig } from "@/server/config";
import { loadMembership } from "@/server/services/membership";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};
export async function GET() {
  try {
    if (!getIntegrationConfig())
      return Response.json({ unread: 0 }, { status: 503, headers });
    if (!(await auth()).userId)
      return Response.json({ unread: 0 }, { status: 401, headers });
    const { member, client } = await loadMembership();
    if (!member || member.status !== "active")
      return Response.json({ unread: 0 }, { status: 403, headers });
    const { data, error } = await client
      .rpc("collaboration_read", {
        p_kind: "notifications",
        p_filters: { limit: 1 },
      })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error)
      return Response.json(
        { unread: 0 },
        { status: error.code === "42501" ? 403 : 503, headers },
      );
    return Response.json(
      z.object({ unread: z.number().int().min(0) }).parse(data),
      { headers },
    );
  } catch {
    return Response.json({ unread: 0 }, { status: 503, headers });
  }
}
