import Link from "next/link";
import { BrandMark } from "./ui";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <BrandMark />
          <p>
            A little more clarity.
            <br />A better way to collaborate.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/#for-you">For brands & creators</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#pilot">About the pilot</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>Built for connections in Sri Lanka.</span>
        <span>Private pilot · Payments are not enabled.</span>
      </div>
    </footer>
  );
}
