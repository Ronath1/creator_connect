import Link from "next/link";
import { redirect } from "next/navigation";
import { getIntegrationConfig } from "@/server/config";
import { getOwnProfile } from "@/server/services/profile";
import { getOwnProfileImageStatus } from "@/server/services/profile-image";
import { ProfileImageForm } from "@/components/profile-image-form";

export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  if (!getIntegrationConfig()) return null;
  const { member, values, complete } = await getOwnProfile();
  if (member.role === "admin") redirect("/dashboard");
  if (!complete || !values) redirect("/onboarding");
  const imageStatus = await getOwnProfileImageStatus();
  return (
    <>
      <span className="eyebrow">YOUR SAVED INTRODUCTION</span>
      <h1>{values.display_name}</h1>
      <p className="member-intro">
        {values.location} · {values.categories.join(", ")}
      </p>
      <div className="saved-profile">
        <h2>{member.role === "brand" ? "About your brand" : "About you"}</h2>
        <p className="preserve-text">{values.description}</p>
        {values.website ? (
          <a href={values.website} target="_blank" rel="noopener noreferrer">
            Brand website (opens in a new tab)
          </a>
        ) : null}
        {values.links.length ? (
          <>
            <h2>Social profiles</h2>
            <p className="form-help">
              Self-reported links and counts. These have not been verified.
            </p>
            <ul>
              {values.links.map((link) => (
                <li key={link.platform}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.platform} (opens in a new tab)
                  </a>
                  {link.follower_count !== null ? (
                    <p>
                      {link.follower_count.toLocaleString("en-LK")} followers ·
                      as of {link.metrics_as_of} · self-reported
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <Link className="action action-secondary" href="/onboarding">
        Update your introduction
      </Link>
      <ProfileImageForm
        currentStatus={imageStatus}
        brand={member.role === "brand"}
      />
    </>
  );
}
