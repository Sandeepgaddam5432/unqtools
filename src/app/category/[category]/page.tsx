import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";
import { byCategory } from "@/lib/registry";
import { CategoryPageClient } from "./category-page-client";

/**
 * v6.9: generate static pages for ALL 13 categories. Categories without tools
 * render a real "Coming soon" empty state (owner decision, 2026-07-05) so
 * visitors can see the full breadth of UnQTools.
 * Self-healing preserved: when a tool is added to a category, the coming-soon
 * state is automatically replaced by the tools grid (registry-driven).
 */
export function generateStaticParams() {
  return ALL_CATEGORIES.map((c) => ({
    category: c,
  }));
}

export const dynamicParams = false;

export default function CategoryPage({ params }: { params: { category: string } }) {
  const cat = params.category as ToolCategory;
  const tools = byCategory(cat);
  const label = CATEGORY_LABELS[cat];
  return <CategoryPageClient category={cat} label={label} tools={tools} />;
}
