import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink, Arrow, Badge } from "@/components/ui";
import { futureFeatures } from "@/lib/site";

function getFeature(slug: string) {
  return Object.hasOwn(futureFeatures, slug)
    ? futureFeatures[slug as keyof typeof futureFeatures]
    : undefined;
}

export function generateStaticParams() {
  return Object.keys(futureFeatures).map((feature) => ({ feature }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const feature = getFeature((await params).feature);
  return {
    title: feature?.title ?? "Page not found",
    robots: { index: false, follow: false },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const feature = getFeature((await params).feature);
  if (!feature) notFound();
  return (
    <main id="main-content" className="container unavailable">
      <div className="unavailable-symbol" aria-hidden="true">
        ↗
      </div>
      <Badge>Not available yet</Badge>
      <h1>{feature.title}</h1>
      <p>{feature.description}</p>
      <div className="notice">
        <strong>Private pilot in preparation</strong>
        <p>
          Marketplace features are still being prepared. Applications and
          payments are not available here.
        </p>
      </div>
      <ActionLink href="/">
        Back to the introduction <Arrow />
      </ActionLink>
    </main>
  );
}
