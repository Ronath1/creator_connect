"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { savePortfolio } from "@/app/(member)/portfolio/actions";
import { portfolioValues, type PortfolioOwner } from "@/lib/portfolio";

export function PortfolioEditor({
  owner,
  origin,
}: {
  owner: PortfolioOwner;
  origin: string;
}) {
  const [state, action, pending] = useActionState(savePortfolio, {
    ...owner,
    values: portfolioValues(owner),
    errors: {},
    message: "",
    attempt: 0,
  });
  const [count, setCount] = useState(owner.draft.works.length);
  const link = `${origin}/creators/${state.slug}`;
  const error = (name: string) =>
    state.errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {state.errors[name]}
      </p>
    ) : null;
  const attrs = (name: string) => ({
    "aria-invalid": Boolean(state.errors[name]),
    "aria-describedby": state.errors[name] ? `${name}-error` : undefined,
  });
  return (
    <>
      <section className="market-card">
        <h2>
          {state.published
            ? "Your portfolio is public"
            : "Your portfolio is not public"}
        </h2>
        <p>
          Saving a draft never changes your published page. Publish to share
          this draft or replace the current public version. Your address becomes
          permanent the first time you publish.
        </p>
        {state.published ? (
          <p>
            <a href={link} target="_blank" rel="noopener noreferrer">
              Open public page (new tab)
            </a>
          </p>
        ) : null}
        {state.slug_locked ? (
          <div className="field">
            <label htmlFor="portfolio-share-link">
              Your permanent share URL
            </label>
            <input
              id="portfolio-share-link"
              value={link}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="form-help">
              Anyone with this URL can read your published page. Unpublishing
              keeps the address reserved for you.
            </p>
          </div>
        ) : null}
        <Link
          href="/portfolio/preview"
          prefetch={false}
          target="_blank"
          className="action action-secondary"
        >
          Preview saved draft (new tab)
        </Link>
        <p className="form-help">
          Save first to include your latest edits in this private preview.
          Public pages request no search indexing, but anyone can copy or share
          published content. Unpublishing cannot recall copies or already-open
          pages.
        </p>
      </section>
      <form
        action={action}
        onReset={(event) => event.preventDefault()}
        className="profile-form portfolio-editor"
      >
        {state.message ? (
          <div className="notice" role="status" aria-live="polite">
            <p>{state.message}</p>
            {Object.keys(state.errors).length ? (
              <ul>
                {Object.entries(state.errors).map(([name, message]) => (
                  <li key={name}>
                    <a href={`#${name}`}>{message}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <input type="hidden" name="revision" value={state.revision} />
        <fieldset
          disabled={pending}
          key={state.attempt}
          className="portfolio-fields"
        >
          <legend>Your chosen public content</legend>
          <p className="form-help">
            Nothing is copied from your private profile or collaborations. Share
            only work you have permission to publish; do not include private
            briefs, personal contact details or confidential links.
          </p>
          <div className="field">
            <label htmlFor="slug">Portfolio address</label>
            <input
              id="slug"
              name="slug"
              defaultValue={state.values.slug}
              readOnly={state.slug_locked}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              {...attrs("slug")}
            />
            <p className="form-help">
              3–40 lowercase letters, digits or hyphens; start and end with a
              letter or digit. Required even for saving a draft.{" "}
              {state.slug_locked
                ? "This published address is locked."
                : "Choose carefully: it locks after first publication."}
            </p>
            {error("slug")}
          </div>
          <div className="field">
            <label htmlFor="display_name">Public display name</label>
            <input
              id="display_name"
              name="display_name"
              maxLength={80}
              defaultValue={state.values.display_name}
              {...attrs("display_name")}
            />
            {error("display_name")}
          </div>
          <div className="field">
            <label htmlFor="headline">Headline</label>
            <input
              id="headline"
              name="headline"
              maxLength={140}
              defaultValue={state.values.headline}
              {...attrs("headline")}
            />
            {error("headline")}
          </div>
          <div className="field">
            <label htmlFor="about">About your work</label>
            <textarea
              id="about"
              name="about"
              rows={6}
              maxLength={2000}
              defaultValue={state.values.about}
              {...attrs("about")}
            />
            {error("about")}
          </div>
          <section id="works" aria-labelledby="portfolio-works-heading">
            <h2 id="portfolio-works-heading">Curated work links</h2>
            <p className="form-help">
              Publish 1–6 links with titles. Descriptions are optional. Links
              must use HTTPS; no images, embeds or external data are fetched.
            </p>
            {error("works")}
            {Array.from({ length: count }, (_, i) => (
              <fieldset className="market-card" key={i}>
                <legend>Work {i + 1}</legend>
                <div className="field">
                  <label htmlFor={`works.${i}.title`}>Title</label>
                  <input
                    id={`works.${i}.title`}
                    name={`works.${i}.title`}
                    maxLength={100}
                    defaultValue={state.values.works[i]?.title ?? ""}
                    {...attrs(`works.${i}.title`)}
                  />
                  {error(`works.${i}.title`)}
                </div>
                <div className="field">
                  <label htmlFor={`works.${i}.description`}>
                    Short description (optional)
                  </label>
                  <textarea
                    id={`works.${i}.description`}
                    name={`works.${i}.description`}
                    maxLength={300}
                    rows={3}
                    defaultValue={state.values.works[i]?.description ?? ""}
                    {...attrs(`works.${i}.description`)}
                  />
                  {error(`works.${i}.description`)}
                </div>
                <div className="field">
                  <label htmlFor={`works.${i}.url`}>HTTPS work URL</label>
                  <input
                    id={`works.${i}.url`}
                    name={`works.${i}.url`}
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={2048}
                    defaultValue={state.values.works[i]?.url ?? ""}
                    {...attrs(`works.${i}.url`)}
                  />
                  {error(`works.${i}.url`)}
                </div>
              </fieldset>
            ))}
            <div className="form-actions">
              <button
                type="button"
                className="action action-secondary"
                disabled={count >= 6}
                onClick={() => setCount((value) => value + 1)}
              >
                Add work link
              </button>
              {count > 0 ? (
                <button
                  type="button"
                  className="action action-secondary"
                  onClick={() => setCount((value) => value - 1)}
                >
                  Remove last work link
                </button>
              ) : null}
            </div>
          </section>
          <div className="field">
            <label className="checkbox-label" htmlFor="consent">
              <input
                type="checkbox"
                id="consent"
                name="consent"
                value="yes"
                {...attrs("consent")}
              />
              I want this chosen name, introduction and work links shared
              publicly, and I have permission to share them.
            </label>
            {error("consent")}
          </div>
          <p className="form-help">
            Publication needs a name (2–80 characters), headline (5–140),
            introduction (20–2000) and at least one titled HTTPS link. Consent
            is unchecked again after every save or publication.
          </p>
          <div className="form-actions">
            <button
              className="action action-secondary"
              name="intent"
              value="save"
              formNoValidate
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button
              className="action action-primary"
              name="intent"
              value="publish"
            >
              {state.published
                ? "Publish updated version"
                : "Publish portfolio"}
            </button>
            {state.published ? (
              <button
                className="action action-secondary"
                name="intent"
                value="unpublish"
                formNoValidate
              >
                Unpublish now
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
    </>
  );
}
