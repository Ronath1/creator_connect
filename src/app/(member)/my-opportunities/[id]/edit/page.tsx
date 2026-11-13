import { notFound, redirect } from "next/navigation";
import { getOpportunity } from "@/server/services/marketplace";
import { opportunityValues } from "@/lib/marketplace";
import { OpportunityForm } from "@/components/opportunity-form";
export const metadata = { title: "Edit opportunity" };
export default async function EditOpportunity({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member, data } = await getOpportunity(id);
  if (!data) notFound();
  if (member.id !== data.opportunity.brand_id) redirect(`/opportunities/${id}`);
  return (
    <>
      <h1>Edit your brief</h1>
      <p className="member-intro">
        Corrections are recorded in history. Published history is visible to
        members.
      </p>
      <OpportunityForm
        id={id}
        version={data.opportunity.version}
        values={opportunityValues(data.opportunity)}
        editing
        materialLocked={data.application_count > 0}
      />
    </>
  );
}
