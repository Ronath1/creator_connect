import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/lib/site";
import { getAppOrigin, getIntegrationConfig } from "@/server/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getAppOrigin(),
  title: {
    default: `${site.name} — Good work starts with a connection`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const integration = getIntegrationConfig();
  const content = (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {integration ? (
          <ClerkProvider
            publishableKey={integration.publishableKey}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
