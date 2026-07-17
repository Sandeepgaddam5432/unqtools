import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";
import { byCategory } from "@/lib/registry";
import type { Metadata } from "next";
import { CategoryPageClient } from "./category-page-client";

const SITE_URL = "https://unqtools.pages.dev";

export function generateStaticParams() {
  return ALL_CATEGORIES.map((c) => ({
    category: c,
  }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = category as ToolCategory;
  const label = CATEGORY_LABELS[cat] ?? "Tools";
  const tools = byCategory(cat);
  const count = tools.length;

  const title = `${label} — ${count} Free Online Tools`;
  const description = `${count} free ${label.toLowerCase()} tools that run 100% in your browser. No uploads, no tracking, no accounts. Privacy-first, offline-capable PWA.`;

  return {
    title,
    description,
    keywords: [label.toLowerCase(), "online tools", "free tools", "browser tools", category],
    alternates: {
      canonical: `/category/${category}`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/category/${category}`,
      title,
      description,
      siteName: "UnQTools",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: count > 0, // Don't index empty "coming soon" categories
      follow: true,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = category as ToolCategory;
  const tools = byCategory(cat);
  const label = CATEGORY_LABELS[cat];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE_URL}/category/${category}` },
    ],
  };

  return (
    <>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </head>
      <CategoryPageClient category={cat} label={label} tools={tools} />
    </>
  );
}
