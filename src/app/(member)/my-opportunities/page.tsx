import Link from "next/link";
import { redirect } from "next/navigation";
import { getOpportunities } from "@/server/services/marketplace";
import {
  OpportunityCard,
  PageLinks,
  offsetValue,
} from "@/components/marketplace-view";
export const metadata = { title: "My opportunities" };
export default async function MyOpportunities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset);
  const { member, data } = await getOpportunities("own", { offset });
  if (member.role !== "brand") redirect("/opportunities");
  return (
    <>
      <span className="eyebrow">YOUR BRAND’S BRIEFS</span>
      <h1>My opportunities</h1>
      <p className="member-intro">
        Prepare a draft, publish a clear brief and review applications. Each
        opportunity has one hiring slot.
      </p>
      <Link className="action action-primary" href="/my-opportunities/new">
        Create opportunity
      </Link>
      <div className="market-grid">
        {data.items.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>
      {data.total === 0 ? (
        <div className="dashboard-empty">
          <h2>Start with a clear brief.</h2>
          <p>Your drafts stay private until you publish them.</p>
        </div>
      ) : null}
      <PageLinks path="/my-opportunities" offset={offset} total={data.total} />
    </>
  );
}
