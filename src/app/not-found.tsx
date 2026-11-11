import { ActionLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main-content" className="container unavailable">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>A little off track.</h1>
      <p>
        This page doesn’t exist. Head back to the introduction to find your way.
      </p>
      <ActionLink href="/">Back to home</ActionLink>
    </main>
  );
}
