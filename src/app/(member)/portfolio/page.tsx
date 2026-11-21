import { PortfolioEditor } from "@/components/portfolio-editor";
import { getOwnPortfolio } from "@/server/services/portfolio";
import { getAppOrigin } from "@/server/config";
export const metadata = { title: "Your creator portfolio" };
export default async function PortfolioPage() {
  const owner = await getOwnPortfolio();
  return (
    <>
      <header className="market-heading">
        <p className="eyebrow">CHOSEN BY YOU. SHARED WHEN YOU’RE READY.</p>
        <h1>Your creator portfolio</h1>
        <p>
          A small space for work you are ready to show publicly. Your private
          marketplace profile stays separate.
        </p>
      </header>
      <PortfolioEditor owner={owner} origin={getAppOrigin().origin} />
    </>
  );
}
