import type { PortfolioContent as Content } from "@/lib/portfolio";

export function PortfolioContent({ content }: { content: Content }) {
  const initials = content.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <article className="portfolio-sheet">
      <header className="portfolio-introduction">
        <span className="portfolio-initials" aria-hidden="true">
          {initials || "CC"}
        </span>
        <p className="eyebrow">CREATOR PORTFOLIO</p>
        <h1>{content.display_name || "Your public name"}</h1>
        <p className="portfolio-headline">
          {content.headline || "Your headline"}
        </p>
      </header>
      <section aria-label="About the creator" className="portfolio-about">
        <h2>A little about my work</h2>
        <p className="preserve-lines">
          {content.about || "Your saved introduction will appear here."}
        </p>
      </section>
      <section aria-label="Selected work">
        <h2>Selected work</h2>
        <p className="form-help">
          Curated by the creator. Links open external websites; CreatorConnect
          has not verified their content or results.
        </p>
        <div className="portfolio-work-grid">
          {content.works.map((work, index) => (
            <article className="portfolio-work" key={index}>
              <h3>{work.title || "Work title"}</h3>
              {work.description ? (
                <p className="preserve-lines">{work.description}</p>
              ) : null}
              {work.url ? (
                <a
                  className="action action-secondary"
                  href={work.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                >
                  View work (external)
                </a>
              ) : (
                <p className="form-help">
                  Add an HTTPS work link before publishing.
                </p>
              )}
            </article>
          ))}
        </div>
        {!content.works.length ? (
          <p className="notice">No work links saved yet.</p>
        ) : null}
      </section>
    </article>
  );
}
