import Link from "next/link";
import { deadline, money, type Opportunity } from "@/lib/marketplace";

export function OpportunityCard({
  opportunity: o,
}: {
  opportunity: Opportunity;
}) {
  return (
    <article className="market-card">
      <span className="badge">{o.status}</span>
      <p className="form-help">{o.brand_name ?? o.category}</p>
      <h2>
        <Link href={`/opportunities/${o.id}`}>{o.title}</Link>
      </h2>
      <p>
        {o.brief.slice(0, 200)}
        {o.brief.length > 200 ? "…" : ""}
      </p>
      <p>
        <strong>{money(o.budget_minor)}</strong> · proposed budget
      </p>
      <p>{o.platforms.join(" · ")}</p>
      <p className="form-help">Apply by {deadline(o.application_deadline)}</p>
      <Link className="action action-secondary" href={`/opportunities/${o.id}`}>
        View opportunity
      </Link>
    </article>
  );
}
export function PageLinks({
  path,
  offset,
  total,
  filters = {},
}: {
  path: string;
  offset: number;
  total: number;
  filters?: Record<string, string>;
}) {
  function href(next: number) {
    const params = new URLSearchParams({ ...filters, offset: String(next) });
    return `${path}?${params}`;
  }
  return (
    <nav className="market-actions" aria-label="Pagination">
      {offset > 0 ? (
        <Link
          className="action action-secondary"
          href={href(Math.max(0, offset - 20))}
        >
          Previous
        </Link>
      ) : null}
      <p className="form-help">
        {total === 0
          ? "No results"
          : offset >= total
            ? "No results on this page. Use Previous to return to earlier results."
            : `${offset + 1}–${Math.min(offset + 20, total)} of ${total}`}
      </p>
      {offset + 20 < total ? (
        <Link className="action action-secondary" href={href(offset + 20)}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
export function PilotMoneyNotice() {
  return (
    <div className="notice">
      <strong>Proposed compensation only</strong>
      <p>
        No funds are collected, held or paid through this pilot. Selection still
        requires both participants’ explicit agreement.
      </p>
    </div>
  );
}
export function offsetValue(value: string | string[] | undefined) {
  const parsed = Number(typeof value === "string" ? value : 0);
  return Number.isInteger(parsed) ? Math.max(0, Math.min(parsed, 100000)) : 0;
}
