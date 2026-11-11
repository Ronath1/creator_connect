import { ActionLink, Arrow, Badge } from "@/components/ui";

const steps = [
  {
    number: "01",
    title: "Find the right fit",
    text: "Brands share a clear brief. Creators discover opportunities that suit their voice and audience.",
  },
  {
    number: "02",
    title: "Get on the same page",
    text: "Apply, connect, and agree on deliverables, timelines, and expectations before the work begins.",
  },
  {
    number: "03",
    title: "Make something meaningful",
    text: "Keep conversations, content submissions, and feedback together, from first idea to final approval.",
  },
];

export default function Home() {
  return (
    <main id="main-content">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <Badge>
            <span className="status-dot" /> Made for Sri Lanka · Private pilot
          </Badge>
          <h1 id="hero-title">
            Good work starts
            <br />
            with a <span>connection.</span>
          </h1>
          <p className="hero-description">
            Local brands. Distinctive voices. A shared space to find the right
            people and turn a good idea into a great collaboration.
          </p>
          <div className="hero-actions">
            <ActionLink href="#for-you">
              Find your place <Arrow />
            </ActionLink>
            <a className="text-link" href="#how-it-works">
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-note">
            <span className="location-mark" aria-hidden="true">
              ↗
            </span>
            <span>
              Starting small. Building better, together.
              <br />
              <strong>An invitation-only pilot for brands and creators.</strong>
            </span>
          </div>
        </div>
        <div
          className="hero-visual"
          role="img"
          aria-label="Illustration of a brand and a creator connecting around a shared brief"
        >
          <div className="visual-grid" aria-hidden="true" />
          <span className="visual-label">A GOOD IDEA. THE RIGHT PEOPLE.</span>
          <div className="connection-line line-one" aria-hidden="true" />
          <div className="connection-line line-two" aria-hidden="true" />
          <div className="identity-card brand-card">
            <div className="identity-icon" aria-hidden="true">
              b.
            </div>
            <div>
              <span className="eyebrow">THE BRAND</span>
              <strong>A story worth sharing.</strong>
              <span>Purpose, meet possibility.</span>
            </div>
            <span className="card-spark" aria-hidden="true">
              ✳
            </span>
          </div>
          <div className="brief-card">
            <div className="brief-heading">
              <span className="small-symbol" aria-hidden="true">
                ↗
              </span>
              <span>The collaboration brief</span>
              <span className="tiny-dot" />
            </div>
            <div className="brief-title">
              Something good,
              <br />
              made together.
            </div>
            <div className="brief-rule" />
            <div className="brief-check">
              <span aria-hidden="true">✓</span> Clear expectations
            </div>
            <div className="brief-check">
              <span aria-hidden="true">✓</span> A shared direction
            </div>
            <div className="brief-check">
              <span aria-hidden="true">✓</span> Room to create
            </div>
            <div className="brief-bottom">
              <span>BRAND + CREATOR</span>
              <span aria-hidden="true">↗</span>
            </div>
          </div>
          <div className="identity-card creator-card">
            <div className="identity-icon creator-icon" aria-hidden="true">
              c.
            </div>
            <div>
              <span className="eyebrow">THE CREATOR</span>
              <strong>A voice of your own.</strong>
              <span>Creativity, meet opportunity.</span>
            </div>
          </div>
          <div className="visual-footnote">
            <span aria-hidden="true">✦</span> Different strengths. Shared
            possibilities.
          </div>
        </div>
      </section>
      <div className="principles-strip">
        <div className="container principles-inner">
          <span>Thoughtful connections</span>
          <span aria-hidden="true">✦</span>
          <span>Clear commitments</span>
          <span aria-hidden="true">✦</span>
          <span>Space to do good work</span>
        </div>
      </div>
      <section
        id="for-you"
        className="section container"
        aria-labelledby="for-you-title"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">TWO SIDES. ONE SHARED SPACE.</span>
            <h2 id="for-you-title">
              Your next chapter,
              <br />
              with the right people.
            </h2>
          </div>
          <p>
            Whether you have a story to tell or a voice to tell it, good
            collaborations begin with a good fit.
          </p>
        </div>
        <div className="audience-grid">
          <article className="audience-card">
            <div className="audience-top">
              <span className="audience-icon" aria-hidden="true">
                ↗
              </span>
              <span className="eyebrow">FOR BRANDS</span>
            </div>
            <h3>
              Find a voice that
              <br />
              feels like your brand.
            </h3>
            <p>
              Bring your product, service, or next big idea to creators who
              understand the audience you want to reach.
            </p>
            <ul>
              <li>Share a brief with clear expectations</li>
              <li>Discover people through their applications</li>
              <li>Keep the work and feedback in one place</li>
            </ul>
            <a href="#pilot" className="text-link">
              Explore the brand experience <Arrow />
            </a>
          </article>
          <article className="audience-card creator-audience">
            <div className="audience-top">
              <span className="audience-icon" aria-hidden="true">
                ✳
              </span>
              <span className="eyebrow">FOR CREATORS</span>
            </div>
            <h3>
              Your creativity.
              <br />
              The right opportunity.
            </h3>
            <p>
              Find brands that fit your interests, share what makes your content
              yours, and create with a clear direction.
            </p>
            <ul>
              <li>Explore briefs that suit your voice</li>
              <li>Understand the work before committing</li>
              <li>Share content and follow your progress</li>
            </ul>
            <a href="#pilot" className="text-link">
              Explore the creator experience <Arrow />
            </a>
          </article>
        </div>
      </section>
      <section
        id="how-it-works"
        className="workflow-section"
        aria-labelledby="workflow-title"
      >
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                FROM FIRST HELLO TO FINAL DELIVERY
              </span>
              <h2 id="workflow-title">
                Less guesswork.
                <br />
                More good work.
              </h2>
            </div>
            <p>
              A simple journey designed around the things every collaboration
              needs: clarity, conversation, and follow-through.
            </p>
          </div>
          <ol className="steps-grid">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="workflow-note">
            The pilot experience is being built. Marketplace features are not
            available in this preview.
          </p>
        </div>
      </section>
      <section
        id="pilot"
        className="section container"
        aria-labelledby="pilot-title"
      >
        <div className="pilot-panel">
          <div>
            <Badge>
              <span className="status-dot" /> A considered beginning
            </Badge>
            <h2 id="pilot-title">
              Local first.
              <br />
              Built with you.
            </h2>
            <p>
              We’re starting with an invitation-only group of Sri Lankan brands
              and creators to learn what makes collaboration work in practice.
            </p>
            <p>
              Already invited? Sign in to your account. Marketplace access and
              invitations are managed directly by the pilot team.
            </p>
            <ActionLink href="/sign-in">
              Sign in <Arrow />
            </ActionLink>
          </div>
          <aside className="pilot-aside">
            <span className="eyebrow">WHAT TO EXPECT</span>
            <div>
              <span aria-hidden="true">01</span>
              <p>
                <strong>A focused private pilot</strong>A small community, with
                room to learn and improve.
              </p>
            </div>
            <div>
              <span aria-hidden="true">02</span>
              <p>
                <strong>Clear collaboration terms</strong>Agree on the work,
                deadlines, and revision expectations.
              </p>
            </div>
            <div>
              <span aria-hidden="true">03</span>
              <p>
                <strong>No payments in the pilot</strong>Budgets are
                informational. Funds are not collected, held, or paid through
                the platform.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
