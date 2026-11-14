import { z } from "zod";
import { collaborationQuery } from "@/server/services/collaboration";
import { reportRecord } from "@/lib/collaboration";
import { deadline } from "@/lib/marketplace";
import { PageLinks, offsetValue } from "@/components/marketplace-view";
export const metadata = { title: "Your reports" };
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset),
    result = await collaborationQuery("reports", undefined, { offset }),
    data = z
      .object({ items: z.array(reportRecord), total: z.number() })
      .parse(result.data);
  return (
    <>
      <h1>Your reports</h1>
      <p className="member-intro">
        Follow your own concerns and support’s shareable outcomes. Internal
        investigation notes and other reporters remain private.
      </p>
      {data.items.map((report) => (
        <article className="market-card" key={report.id}>
          <span className="badge">{report.status.replaceAll("_", " ")}</span>
          <h2>{report.category.replaceAll("_", " ")}</h2>
          <p className="preserve-lines">{report.description}</p>
          <p className="form-help">Reported {deadline(report.created_at)}</p>
          {report.outcome ? (
            <div className="notice">
              <strong>Support outcome</strong>
              <p>{report.outcome}</p>
            </div>
          ) : null}
        </article>
      ))}
      {!data.total ? (
        <p className="dashboard-empty">
          No reports yet. Use “Report a concern” on the relevant opportunity,
          member profile or collaboration.
        </p>
      ) : null}
      <PageLinks path="/reports" offset={offset} total={data.total} />
    </>
  );
}
