import { ActionLink, Badge } from "./ui";

export function IntegrationUnavailable() {
  return (
    <main id="main-content" className="container unavailable">
      <Badge>Account access unavailable</Badge>
      <h1>A little preparation first.</h1>
      <p>
        Secure account access is not ready in this environment. Please return
        when the pilot team has finished connecting it.
      </p>
      <div className="notice">
        <strong>Your privacy comes first</strong>
        <p>
          You cannot sign in, save a profile, or access member information here
          until the connection is ready.
        </p>
      </div>
      <ActionLink href="/">Back to the introduction</ActionLink>
    </main>
  );
}
