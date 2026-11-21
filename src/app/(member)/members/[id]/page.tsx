import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberProfile } from "@/server/services/marketplace";
import { MemberAvatar } from "@/components/member-avatar";
export const metadata = { title: "Member profile" };
export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getMemberProfile((await params).id);
  if (!profile) notFound();
  return (
    <>
      <Link href="/opportunities">← Opportunities</Link>
      <article className="market-card">
        <MemberAvatar
          key={profile.id}
          id={profile.id}
          name={profile.display_name}
        />
        <p className="eyebrow">
          {profile.role === "brand" ? "BRAND" : "CREATOR"} PROFILE
        </p>
        <h1>{profile.display_name}</h1>
        <p>
          {profile.location} · {profile.categories.join(" · ")}
        </p>
        <p className="preserve-lines">{profile.description}</p>
        {profile.website ? (
          <p>
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              Brand website (external)
            </a>
          </p>
        ) : null}
        {profile.links.length ? (
          <>
            <h2>Declared social profiles</h2>
            <p className="form-help">
              Links and follower counts are self-reported, not verified by
              CreatorConnect.
            </p>
            <ul>
              {profile.links.map((link) => (
                <li key={link.platform}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.platform} (external)
                  </a>
                  {link.follower_count !== null ? (
                    <p>
                      {link.follower_count.toLocaleString()} followers ·
                      self-reported as of {link.metrics_as_of}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </article>
    </>
  );
}
