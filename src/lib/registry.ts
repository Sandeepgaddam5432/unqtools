/**
 * Central tool registry — explicit imports (Next.js-compatible, no Vite glob).
 *
 * Adding a new tool: drop a folder under src/tools/<cat>/<id>/ with a manifest.ts,
 * then add an import + TOOLS.push line below. Routing, search, and the homepage
 * grid pick it up automatically.
 */
import type { ToolCategory, ToolManifest } from "./tool";

import { manifest as emiCalculator } from "@/tools/calculators/emi-calculator/manifest";
import { manifest as mortgageCalculator } from "@/tools/calculators/mortgage-calculator/manifest";
import { manifest as sipCalculator } from "@/tools/calculators/sip-calculator/manifest";
import { manifest as base64 } from "@/tools/developer/base64/manifest";
import { manifest as hashGenerator } from "@/tools/developer/hash-generator/manifest";
import { manifest as jsonFormatter } from "@/tools/developer/json-formatter/manifest";
import { manifest as urlEncoder } from "@/tools/developer/url-encoder/manifest";
import { manifest as uuidGenerator } from "@/tools/developer/uuid-generator/manifest";
import { manifest as colorPicker } from "@/tools/image/color-picker/manifest";
import { manifest as imageCompressor } from "@/tools/image/image-compressor/manifest";
import { manifest as addLineBreaks } from "@/tools/text/add-line-breaks/manifest";
import { manifest as addPrefixSuffix } from "@/tools/text/add-prefix-suffix/manifest";
import { manifest as bigTextGenerator } from "@/tools/text/big-text-generator/manifest";
import { manifest as boldTextGenerator } from "@/tools/text/bold-text-generator/manifest";
import { manifest as bubbleTextGenerator } from "@/tools/text/bubble-text-generator/manifest";
import { manifest as caesarCipher } from "@/tools/text/caesar-cipher/manifest";
import { manifest as caseConverter } from "@/tools/text/case-converter/manifest";
import { manifest as csvToMarkdown } from "@/tools/text/csv-to-markdown/manifest";
import { manifest as csvToTextList } from "@/tools/text/csv-to-text-list/manifest";
import { manifest as diffChecker } from "@/tools/text/diff-checker/manifest";
import { manifest as duplicateLinesRemover } from "@/tools/text/duplicate-lines-remover/manifest";
import { manifest as wordCharacterCounter } from "@/tools/text/word-character-counter/manifest";

export const TOOLS: readonly ToolManifest[] = [
  emiCalculator,
  mortgageCalculator,
  sipCalculator,
  base64,
  hashGenerator,
  jsonFormatter,
  urlEncoder,
  uuidGenerator,
  colorPicker,
  imageCompressor,
  addLineBreaks,
  addPrefixSuffix,
  bigTextGenerator,
  boldTextGenerator,
  bubbleTextGenerator,
  caesarCipher,
  caseConverter,
  csvToMarkdown,
  csvToTextList,
  diffChecker,
  duplicateLinesRemover,
  wordCharacterCounter,
]
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export function byCategory(c: ToolCategory): ToolManifest[] {
  return TOOLS.filter((t) => t.category === c);
}

export function byId(id: string): ToolManifest | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function countByCategory(): Record<ToolCategory, number> {
  const counts = {} as Record<ToolCategory, number>;
  for (const t of TOOLS) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
}
