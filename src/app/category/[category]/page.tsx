import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";
import { byCategory } from "@/lib/registry";
import { CategoryPageClient } from "./category-page-client";

export function generateStaticParams() {
  return ALL_CATEGORIES.map((c) => ({ category: c }));
}

export const dynamicParams = false;

export default function CategoryPage({ params }: { params: { category: string } }) {
  const cat = params.category as ToolCategory;
  const tools = byCategory(cat);
  const label = CATEGORY_LABELS[cat];
  return <CategoryPageClient category={cat} label={label} tools={tools} />;
}
