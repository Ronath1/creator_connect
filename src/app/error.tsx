"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="container unavailable">
      <span className="eyebrow">SOMETHING WENT WRONG</span>
      <h1>Let’s try that again.</h1>
      <p>
        We couldn’t load this page. Please try again or return to the home page.
      </p>
      <div className="hero-actions">
        <button className="action action-primary" onClick={reset}>
          Try again
        </button>
        <Link className="text-link" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
