import Link from "next/link";
import { getApplications } from "@/server/services/marketplace";
import { MarketAction } from "@/components/market-action";
import { offsetValue, PageLinks } from "@/components/marketplace-view";
import { deadline } from "@/lib/marketplace";
export const metadata = { title: "My applications" };
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset);
  const { data } = await getApplications(offset);
  return (
    <>
      <h1>My applications</h1>
      <p className="member-intro">
        Your interest, brand decisions and selected matches. Selection still
        needs mutual agreement.
      </p>
      <div className="market-grid">
        {data.items.map((a) => (
          <article key={a.id} className="market-card">
            <span className="badge">{a.status.replaceAll("_", " ")}</span>
            <h2>
              <Link href={`/opportunities/${a.opportunity_id}`}>
                {a.opportunity?.title ?? "Opportunity"}
              </Link>
            </h2>
            <p className="preserve-lines">{a.proposal}</p>
            <p className="form-help">Applied {deadline(a.created_at)}</p>
            {a.status === "pending" ? (
              <MarketAction
                id={a.opportunity_id}
                applicationId={a.id}
                action="withdraw"
                label="Withdraw permanently"
              />
            ) : null}
          </article>
        ))}
      </div>
      {data.total === 0 ? (
        <div className="dashboard-empty">
          <h2>No applications yet.</h2>
          <Link className="action action-primary" href="/opportunities">
            Discover opportunities
          </Link>
        </div>
      ) : null}
      <PageLinks path="/applications" offset={offset} total={data.total} />
    </>
  );
}
