import Link from "next/link";
export const metadata = { title: "Pilot support" };
export default function AdminPage() {
  return (
    <>
      <h1>Pilot support</h1>
      <p className="member-intro">
        Review reports, record interventions and manage approved membership.
      </p>
      <div className="market-grid">
        <section className="market-card">
          <h2>Report queue</h2>
          <p>
            Claim an open report and record a reason before viewing its related
            private evidence. Actions stay tied to that assigned case.
          </p>
          <Link className="action action-primary" href="/admin/reports">
            Review reports
          </Link>
        </section>
        <section className="market-card">
          <h2>Approved members</h2>
          <p>
            Grant a fixed brand/creator role or restrict/reactivate an approved
            member with an audit reason. Administrator grants remain
            owner-controlled.
          </p>
          <Link className="action action-secondary" href="/admin/members">
            Manage membership
          </Link>
        </section>
      </div>
      <p className="notice">
        Support cannot confirm agreements or approve submissions for
        participants. Cancellation interventions are labelled administrator
        actions and never move money.
      </p>
    </>
  );
}
