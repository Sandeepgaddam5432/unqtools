import type { Metadata } from "next";
import ToolsPageClient from "./tools-page-client";

const SITE_URL = "https://unqtools.pages.dev";

export const metadata: Metadata = {
  title: "All Tools — 610+ Free Online Browser Tools",
  description:
    "Browse 610+ free online tools — PDF utilities, file converters, text tools, calculators, SEO tools, security tools, developer tools, image tools, and more. 100% private, offline-capable, no signup required.",
  keywords: [
    "online tools",
    "free tools",
    "browser tools",
    "PDF tools",
    "file converters",
    "text tools",
    "calculators",
    "SEO tools",
    "security tools",
    "no signup",
  ],
  alternates: {
    canonical: "/tools",
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/tools`,
    title: "All Tools — 610+ Free Online Browser Tools",
    description:
      "Browse 610+ free online tools — PDF utilities, file converters, text tools, calculators, SEO tools, developer tools, image tools, and more. 100% private, no signup.",
    siteName: "UnQTools",
  },
  twitter: {
    card: "summary",
    title: "All Tools — 610+ Free Online Browser Tools",
    description:
      "Browse 610+ free online tools. 100% private, offline-capable, no signup required.",
  },
};

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "UnQTools — All Tools",
  numberOfItems: 616,
  url: `${SITE_URL}/tools`,
};

export default function ToolsPage() {
  return (
    <>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      </head>
      <ToolsPageClient />
    </>
  );
}
