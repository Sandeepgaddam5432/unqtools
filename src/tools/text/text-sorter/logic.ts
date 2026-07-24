/**
 * Text Sorter — pure logic.
 */

export type SortBy = "alphabetical" | "numeric" | "natural" | "length" | "random" | "reverse";
export type SortUnit = "lines" | "words" | "paragraphs" | "csv-column";

export interface SortOptions {
  unit: SortUnit;
  by: SortBy;
  reverse?: boolean;
  caseInsensitive?: boolean;
  removeDuplicates?: boolean;
  keepEmpty?: boolean;
  locale?: string;
  csvColumn?: number; // 0-indexed
  csvDelimiter?: string;
}

export interface SortResult {
  output: string;
  inputCount: number;
  outputCount: number;
  duplicatesRemoved: number;
  warnings: string[];
}

/** Split text into units based on the chosen unit type. */
function splitIntoUnits(text: string, unit: SortUnit, options: SortOptions): string[] {
  switch (unit) {
    case "lines":
      return text.split("\n");
    case "words":
      return text.split(/\s+/);
    case "paragraphs":
      return text.split(/\n\s*\n/);
    case "csv-column": {
      const delim = options.csvDelimiter ?? ",";
      return text.split("\n").map((line) => {
        const cols = line.split(delim);
        return cols[options.csvColumn ?? 0] ?? "";
      });
    }
    default:
      return text.split("\n");
  }
}

/** Join sorted units back into text. */
function joinUnits(units: string[], unit: SortUnit, original: string, options: SortOptions): string {
  switch (unit) {
    case "lines":
      return units.join("\n");
    case "words":
      return units.join(" ");
    case "paragraphs":
      return units.join("\n\n");
    case "csv-column": {
      // Re-sort the original lines based on the sorted column values
      const delim = options.csvDelimiter ?? ",";
      const originalLines = original.split("\n");
      // Pair each line with its column value, sort, then return the lines
      const pairs = originalLines.map((line, i) => ({ line, value: units[i] ?? "" }));
      // Re-apply sort to pairs based on value
      // Actually we already sorted units — we need to sort lines based on the column value
      // The cleanest approach: sort the lines directly
      const sortedLines = sortLines(originalLines, options, delim, options.csvColumn ?? 0);
      return sortedLines.join("\n");
    }
    default:
      return units.join("\n");
  }
}

function sortLines(lines: string[], options: SortOptions, delim: string, colIdx: number): string[] {
  const compareFn = (a: string, b: string): number => {
    let aVal: string, bVal: string;
    if (options.unit === "csv-column") {
      aVal = (a.split(delim)[colIdx] ?? "").trim();
      bVal = (b.split(delim)[colIdx] ?? "").trim();
    } else {
      aVal = a;
      bVal = b;
    }
    if (options.caseInsensitive) {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    let result = 0;
    switch (options.by) {
      case "alphabetical":
        result = aVal.localeCompare(bVal, options.locale);
        break;
      case "numeric": {
        const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ""));
        const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) result = aVal.localeCompare(bVal);
        else if (Number.isNaN(aNum)) result = 1;
        else if (Number.isNaN(bNum)) result = -1;
        else result = aNum - bNum;
        break;
      }
      case "natural":
        result = naturalCompare(aVal, bVal, options.locale);
        break;
      case "length":
        result = aVal.length - bVal.length || aVal.localeCompare(bVal);
        break;
      case "random":
        result = Math.random() - 0.5;
        break;
      case "reverse":
        result = bVal.localeCompare(aVal, options.locale);
        break;
    }
    return options.reverse && options.by !== "reverse" && options.by !== "random" ? -result : result;
  };
  return [...lines].sort(compareFn);
}

/** Natural sort: 'file2' < 'file10' (numeric-aware). */
export function naturalCompare(a: string, b: string, locale?: string): number {
  const aParts = a.split(/(\d+)/);
  const bParts = b.split(/(\d+)/);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i++) {
    const aPart = aParts[i] ?? "";
    const bPart = bParts[i] ?? "";
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aPart.localeCompare(bPart, locale);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export function sortText(text: string, options: SortOptions): SortResult | { error: string } {
  if (!text) return { output: "", inputCount: 0, outputCount: 0, duplicatesRemoved: 0, warnings: [] };
  const warnings: string[] = [];

  let units: string[];
  if (options.unit === "csv-column") {
    units = text.split("\n");
  } else {
    units = splitIntoUnits(text, options.unit, options);
  }

  // Filter empty
  let inputCount = units.length;
  if (!options.keepEmpty && options.unit !== "csv-column") {
    units = units.filter((u) => u.trim().length > 0);
  }
  let duplicatesRemoved = 0;
  if (options.removeDuplicates) {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const u of units) {
      const key = options.caseInsensitive ? u.toLowerCase() : u;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(u);
      } else {
        duplicatesRemoved++;
      }
    }
    units = deduped;
  }

  // Sort
  if (options.unit === "csv-column") {
    const delim = options.csvDelimiter ?? ",";
    units = sortLines(units, options, delim, options.csvColumn ?? 0);
  } else {
    // For other units, we sort the units directly
    const tmpOptions = { ...options, unit: "lines" as SortUnit };
    units = sortLines(units, tmpOptions, "", 0);
  }

  // Join
  let output: string;
  if (options.unit === "csv-column") {
    output = units.join("\n");
  } else if (options.unit === "words") {
    output = units.join(" ");
  } else if (options.unit === "paragraphs") {
    output = units.join("\n\n");
  } else {
    output = units.join("\n");
  }

  if (duplicatesRemoved > 0) warnings.push(`Removed ${duplicatesRemoved} duplicate(s).`);

  return {
    output,
    inputCount,
    outputCount: units.length,
    duplicatesRemoved,
    warnings,
  };
}

/** Generate stats CSV. */
export function statsToCsv(result: SortResult, options: SortOptions): string {
  return [
    "Field,Value",
    `Unit,${options.unit}`,
    `By,${options.by}`,
    `Reverse,${options.reverse ? "yes" : "no"}`,
    `CaseInsensitive,${options.caseInsensitive ? "yes" : "no"}`,
    `RemoveDuplicates,${options.removeDuplicates ? "yes" : "no"}`,
    `InputCount,${result.inputCount}`,
    `OutputCount,${result.outputCount}`,
    `DuplicatesRemoved,${result.duplicatesRemoved}`,
  ].join("\n");
}
