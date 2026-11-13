import { categories, platforms } from "@/lib/marketplace";
import { getOpportunities } from "@/server/services/marketplace";
import {
  OpportunityCard,
  PageLinks,
  offsetValue,
  PilotMoneyNotice,
} from "@/components/marketplace-view";

export const metadata = { title: "Discover opportunities" };
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    offset = offsetValue(params.offset);
  const text = (key: string) =>
    typeof params[key] === "string" ? params[key].slice(0, 100) : "";
  const filters = {
    search: text("search"),
    category: text("category"),
    platform: text("platform"),
  };
  const { data } = await getOpportunities("discover", { ...filters, offset });
  return (
    <>
      <span className="eyebrow">MEMBER OPPORTUNITIES</span>
      <h1>Find work that fits.</h1>
      <p className="member-intro">
        Explore clear briefs from Sri Lankan brands. Check the status and
        deadlines before applying.
      </p>
      <form className="market-filters" method="get">
        <div className="field">
          <label htmlFor="search">Search brief or title</label>
          <input
            id="search"
            name="search"
            maxLength={100}
            defaultValue={filters.search}
          />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select name="category" id="category" defaultValue={filters.category}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="platform">Platform</label>
          <select name="platform" id="platform" defaultValue={filters.platform}>
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <button className="action action-primary">Filter opportunities</button>
      </form>
      <PilotMoneyNotice />
      <div className="market-grid">
        {data.items.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>
      {data.total === 0 ? (
        <p className="dashboard-empty">
          No opportunities match yet. Try a different filter or return later.
        </p>
      ) : null}
      <PageLinks
        path="/opportunities"
        offset={offset}
        total={data.total}
        filters={filters}
      />
    </>
  );
}
