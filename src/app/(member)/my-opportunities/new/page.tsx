import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { marketplaceContext } from "@/server/services/marketplace";
import { emptyOpportunity } from "@/lib/marketplace";
import { OpportunityForm } from "@/components/opportunity-form";
export const metadata = { title: "Create opportunity" };
export default async function NewOpportunity() {
  const { member } = await marketplaceContext();
  if (member.role !== "brand") redirect("/opportunities");
  return (
    <>
      <h1>Create an opportunity</h1>
      <p className="member-intro">
        Save a private draft first. Review the complete brief before publishing.
      </p>
      <OpportunityForm
        id={randomUUID()}
        version={0}
        values={emptyOpportunity}
        editing={false}
        materialLocked={false}
      />
    </>
  );
}
