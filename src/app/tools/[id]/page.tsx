import { TOOLS, byId } from "@/lib/registry";
import { CATEGORY_LABELS } from "@/lib/tool";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPageClient } from "./tool-page-client";

const SITE_URL = "https://unqtools.pages.dev";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ id: t.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tool = byId(id);
  if (!tool) {
    return {
      title: "Tool not found",
      description: "The requested tool could not be found.",
    };
  }

  const title = tool.seo?.title ?? `${tool.name} — Free Online Tool`;
  const description = tool.description;
  const url = `${SITE_URL}/tools/${tool.id}`;

  return {
    title,
    description,
    keywords: tool.keywords,
    authors: [{ name: "Sandeep Gaddam" }],
    alternates: {
      canonical: `/tools/${tool.id}`,
    },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "UnQTools",
      images: [
        {
          url: "/logo.svg",
          width: 512,
          height: 512,
          alt: `${tool.name} — UnQTools`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo.svg"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// JSON-LD structured data for each tool
function ToolJsonLd({ tool }: { tool: NonNullable<ReturnType<typeof byId>> }) {
  const faqEntries = tool.seo?.faq ?? [];

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description,
    url: `${SITE_URL}/tools/${tool.id}`,
    applicationCategory: "WebApplication",
    operatingSystem: "Any (runs in browser)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    creator: {
      "@type": "Person",
      name: "Sandeep Gaddam",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tools",
        item: `${SITE_URL}/tools`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: tool.name,
        item: `${SITE_URL}/tools/${tool.id}`,
      },
    ],
  };

  const faqJsonLd =
    faqEntries.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqEntries.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.a,
            },
          })),
        }
      : null;

  return (
    <head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
    </head>
  );
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tool = byId(id);
  if (!tool) notFound();
  const related = TOOLS.filter(
    (t) => t.category === tool.category && t.id !== tool.id,
  ).slice(0, 3);

  return (
    <>
      <ToolJsonLd tool={tool} />
      <ToolPageClient
        tool={tool}
        related={related}
        categoryLabel={CATEGORY_LABELS[tool.category]}
      />
    </>
  );
}
