import Link from "next/link";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { collaborationQuery } from "@/server/services/collaboration";
import { deadline, uuid } from "@/lib/marketplace";
import { ActionForm } from "@/components/collaboration-forms";
import { NotificationRefresh } from "@/components/notification-refresh";
import { PageLinks, offsetValue } from "@/components/marketplace-view";
export const metadata = { title: "Notifications" };
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset),
    result = await collaborationQuery("notifications", undefined, { offset });
  const data = z
    .object({
      items: z.array(
        z.object({
          id: uuid,
          kind: z.string(),
          opportunity_id: uuid.nullable(),
          collaboration_id: uuid.nullable(),
          report_id: uuid.nullable(),
          read_at: z.string().nullable(),
          created_at: z.string(),
        }),
      ),
      total: z.number(),
      unread: z.number(),
    })
    .parse(result.data);
  return (
    <>
      <h1>Notifications</h1>
      <p className="member-intro">
        {data.unread} unread updates about records you can currently access.
      </p>
      <NotificationRefresh />
      {data.items.map((item) => {
        const href = item.collaboration_id
          ? `/collaborations/${item.collaboration_id}`
          : item.report_id
            ? "/reports"
            : item.opportunity_id
              ? `/opportunities/${item.opportunity_id}`
              : item.kind.startsWith("application_")
                ? "/applications"
                : "/dashboard";
        return (
          <article className="market-card" key={item.id}>
            <span className="badge">{item.read_at ? "Read" : "Unread"}</span>
            <h2>{item.kind.replaceAll("_", " ")}</h2>
            <p className="form-help">{deadline(item.created_at)}</p>
            <Link className="action action-secondary" href={href}>
              View update
            </Link>
            {!item.read_at ? (
              <ActionForm
                id={item.id}
                action="mark_notification"
                label="Mark as read"
                requestId={randomUUID()}
              />
            ) : null}
          </article>
        );
      })}
      {!data.total ? (
        <p className="dashboard-empty">
          You’re up to date. New authorized updates appear here.
        </p>
      ) : null}
      <PageLinks path="/notifications" offset={offset} total={data.total} />
    </>
  );
}
