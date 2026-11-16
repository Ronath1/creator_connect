import Link from "next/link";
import { z } from "zod";
import { collaborationQuery } from "@/server/services/collaboration";
import { uuid, deadline } from "@/lib/marketplace";
import { PageLinks, offsetValue } from "@/components/marketplace-view";
export const metadata = { title: "Support report queue" };
export default async function AdminReports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset),
    result = await collaborationQuery("admin_reports", undefined, { offset }),
    data = z
      .object({
        items: z.array(
          z.object({
            id: uuid,
            category: z.string(),
            status: z.string(),
            assigned_admin: uuid.nullable(),
            created_at: z.string(),
          }),
        ),
        total: z.number(),
      })
      .parse(result.data);
  return (
    <>
      <h1>Report queue</h1>
      <p className="member-intro">
        Queue summaries do not expose private collaboration evidence. Claim the
        case, then provide an access reason.
      </p>
      {data.items.map((report) => (
        <article className="market-card" key={report.id}>
          <span className="badge">{report.status.replaceAll("_", " ")}</span>
          <h2>{report.category.replaceAll("_", " ")}</h2>
          <p>
            {report.assigned_admin === result.member.id
              ? "Assigned to you"
              : report.assigned_admin
                ? "Assigned to another administrator"
                : "Unassigned"}{" "}
            · {deadline(report.created_at)}
          </p>
          {["open", "in_review"].includes(report.status) ? (
            <Link
              className="action action-secondary"
              href={`/admin/reports/${report.id}`}
            >
              Open case controls
            </Link>
          ) : (
            <p className="form-help">
              Closed case; evidence access is no longer available.
            </p>
          )}
        </article>
      ))}
      {!data.total ? (
        <p className="dashboard-empty">No reports need review.</p>
      ) : null}
      <PageLinks path="/admin/reports" offset={offset} total={data.total} />
    </>
  );
}
