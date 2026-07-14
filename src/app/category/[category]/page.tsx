import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";
import { byCategory } from "@/lib/registry";
import { CategoryPageClient } from "./category-page-client";

/**
 * v6.9: generate static pages for ALL 13 categories. Categories without tools
 * render a real "Coming soon" empty state (owner decision, 2026-07-05) so
 * visitors can see the full breadth of UnQTools.
 * Self-healing preserved: when a tool is added to a category, the coming-soon
 * state is automatically replaced by the tools grid (registry-driven).
 *
 * v8.0 fix (2026-07-14): In Next.js 16, `params` is a Promise and MUST be
 * awaited. Without await, `params.category` is undefined at SSG time, which
 * causes every category page to render the "Coming soon" empty state —
 * even categories with tools (pdf, text, developer, etc.). This was the
 * root cause of the "all categories show Coming soon" bug.
 */
export function generateStaticParams() {
  return ALL_CATEGORIES.map((c) => ({
    category: c,
  }));
}

export const dynamicParams = false;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = category as ToolCategory;
  const tools = byCategory(cat);
  const label = CATEGORY_LABELS[cat];
  return <CategoryPageClient category={cat} label={label} tools={tools} />;
}
