import Link from "next/link";
import { PortfolioContent } from "@/components/portfolio-content";
import { getOwnPortfolio } from "@/server/services/portfolio";
export const metadata = { title: "Private portfolio preview" };
export default async function PortfolioPreviewPage() {
  const owner = await getOwnPortfolio();
  return (
    <>
      <Link href="/portfolio" prefetch={false}>
        Back to portfolio editor
      </Link>
      <p className="notice">
        Private preview of your saved draft. Unsaved edits are not shown;
        opening this page does not publish anything.
      </p>
      <PortfolioContent content={owner.draft} />
    </>
  );
}
