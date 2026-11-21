import { notFound } from "next/navigation";
import { PortfolioContent } from "@/components/portfolio-content";
import { getPublicPortfolio } from "@/server/services/portfolio";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata = {
  title: "Creator portfolio",
  robots: { index: false, follow: false },
};
export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const content = await getPublicPortfolio((await params).slug);
  if (!content) notFound();
  return (
    <main id="main-content" className="container portfolio-public">
      <PortfolioContent content={content} />
      <p className="form-help">
        This creator chose to share this portfolio publicly. Content and
        external links are self-published, not verified campaign results.
      </p>
    </main>
  );
}
