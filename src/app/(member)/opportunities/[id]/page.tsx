import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpportunity } from "@/server/services/marketplace";
import { deadline, money } from "@/lib/marketplace";
import { ApplicationForm, MarketAction } from "@/components/market-action";
import {
  offsetValue,
  PageLinks,
  PilotMoneyNotice,
} from "@/components/marketplace-view";

export const metadata = { title: "Opportunity brief" };
export default async function OpportunityDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    offset = offsetValue((await searchParams).offset);
  const { member, data } = await getOpportunity(id, offset);
  if (!data) notFound();
  const o = data.opportunity,
    own = member.id === o.brand_id;
  const myApp = data.applications.find((a) => a.influencer_id === member.id);
  const slotBlocked = Boolean(
    data.collaboration &&
    (data.collaboration.status === "pending_agreement" ||
      data.collaboration.activated_at ||
      ["active", "submitted", "revision_requested", "completed"].includes(
        data.collaboration.status,
      )),
  );
  const canReopen =
    o.status === "closed" &&
    !o.hidden_at &&
    o.close_reason !== "moderation" &&
    new Date(o.application_deadline) > new Date() &&
    !slotBlocked;
  return (
    <>
      <Link href={own ? "/my-opportunities" : "/opportunities"}>
        ← Opportunities
      </Link>
      <div className="market-title">
        <span className="badge">{o.status}</span>
        <h1>{o.title}</h1>
        <p>
          {data.brand ? (
            <Link href={`/members/${data.brand.id}`}>
              {data.brand.display_name}
            </Link>
          ) : (
            "Brand profile unavailable"
          )}{" "}
          · {o.category}
        </p>
      </div>
      <PilotMoneyNotice />
      {own ? (
        <div className="market-actions">
          <Link
            className="action action-secondary"
            href={`/my-opportunities/${id}/edit`}
          >
            Edit brief
          </Link>
          {o.status === "draft" ? (
            <>
              <MarketAction
                id={id}
                action="publish"
                label="Publish opportunity"
                version={o.version}
              />
              <MarketAction
                id={id}
                action="delete_draft"
                label="Delete unused draft"
              />
            </>
          ) : o.status === "open" ? (
            <MarketAction id={id} action="close" label="Close applications" />
          ) : canReopen ? (
            <MarketAction id={id} action="reopen" label="Reopen applications" />
          ) : null}
        </div>
      ) : null}
      <section className="market-card">
        <h2>The brief</h2>
        <p className="preserve-lines">{o.brief}</p>
        <dl className="market-facts">
          <div>
            <dt>Proposed compensation</dt>
            <dd>{money(o.budget_minor)}</dd>
          </div>
          <div>
            <dt>Platforms</dt>
            <dd>{o.platforms.join(", ")}</dd>
          </div>
          <div>
            <dt>Application deadline</dt>
            <dd>{deadline(o.application_deadline)}</dd>
          </div>
          <div>
            <dt>Delivery deadline</dt>
            <dd>{deadline(o.delivery_deadline)}</dd>
          </div>
          <div>
            <dt>Revisions per deliverable</dt>
            <dd>{o.revision_allowance}</dd>
          </div>
        </dl>
        <h3>Expected work</h3>
        <ol>
          {o.deliverables.map((d, i) => (
            <li key={i}>
              <strong>
                {d.quantity} × {d.format}
              </strong>
              <p>{d.acceptance}</p>
            </li>
          ))}
        </ol>
        {o.status === "closed" ? (
          <p className="notice">
            Applications closed: {o.close_reason}.{" "}
            {o.selection_until
              ? `Existing applicants may be selected until ${deadline(o.selection_until)} while no slot is reserved.`
              : "A reserved slot or committed collaboration prevents a new hire."}
          </p>
        ) : null}
      </section>
      {data.collaboration ? (
        <section className="market-card">
          <span className="eyebrow">SELECTION IS NOT MUTUAL AGREEMENT</span>
          <h2>{data.collaboration.status.replaceAll("_", " ")}</h2>
          <p>
            The selected match is saved separately from application and delivery
            status. Agreement confirmation and delivery tools are being
            prepared.
          </p>
          <p>
            Agreement window ends{" "}
            {deadline(data.collaboration.agreement_expires_at)}.
          </p>
        </section>
      ) : null}
      {member.role === "influencer" ? (
        <section className="market-card">
          <h2>Your application</h2>
          {myApp ? (
            <>
              <p className="badge">{myApp.status.replaceAll("_", " ")}</p>
              <p className="preserve-lines">{myApp.proposal}</p>
              {myApp.status === "pending" ? (
                <MarketAction
                  id={id}
                  action="withdraw"
                  applicationId={myApp.id}
                  label="Withdraw application permanently"
                />
              ) : null}
            </>
          ) : o.status === "open" &&
            new Date(o.application_deadline) > new Date() ? (
            <ApplicationForm id={id} />
          ) : (
            <p>This opportunity is not accepting applications.</p>
          )}
        </section>
      ) : null}
      {own ? (
        <section>
          <h2>Applications ({data.application_count})</h2>
          <p className="form-help">
            Only you and each applicant can read their application. Selection
            reserves the slot; competing applications stay pending until mutual
            agreement.
          </p>
          <div className="market-grid">
            {data.applications.map((a) => (
              <article className="market-card" key={a.id}>
                <span className="badge">{a.status.replaceAll("_", " ")}</span>
                <h3>
                  {a.profile ? (
                    <Link href={`/members/${a.influencer_id}`}>
                      {a.profile.display_name}
                    </Link>
                  ) : (
                    "Creator profile unavailable"
                  )}
                </h3>
                <p className="preserve-lines">{a.proposal}</p>
                <p className="form-help">Applied {deadline(a.created_at)}</p>
                {a.work_urls.map((url) => (
                  <p key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Relevant work (external)
                    </a>
                  </p>
                ))}
                {a.status === "pending" ? (
                  <div className="market-actions">
                    {!slotBlocked ? (
                      <MarketAction
                        id={id}
                        action="select"
                        applicationId={a.id}
                        label="Select creator"
                      />
                    ) : null}
                    <MarketAction
                      id={id}
                      action="reject"
                      applicationId={a.id}
                      label="Reject application"
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <PageLinks
            path={`/opportunities/${id}`}
            offset={offset}
            total={data.application_count}
          />
        </section>
      ) : null}
      <section className="market-card">
        <h2>Brief history</h2>
        <p className="form-help">
          Latest 20 versions. Unpublished draft history is visible only to its
          owner.
        </p>
        {data.history.map((h) => (
          <details key={h.version}>
            <summary>
              Version {h.version}: {h.reason} · {deadline(h.created_at)}
            </summary>
            <h3>{h.snapshot.title}</h3>
            <p className="preserve-lines">{h.snapshot.brief}</p>
            <p>
              {money(h.snapshot.budget_minor)} · delivery{" "}
              {deadline(h.snapshot.delivery_deadline)}
            </p>
            <ul>
              {h.snapshot.deliverables.map((d, i) => (
                <li key={i}>
                  {d.quantity} × {d.format}: {d.acceptance}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </>
  );
}
