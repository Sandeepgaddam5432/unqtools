import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Compose class names with Tailwind merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with thin-space thousands separator (1,679 style). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US");
}
