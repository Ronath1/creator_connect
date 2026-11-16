import { z } from "zod";
import { collaborationQuery } from "@/server/services/collaboration";
import { auditRecord } from "@/lib/collaboration";
import { deadline } from "@/lib/marketplace";
import { PageLinks, offsetValue } from "@/components/marketplace-view";
export const metadata = { title: "Support audit history" };
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset),
    result = await collaborationQuery("admin_audit", undefined, { offset }),
    data = z
      .object({ items: z.array(auditRecord), total: z.number() })
      .parse(result.data);
  return (
    <>
      <h1>Support audit history</h1>
      <p className="member-intro">
        Recorded reasons and access/intervention timestamps. Private messages
        and files are available only through an assigned case.
      </p>
      {data.items.map((event) => (
        <article className="market-card" key={event.id}>
          <h2>{event.kind.replaceAll("_", " ")}</h2>
          <p className="preserve-lines">{event.reason}</p>
          <p className="form-help">{deadline(event.created_at)}</p>
        </article>
      ))}
      <PageLinks path="/admin/audit" offset={offset} total={data.total} />
    </>
  );
}
