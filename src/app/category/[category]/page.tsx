import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";
import { TOOLS, byCategory } from "@/lib/registry";
import { CategoryPageClient } from "./category-page-client";

/**
 * Only generate static pages for categories that have at least 1 tool.
 * Empty categories get NO route (real 404) — consistent with our no-fake-pages rule.
 * Self-healing: when a new tool is added with a new category, the category page
 * reappears automatically.
 */
export function generateStaticParams() {
  return ALL_CATEGORIES.filter((c) => TOOLS.some((t) => t.category === c)).map((c) => ({
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
