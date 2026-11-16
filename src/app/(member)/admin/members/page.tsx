import { randomUUID } from "node:crypto";
import { z } from "zod";
import { collaborationQuery } from "@/server/services/collaboration";
import { uuid, deadline } from "@/lib/marketplace";
import { ActionForm, MembershipForm } from "@/components/collaboration-forms";
import { PageLinks, offsetValue } from "@/components/marketplace-view";
export const metadata = { title: "Approved membership" };
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const offset = offsetValue((await searchParams).offset),
    result = await collaborationQuery("admin_members", undefined, { offset }),
    data = z
      .object({
        items: z.array(
          z.object({
            id: uuid,
            display_name: z.string(),
            role: z.string(),
            status: z.string(),
            created_at: z.string(),
          }),
        ),
        total: z.number(),
      })
      .parse(result.data);
  return (
    <>
      <h1>Approved membership</h1>
      <details className="market-card">
        <summary>Grant approved brand/creator membership</summary>
        <MembershipForm requestId={randomUUID()} />
      </details>
      {data.items.map((member) => (
        <article className="market-card" key={member.id}>
          <h2>{member.display_name}</h2>
          <p>
            {member.role} · {member.status} · approved{" "}
            {deadline(member.created_at)}
          </p>
          {member.id !== result.member.id ? (
            <ActionForm
              id={member.id}
              action="member_status"
              fields={{
                status: member.status === "active" ? "suspended" : "active",
              }}
              label={
                member.status === "active"
                  ? "Restrict marketplace access"
                  : "Reactivate marketplace access"
              }
              reason
              requestId={randomUUID()}
            />
          ) : (
            <p className="form-help">
              You cannot change your own membership status.
            </p>
          )}
        </article>
      ))}
      <PageLinks path="/admin/members" offset={offset} total={data.total} />
    </>
  );
}
