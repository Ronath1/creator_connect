import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { uuid } from "@/lib/marketplace";
import { SupportCase } from "@/components/support-case";
export const metadata = { title: "Assigned support case" };
export default async function SupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  return (
    <>
      <h1>Case investigation</h1>
      <p className="member-intro">
        Private evidence opens only for this report’s assigned administrator
        with a recorded reason.
      </p>
      <SupportCase id={id} requestId={randomUUID()} />
    </>
  );
}
