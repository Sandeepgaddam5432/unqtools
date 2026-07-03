import { TOOLS, byId } from "@/lib/registry";
import { CATEGORY_LABELS } from "@/lib/tool";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPageClient } from "./tool-page-client";

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
  if (!tool) return { title: "Tool not found — UnQTools" };
  return {
    title: tool.seo?.title ?? `${tool.name} — UnQTools`,
    description: tool.description,
  };
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
    <ToolPageClient
      tool={tool}
      related={related}
      categoryLabel={CATEGORY_LABELS[tool.category]}
    />
  );
}
