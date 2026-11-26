import Link from "next/link";
import type { ReactNode } from "react";
import {
  getApplications,
  getOpportunities,
} from "@/server/services/marketplace";
import { collaborationList } from "@/server/services/collaboration";
import { deadline } from "@/lib/marketplace";
import {
  applicationDashboardLink,
  collaborationDashboardLink,
  opportunityDashboardLink,
} from "@/lib/dashboard";

function RecentSection({
  id,
  title,
  total,
  shown,
  href,
  allLabel,
  empty,
  children,
}: {
  id: string;
  title: string;
  total: number;
  shown: number;
  href: string;
  allLabel: string;
  empty: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {total > 0 ? (
        <p className="form-help">
          Showing {shown} of {total}, newest first. View all for older records.
        </p>
      ) : null}
      {total === 0 ? (
        <div className="dashboard-empty">{empty}</div>
      ) : (
        <div className="market-grid">{children}</div>
      )}
      <Link className="action action-secondary" href={href}>
        {allLabel}
      </Link>
    </section>
  );
}
function RecentCollaborations({
  data,
  role,
}: {
  data: Awaited<ReturnType<typeof collaborationList>>["data"];
  role: "brand" | "influencer";
}) {
  return (
    <RecentSection
      id="recent-collaborations"
      title="Recent collaborations"
      total={data.total}
      shown={data.items.length}
      href="/collaborations"
      allLabel="View all collaborations"
      empty={
        <>
          <h3>No matched work yet.</h3>
          <p>
            A brand’s selection creates a pending agreement. Both participants
            must accept the same terms before work begins.
          </p>
        </>
      }
    >
      {data.items.map((collaboration) => {
        const action = collaborationDashboardLink(collaboration, role);
        return (
          <article className="market-card" key={collaboration.id}>
            <span className="badge">
              {collaboration.status.replaceAll("_", " ")}
            </span>
            <h3>
              <Link href={`/collaborations/${collaboration.id}`}>
                {collaboration.terms.title}
              </Link>
            </h3>
            <p>
              {collaboration.brand_name ?? "Brand"} ·{" "}
              {collaboration.influencer_name ?? "Creator"}
            </p>
            <p className="form-help">
              Delivery date {deadline(collaboration.terms.delivery_deadline)}
            </p>
            {collaboration.status === "pending_agreement" ? (
              <p className="form-help">
                Selected match; check the workspace for current terms,
                confirmations and agreement window.
              </p>
            ) : null}
            <Link className="action action-secondary" href={action.href}>
              {action.label}
            </Link>
          </article>
        );
      })}
    </RecentSection>
  );
}
export async function DashboardSummary({
  role,
}: {
  role: "brand" | "influencer";
}) {
  if (role === "brand") {
    const [{ data: opportunities }, { data: collaborations }] =
      await Promise.all([
        getOpportunities("own", { offset: 0, limit: 5 }),
        collaborationList(0, 5),
      ]);
    return (
      <>
        <RecentSection
          id="recent-opportunities"
          title="Recent opportunities"
          total={opportunities.total}
          shown={opportunities.items.length}
          href="/my-opportunities"
          allLabel="View all your opportunities"
          empty={
            <>
              <h3>Start with a clear brief.</h3>
              <p>Your drafts stay private until you publish them.</p>
              <Link
                className="action action-primary"
                href="/my-opportunities/new"
              >
                Create opportunity
              </Link>
            </>
          }
        >
          {opportunities.items.map((opportunity) => {
            const action = opportunityDashboardLink(opportunity);
            return (
              <article className="market-card" key={opportunity.id}>
                <span className="badge">
                  {opportunity.hidden_at ? "Restricted" : opportunity.status}
                </span>
                <h3>
                  <Link href={`/opportunities/${opportunity.id}`}>
                    {opportunity.title}
                  </Link>
                </h3>
                <p className="form-help">
                  Updated {deadline(opportunity.updated_at)}
                </p>
                {opportunity.status === "open" ? (
                  <p className="form-help">
                    Application deadline{" "}
                    {deadline(opportunity.application_deadline)}
                  </p>
                ) : null}
                <Link className="action action-secondary" href={action.href}>
                  {action.label}
                </Link>
              </article>
            );
          })}
        </RecentSection>
        <RecentCollaborations role={role} data={collaborations} />
      </>
    );
  }
  const [{ data: applications }, { data: collaborations }] = await Promise.all([
    getApplications(0, 5),
    collaborationList(0, 5),
  ]);
  return (
    <>
      <RecentSection
        id="recent-applications"
        title="Recent applications"
        total={applications.total}
        shown={applications.items.length}
        href="/applications"
        allLabel="View all your applications"
        empty={
          <>
            <h3>Find your next collaboration.</h3>
            <p>
              Browse published opportunities and send a proposal when the work
              fits.
            </p>
            <Link className="action action-primary" href="/opportunities">
              Discover opportunities
            </Link>
          </>
        }
      >
        {applications.items.map((application) => {
          const action = applicationDashboardLink(application);
          return (
            <article className="market-card" key={application.id}>
              <span className="badge">
                {application.status.replaceAll("_", " ")}
              </span>
              <h3>{application.opportunity?.title ?? "Opportunity record"}</h3>
              <p className="form-help">
                Applied {deadline(application.created_at)}
              </p>
              {application.status === "selected" ? (
                <p className="form-help">
                  Selection is recorded here. Follow agreement and delivery
                  status in Collaborations.
                </p>
              ) : null}
              <Link className="action action-secondary" href={action.href}>
                {action.label}
              </Link>
            </article>
          );
        })}
      </RecentSection>
      <RecentCollaborations role={role} data={collaborations} />
    </>
  );
}
