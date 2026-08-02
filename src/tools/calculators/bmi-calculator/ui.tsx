/**
 * BMI Calculator — 100x UI (ui.tsx replacement).
 *
 * Single-file UI (~1,500 lines). Implements every applicable feature from
 * `spec/100-FEATURE-CATALOG.md` for the CALCULATOR archetype. See the
 * engine file (`CODE-1-ENGINE.ts`) for the pure logic; this file owns all
 * presentation, state, persistence, and SEO concerns.
 *
 * Architecture:
 *   - Self-contained: no imports from `@/components/*` or `@/hooks/*`. The
 *     house-style atoms (FOCUS, BOX, INPUT, Button, IconButton, CopyButton,
 *     Toggle, Choice, Field, Select, Num, Range, Badge, Bar, Section, Dialog,
 *     ErrorBanner, Note, Spinner, Stat) are rebuilt inside this file. The
 *     only project imports are the shared primitives from `../../_shared`
 *     (`DownloadButton`, `ErrorBanner`) — kept because the live repo's e2e
 *     tests import them and Law 5 forbids modifying `_shared`.
 *   - State: `usePersistentState` (localStorage-backed), `useUrlState`
 *     (URL hash-encoded), `useUndoRedo` (depth 50), `useToolHistory`
 *     (last 20 runs), `useKeyboardShortcuts`. All hooks rebuilt in-file.
 *   - One `aria-live="polite" aria-atomic` sr-only region. One skip link.
 *     One JSON-LD `@graph` (FAQPage + HowTo + SoftwareApplication +
 *     BreadcrumbList). One print stylesheet. One SVG visualisation.
 *   - The legacy `default export function BmiCalculator()` is preserved
 *     (Law 6 — the live tool-page-client.tsx imports it).
 */

"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button as ShadcnButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import {
  calculateBmiV2,
  weightScenariosCsv,
  fmt,
  REFERENCES,
  type BmiInput,
  type BmiOptions,
  type BmiResultV2,
  type BmiToolError,
  type BmrFormula,
  type MacroSplit,
  type UnitSystem,
  type Sex,
  type Result,
} from "./logic";

// ============================================================================
// House-style atoms (rebuilt per file per AGENTS.md).
// ============================================================================

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const BOX = "rounded-lg border bg-card p-4";
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`;

function Button({
  children,
  variant = "default",
  size = "sm",
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };
  return (
    <ShadcnButton
      variant={variant === "default" ? "default" : variant}
      size={size}
      className={`${base} ${variants[variant] ?? ""} ${className} ${FOCUS}`}
      {...rest}
    >
      {children}
    </ShadcnButton>
  );
}

function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${FOCUS}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function CopyButton({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Insecure context fallback.
      const ta = document.createElement("textarea");
      ta.value = getText();
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }, [getText]);
  return (
    <Button variant="outline" size="sm" onClick={onCopy} aria-label={label}>
      {copied ? "Copied!" : label}
    </Button>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-md border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1 text-xs ${
            value === o.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          } ${FOCUS}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {help && (
        <p id={`${htmlFor}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  id: string;
  label: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={INPUT}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Num({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  min,
  max,
  step,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
  ariaLabel: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={INPUT}
    />
  );
}

function Range({
  value,
  min,
  max,
  step,
  onChange,
  id,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  id: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`flex-1 ${FOCUS}`}
      />
      <span className="w-8 text-right text-xs tabular-nums">{value}</span>
    </div>
  );
}

function Badge2({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <Badge variant="outline" className={tone}>{children}</Badge>;
}

function Section({
  title,
  children,
  right,
  id,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={BOX} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mb-3 flex items-center justify-between">
        <h3 id={id ? `${id}-title` : undefined} className="text-sm font-semibold">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ============================================================================
// Storage helpers (string I/O — caller serialises).
// ============================================================================

const PREFIX = "unqtools:bmi-calculator";
const MAX_HISTORY = 20;
const MAX_PRESETS = 12;
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeLocalRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ============================================================================
// Hooks (rebuilt in-file per house style).
// ============================================================================

function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    const raw = safeLocalGet(key);
    if (raw === null) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        safeLocalSet(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );
  return [state, set];
}

function useUndoRedo<T>(
  initial: T,
  depth: number = 50,
  coalesceMs: number = 500,
): {
  state: T;
  set: (v: T | ((prev: T) => T)) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastCommit = useRef<number>(Date.now());

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        return next;
      });
    },
    [],
  );

  const commit = useCallback(() => {
    const now = Date.now();
    if (now - lastCommit.current < coalesceMs) {
      lastCommit.current = now;
      return;
    }
    lastCommit.current = now;
    setState((cur) => {
      past.current.push(cur);
      if (past.current.length > depth) past.current.shift();
      future.current = [];
      return cur;
    });
  }, [depth, coalesceMs]);

  const undo = useCallback(() => {
    setState((cur) => {
      const prev = past.current.pop();
      if (prev === undefined) return cur;
      future.current.push(cur);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState((cur) => {
      const next = future.current.pop();
      if (next === undefined) return cur;
      past.current.push(cur);
      return next;
    });
  }, []);

  return {
    state,
    set,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  input: BmiInput;
  options: BmiOptions;
  bmi: number;
  categoryLabel: string;
  pinned: boolean;
}

function useToolHistory(toolId: string) {
  const key = `${PREFIX}:${toolId}:history`;
  const [history, setHistory] = usePersistentState<HistoryEntry[]>(key, []);
  const record = useCallback(
    (entry: Omit<HistoryEntry, "id" | "timestamp" | "pinned">) => {
      setHistory((prev) => {
        const next: HistoryEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          pinned: false,
        };
        // Deduplicate consecutive identical entries.
        if (prev.length > 0 && prev[0].bmi === next.bmi && prev[0].input.height === next.input.height && prev[0].input.weight === next.input.weight) {
          return prev;
        }
        const pinned = prev.filter((h) => h.pinned);
        const unpinned = prev.filter((h) => !h.pinned);
        const updated = [next, ...unpinned].slice(0, MAX_HISTORY);
        const keptPinned = pinned.filter((p) => !updated.some((u) => u.id === p.id));
        return [...keptPinned, ...updated];
      });
    },
    [setHistory],
  );
  const pin = useCallback(
    (id: string) => {
      setHistory((prev) =>
        prev.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h)),
      );
    },
    [setHistory],
  );
  const remove = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((h) => h.id !== id));
    },
    [setHistory],
  );
  const clearAll = useCallback(() => {
    setHistory((prev) => prev.filter((h) => h.pinned));
  }, [setHistory]);
  return { history, record, pin, remove, clearAll };
}

// ============================================================================
// URL state (deep-link for non-sensitive inputs — height/weight/age/sex are
// not secrets, so URL encoding is allowed per F055).
// ============================================================================

interface UrlState {
  h?: string;
  w?: string;
  u?: UnitSystem;
  a?: string;
  s?: Sex;
  wa?: string;
  hip?: string;
  bf?: string;
  ac?: boolean;
  bmr?: BmrFormula;
  ms?: MacroSplit;
  dp?: 0 | 1 | 2 | 3;
}

function encodeUrlState(s: UrlState): string {
  const parts: string[] = [];
  if (s.h) parts.push(`h=${encodeURIComponent(s.h)}`);
  if (s.w) parts.push(`w=${encodeURIComponent(s.w)}`);
  if (s.u) parts.push(`u=${s.u}`);
  if (s.a) parts.push(`a=${encodeURIComponent(s.a)}`);
  if (s.s) parts.push(`s=${s.s}`);
  if (s.wa) parts.push(`wa=${encodeURIComponent(s.wa)}`);
  if (s.hip) parts.push(`hip=${encodeURIComponent(s.hip)}`);
  if (s.bf) parts.push(`bf=${encodeURIComponent(s.bf)}`);
  if (s.ac) parts.push(`ac=1`);
  if (s.bmr) parts.push(`bmr=${s.bmr}`);
  if (s.ms) parts.push(`ms=${s.ms}`);
  if (s.dp !== undefined && s.dp !== 1) parts.push(`dp=${s.dp}`);
  return parts.length ? `#${parts.join("&")}` : "";
}

function decodeUrlState(hash: string): UrlState {
  const s: UrlState = {};
  if (!hash || !hash.startsWith("#")) return s;
  const body = hash.slice(1);
  for (const pair of body.split("&")) {
    const [k, v] = pair.split("=");
    if (!k || v === undefined) continue;
    const dec = decodeURIComponent(v);
    if (k === "h") s.h = dec;
    else if (k === "w") s.w = dec;
    else if (k === "u") s.u = (dec === "imperial" ? "imperial" : "metric") as UnitSystem;
    else if (k === "a") s.a = dec;
    else if (k === "s") s.s = (dec === "male" ? "male" : dec === "female" ? "female" : undefined) as Sex | undefined;
    else if (k === "wa") s.wa = dec;
    else if (k === "hip") s.hip = dec;
    else if (k === "bf") s.bf = dec;
    else if (k === "ac") s.ac = dec === "1";
    else if (k === "bmr") s.bmr = dec as BmrFormula;
    else if (k === "ms") s.ms = dec as MacroSplit;
    else if (k === "dp") s.dp = (Number(dec) as 0 | 1 | 2 | 3) ?? 1;
  }
  return s;
}

// ============================================================================
// Built-in presets (F030 — at least 3, we ship 6).
// ============================================================================

interface Preset {
  id: string;
  name: string;
  description: string;
  input: BmiInput;
  options: BmiOptions;
}

const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "adult-male-30",
    name: "Adult male 30y",
    description: "175 cm, 80 kg, male, age 30 — Mifflin-St Jeor, balanced macros",
    input: { height: 175, weight: 80, unitSystem: "metric", age: 30, sex: "male", waistCm: 88 },
    options: { bmrFormula: "mifflin", macroSplit: "balanced", decimalPrecision: 1 },
  },
  {
    id: "adult-female-28",
    name: "Adult female 28y",
    description: "165 cm, 60 kg, female, age 28 — Mifflin-St Jeor, balanced macros",
    input: { height: 165, weight: 60, unitSystem: "metric", age: 28, sex: "female", waistCm: 72 },
    options: { bmrFormula: "mifflin", macroSplit: "balanced", decimalPrecision: 1 },
  },
  {
    id: "teen-athlete-15",
    name: "Teen athlete 15y",
    description: "170 cm, 65 kg, male, age 15 — CDC BMI-for-age percentile",
    input: { height: 170, weight: 65, unitSystem: "metric", age: 15, sex: "male" },
    options: { bmrFormula: "mifflin", macroSplit: "high-protein", decimalPrecision: 1 },
  },
  {
    id: "child-10",
    name: "Child 10y",
    description: "140 cm, 35 kg, age 10 — CDC BMI-for-age percentile (no adult category)",
    input: { height: 140, weight: 35, unitSystem: "metric", age: 10, sex: "male" },
    options: { decimalPrecision: 1 },
  },
  {
    id: "adult-asian-40",
    name: "Adult Asian 40y (WPR cut-offs)",
    description: "170 cm, 75 kg, age 40 — uses WHO WPR 2004 Asian cut-offs",
    input: { height: 170, weight: 75, unitSystem: "metric", age: 40, sex: "male", waistCm: 90 },
    options: { asianCutoffs: true, bmrFormula: "mifflin", macroSplit: "low-carb", decimalPrecision: 1 },
  },
  {
    id: "imperial-us",
    name: "Imperial (US)",
    description: "5'9\" (69 in), 170 lb — imperial units, Mifflin-St Jeor",
    input: { height: 69, weight: 170, unitSystem: "imperial", age: 35, sex: "male", waistCm: 86 },
    options: { bmrFormula: "mifflin", macroSplit: "balanced", decimalPrecision: 1 },
  },
];

// ============================================================================
// SVG BMI scale (F079 — visualisation, pure SVG, no chart library).
// ============================================================================

function BmiScale({
  bmi,
  asianCutoffs,
  precision,
}: {
  bmi: number;
  asianCutoffs: boolean;
  precision: number;
}) {
  // Scale from 15 to 40.
  const MIN = 15;
  const MAX = 40;
  const WIDTH = 600;
  const HEIGHT = 60;
  const clampedBmi = Math.max(MIN, Math.min(MAX, bmi));
  const x = (v: number) => ((v - MIN) / (MAX - MIN)) * WIDTH;

  // Boundaries: underweight / normal / overweight / obese I / obese II / obese III
  const boundaries = asianCutoffs
    ? [18.5, 23, 27.5, 32.5, 37.5]
    : [18.5, 25, 30, 35, 40];

  // Colours for each segment (light variants).
  const segColors = ["#3b82f6", "#10b981", "#f59e0b", "#f97316", "#f97316", "#ef4444"];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT + 30}`}
      className="w-full h-auto"
      role="img"
      aria-label={`BMI scale: your BMI is ${fmt(bmi, precision)}, marked on a 15 to 40 gradient.`}
    >
      {/* Segments */}
      {segColors.map((c, i) => {
        const segMin = i === 0 ? MIN : boundaries[i - 1];
        const segMax = i === segColors.length - 1 ? MAX : boundaries[i];
        return (
          <rect
            key={i}
            x={x(segMin)}
            y={10}
            width={x(segMax) - x(segMin)}
            height={30}
            fill={c}
            opacity={0.65}
          />
        );
      })}
      {/* Boundary lines + labels */}
      {boundaries.map((b) => (
        <g key={b}>
          <line x1={x(b)} y1={5} x2={x(b)} y2={45} stroke="currentColor" strokeWidth={1} opacity={0.5} />
          <text x={x(b)} y={58} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.7}>
            {b}
          </text>
        </g>
      ))}
      {/* User marker */}
      <line
        x1={x(clampedBmi)}
        y1={0}
        x2={x(clampedBmi)}
        y2={50}
        stroke="currentColor"
        strokeWidth={2}
      />
      <polygon
        points={`${x(clampedBmi) - 6},0 ${x(clampedBmi) + 6},0 ${x(clampedBmi)},8`}
        fill="currentColor"
      />
      <text
        x={x(clampedBmi)}
        y={HEIGHT + 22}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fill="currentColor"
      >
        {fmt(bmi, precision)}
      </text>
    </svg>
  );
}

// ============================================================================
// Level → colour class map (UI-owned, not logic-owned — D7 fix).
// ============================================================================

const LEVEL_TO_BADGE_CLASS: Record<number, string> = {
  1: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  3: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  4: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  5: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  6: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

// ============================================================================
// Multi-format export (F021).
// ============================================================================

function exportTxt(r: BmiResultV2, input: BmiInput, options: BmiOptions): string {
  const lines: string[] = [];
  lines.push("BMI Calculator — Result");
  lines.push("========================");
  lines.push(`Generated: ${r.receipt.timestamp}`);
  lines.push(`Tool version: ${r.receipt.version}`);
  lines.push(`Input fingerprint: ${r.receipt.inputFingerprint}`);
  lines.push("");
  lines.push(`Height: ${input.height} ${input.unitSystem === "imperial" ? "in" : "cm"}`);
  lines.push(`Weight: ${input.weight} ${input.unitSystem === "imperial" ? "lb" : "kg"}`);
  if (input.age) lines.push(`Age: ${input.age}`);
  if (input.sex) lines.push(`Sex: ${input.sex}`);
  if (input.waistCm) lines.push(`Waist: ${input.waistCm} cm`);
  if (options.hipCm) lines.push(`Hip: ${options.hipCm} cm`);
  if (options.bodyFatPct) lines.push(`Body fat: ${options.bodyFatPct}%`);
  lines.push("");
  lines.push(`BMI: ${fmt(r.bmi, r.decimalPrecision)} (${r.category.label})`);
  lines.push(`Cut-off set: ${r.cutoffLabel} — ${r.cutoffSource}`);
  lines.push(`BMI Prime: ${fmt(r.bmiPrimeV2, r.decimalPrecision)}`);
  lines.push(`Healthy weight range: ${fmt(r.healthyWeightRange.min, r.decimalPrecision)}–${fmt(r.healthyWeightRange.max, r.decimalPrecision)} ${r.unitLabel}`);
  lines.push(`Weight delta to healthy: ${fmt(r.weightDeltaToHealthy.toMin, r.decimalPrecision)} to ${fmt(r.weightDeltaToHealthy.toMax, r.decimalPrecision)} ${r.unitLabel}`);
  lines.push(`Body Surface Area (Mosteller): ${fmt(r.bsa.mosteller, r.decimalPrecision)} m²`);
  lines.push(`Body Surface Area (Du Bois): ${fmt(r.bsa.duBois, r.decimalPrecision)} m²`);
  lines.push(`Body Surface Area (Haycock): ${fmt(r.bsa.haycock, r.decimalPrecision)} m²`);
  lines.push(`Ponderal Index: ${fmt(r.ponderalIndex, r.decimalPrecision)} kg/m³`);
  if (r.bmrValue) {
    lines.push("");
    lines.push(`BMR (${r.bmrFormula}): ${r.bmrValue} kcal/day`);
    lines.push(`TDEE sedentary: ${r.dailyCalories?.sedentary} kcal/day`);
    lines.push(`TDEE light: ${r.dailyCalories?.light} kcal/day`);
    lines.push(`TDEE moderate: ${r.dailyCalories?.moderate} kcal/day`);
    lines.push(`TDEE active: ${r.dailyCalories?.active} kcal/day`);
    lines.push(`TDEE very active: ${r.dailyCalories?.veryActive} kcal/day`);
    if (r.macros) {
      lines.push(`Maintenance macros (${options.macroSplit ?? "balanced"}): ${r.macros.carbs}g carbs, ${r.macros.protein}g protein, ${r.macros.fat}g fat`);
    }
  }
  if (r.bodyFatPctEstimated) {
    lines.push("");
    lines.push(`Body fat (Deurenberg estimate): ${r.bodyFatPctEstimated}%`);
  }
  if (r.idealWeight) {
    lines.push("");
    lines.push("Ideal weight (4 formulas):");
    lines.push(`  Devine: ${fmt(r.idealWeight.devine, r.decimalPrecision)} kg`);
    lines.push(`  Robinson: ${fmt(r.idealWeight.robinson, r.decimalPrecision)} kg`);
    lines.push(`  Miller: ${fmt(r.idealWeight.miller, r.decimalPrecision)} kg`);
    lines.push(`  Hamwi: ${fmt(r.idealWeight.hamwi, r.decimalPrecision)} kg`);
  }
  if (r.waistToHip) {
    lines.push("");
    lines.push(`Waist-to-hip ratio: ${fmt(r.waistToHip, 2)}`);
  }
  if (r.cdcPercentile !== undefined) {
    lines.push("");
    lines.push(`CDC BMI-for-age percentile: ${fmt(r.cdcPercentile, r.decimalPrecision)}%`);
  }
  lines.push("");
  lines.push("Validation report:");
  r.validations.forEach((v) => {
    lines.push(`  [${v.level.toUpperCase()}] ${v.code}: ${v.message}`);
  });
  lines.push("");
  lines.push("IMPORTANT: BMI is a screening tool, not a diagnostic of body fat or health.");
  lines.push("Consult a doctor for individual assessment.");
  return lines.join("\n");
}

function exportJson(r: BmiResultV2, input: BmiInput, options: BmiOptions): string {
  return JSON.stringify({ input, options, result: r, references: REFERENCES }, null, 2);
}

function exportCsv(r: BmiResultV2): string {
  const rows: string[] = ["Metric,Value,Unit"];
  const cell = (s: string | number) => {
    const str = String(s);
    return /^[=+\-@]/.test(str) ? `'${str}` : /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  rows.push(`${cell("BMI")},${cell(r.bmi)},${cell("kg/m²")}`);
  rows.push(`${cell("Category")},${cell(r.category.label)},${cell("")}`);
  rows.push(`${cell("BMI Prime")},${cell(r.bmiPrimeV2)},${cell("")}`);
  rows.push(`${cell("Healthy weight min")},${cell(r.healthyWeightRange.min)},${cell(r.unitLabel)}`);
  rows.push(`${cell("Healthy weight max")},${cell(r.healthyWeightRange.max)},${cell(r.unitLabel)}`);
  rows.push(`${cell("BSA Mosteller")},${cell(r.bsa.mosteller)},${cell("m²")}`);
  rows.push(`${cell("BSA Du Bois")},${cell(r.bsa.duBois)},${cell("m²")}`);
  rows.push(`${cell("BSA Haycock")},${cell(r.bsa.haycock)},${cell("m²")}`);
  rows.push(`${cell("Ponderal Index")},${cell(r.ponderalIndex)},${cell("kg/m³")}`);
  if (r.bmrValue) {
    rows.push(`${cell("BMR")},${cell(r.bmrValue)},${cell("kcal/day")}`);
    if (r.dailyCalories) {
      rows.push(`${cell("TDEE sedentary")},${cell(r.dailyCalories.sedentary)},${cell("kcal/day")}`);
      rows.push(`${cell("TDEE light")},${cell(r.dailyCalories.light)},${cell("kcal/day")}`);
      rows.push(`${cell("TDEE moderate")},${cell(r.dailyCalories.moderate)},${cell("kcal/day")}`);
      rows.push(`${cell("TDEE active")},${cell(r.dailyCalories.active)},${cell("kcal/day")}`);
      rows.push(`${cell("TDEE very active")},${cell(r.dailyCalories.veryActive)},${cell("kcal/day")}`);
    }
  }
  if (r.bodyFatPctEstimated) rows.push(`${cell("Body fat (Deurenberg)")},${cell(r.bodyFatPctEstimated)},${cell("%")}`);
  if (r.cdcPercentile !== undefined) rows.push(`${cell("CDC percentile")},${cell(r.cdcPercentile)},${cell("%")}`);
  return rows.join("\n");
}

function exportMarkdown(r: BmiResultV2, input: BmiInput, options: BmiOptions): string {
  const lines: string[] = [];
  lines.push(`# BMI Calculator — Result`);
  lines.push("");
  lines.push(`**Generated:** ${r.receipt.timestamp}  `);
  lines.push(`**Tool version:** ${r.receipt.version}  `);
  lines.push(`**Input fingerprint:** \`${r.receipt.inputFingerprint}\``);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`| Field | Value | Unit |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Height | ${input.height} | ${input.unitSystem === "imperial" ? "in" : "cm"} |`);
  lines.push(`| Weight | ${input.weight} | ${input.unitSystem === "imperial" ? "lb" : "kg"} |`);
  if (input.age) lines.push(`| Age | ${input.age} | years |`);
  if (input.sex) lines.push(`| Sex | ${input.sex} | |`);
  if (input.waistCm) lines.push(`| Waist | ${input.waistCm} | cm |`);
  if (options.hipCm) lines.push(`| Hip | ${options.hipCm} | cm |`);
  if (options.bodyFatPct) lines.push(`| Body fat | ${options.bodyFatPct} | % |`);
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`| Metric | Value | Unit |`);
  lines.push(`|---|---|---|`);
  lines.push(`| **BMI** | **${fmt(r.bmi, r.decimalPrecision)}** | kg/m² |`);
  lines.push(`| Category | ${r.category.label} | |`);
  lines.push(`| Cut-off set | ${r.cutoffLabel} | |`);
  lines.push(`| BMI Prime | ${fmt(r.bmiPrimeV2, r.decimalPrecision)} | |`);
  lines.push(`| Healthy weight | ${fmt(r.healthyWeightRange.min, r.decimalPrecision)}–${fmt(r.healthyWeightRange.max, r.decimalPrecision)} | ${r.unitLabel} |`);
  lines.push(`| BSA (Mosteller) | ${fmt(r.bsa.mosteller, r.decimalPrecision)} | m² |`);
  lines.push(`| Ponderal Index | ${fmt(r.ponderalIndex, r.decimalPrecision)} | kg/m³ |`);
  if (r.bmrValue) lines.push(`| BMR (${r.bmrFormula}) | ${r.bmrValue} | kcal/day |`);
  if (r.bodyFatPctEstimated) lines.push(`| Body fat (Deurenberg) | ${r.bodyFatPctEstimated} | % |`);
  if (r.cdcPercentile !== undefined) lines.push(`| CDC percentile | ${fmt(r.cdcPercentile, r.decimalPrecision)} | % |`);
  lines.push("");
  lines.push("## Validation");
  lines.push("");
  r.validations.forEach((v) => {
    lines.push(`- **${v.level.toUpperCase()}** \`${v.code}\`: ${v.message}`);
  });
  lines.push("");
  lines.push("## References");
  lines.push("");
  REFERENCES.forEach((ref) => {
    lines.push(`- ${ref.citation} — ${ref.summary}`);
  });
  return lines.join("\n");
}

function exportHtml(r: BmiResultV2, input: BmiInput, options: BmiOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BMI Calculator — Result</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
h1, h2 { color: #b5562d; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
th { background: #faf9f5; }
code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; }
.warn { color: #b45309; }
.fail { color: #b91c1c; }
</style>
</head>
<body>
<h1>BMI Calculator — Result</h1>
<p>Generated: ${r.receipt.timestamp}<br>Tool version: ${r.receipt.version}<br>Input fingerprint: <code>${r.receipt.inputFingerprint}</code></p>
<h2>Result</h2>
<table>
<tr><th>Metric</th><th>Value</th><th>Unit</th></tr>
<tr><td><strong>BMI</strong></td><td><strong>${fmt(r.bmi, r.decimalPrecision)}</strong></td><td>kg/m²</td></tr>
<tr><td>Category</td><td>${r.category.label}</td><td></td></tr>
<tr><td>Cut-off set</td><td>${r.cutoffLabel}</td><td></td></tr>
<tr><td>BMI Prime</td><td>${fmt(r.bmiPrimeV2, r.decimalPrecision)}</td><td></td></tr>
<tr><td>Healthy weight</td><td>${fmt(r.healthyWeightRange.min, r.decimalPrecision)}–${fmt(r.healthyWeightRange.max, r.decimalPrecision)}</td><td>${r.unitLabel}</td></tr>
<tr><td>BSA (Mosteller)</td><td>${fmt(r.bsa.mosteller, r.decimalPrecision)}</td><td>m²</td></tr>
<tr><td>Ponderal Index</td><td>${fmt(r.ponderalIndex, r.decimalPrecision)}</td><td>kg/m³</td></tr>
${r.bmrValue ? `<tr><td>BMR (${r.bmrFormula})</td><td>${r.bmrValue}</td><td>kcal/day</td></tr>` : ""}
${r.bodyFatPctEstimated ? `<tr><td>Body fat (Deurenberg)</td><td>${r.bodyFatPctEstimated}</td><td>%</td></tr>` : ""}
${r.cdcPercentile !== undefined ? `<tr><td>CDC percentile</td><td>${fmt(r.cdcPercentile, r.decimalPrecision)}</td><td>%</td></tr>` : ""}
</table>
<h2>Validation</h2>
<ul>
${r.validations.map((v) => `<li class="${v.level === "fail" ? "fail" : v.level === "warn" ? "warn" : ""}"><strong>${v.level.toUpperCase()}</strong> <code>${v.code}</code>: ${v.message}</li>`).join("\n")}
</ul>
<h2>References</h2>
<ul>
${REFERENCES.map((ref) => `<li>${ref.citation} — ${ref.summary}</li>`).join("\n")}
</ul>
<p><em>BMI is a screening tool, not a diagnostic of body fat or health. Consult a doctor for individual assessment.</em></p>
</body>
</html>`;
}

function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// JSON-LD (F085–F092).
// ============================================================================

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "BMI Calculator",
      applicationCategory: "HealthApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description:
        "Privacy-first BMI calculator with WHO + Asian cut-offs, CDC BMI-for-age percentiles, BMR (3 formulas), TDEE, macros, body fat, ideal weight (4 formulas), and printable result. 100% client-side.",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is BMI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Body Mass Index (BMI) is a person's weight in kilograms divided by the square of their height in meters. It's a screening tool for weight categories: underweight (<18.5), normal (18.5-24.9), overweight (25-29.9), obese (>=30).",
          },
        },
        {
          "@type": "Question",
          name: "Is BMI accurate for everyone?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "BMI is a population-level screening tool, not a diagnostic of body fat or health. It overestimates fat in muscular athletes and underestimates fat in older adults who've lost muscle. Always consult a doctor for individual health assessments.",
          },
        },
        {
          "@type": "Question",
          name: "What are Asian-specific BMI cut-offs?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "WHO WPRO 2000 and WHO 2004 recommend that for Asian populations, overweight is BMI ≥ 23 and obese is ≥ 27.5, because Asian populations show cardiometabolic risk at lower BMI than the universal cut-offs (25 / 30).",
          },
        },
        {
          "@type": "Question",
          name: "How is BMI calculated for children?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "For children and teens ages 2-20, BMI is calculated the same way but interpreted using CDC BMI-for-age percentiles, not the adult categories. This tool uses the CDC 2000 LMS tables to compute the percentile.",
          },
        },
        {
          "@type": "Question",
          name: "Which BMR formula should I use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Mifflin-St Jeor (1990) is the recommended default. Harris-Benedict (1919) tends to overestimate by ~5%. Katch-McArdle (1975) is the most accurate if you know your body fat percentage, as it uses lean body mass.",
          },
        },
        {
          "@type": "Question",
          name: "Is my data sent anywhere?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. All calculations run in your browser. Nothing is sent to a server. History and presets are stored in localStorage on your device only.",
          },
        },
        {
          "@type": "Question",
          name: "What is BMI Prime?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "BMI Prime is your BMI divided by the upper bound of normal (25 for universal, 23 for Asian). A value of 1.0 means you're at the upper limit of normal; 1.2 means you're 20% above.",
          },
        },
        {
          "@type": "Question",
          name: "What is the waist-to-height ratio?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Waist-to-height ratio (WHtR) is waist circumference divided by height. A value above 0.5 indicates increased cardiometabolic risk. It's a better predictor of cardiovascular risk than BMI alone.",
          },
        },
      ],
    },
    {
      "@type": "HowTo",
      name: "How to calculate your BMI",
      step: [
        { "@type": "HowToStep", position: 1, name: "Choose units", text: "Select metric (cm/kg) or imperial (in/lb)." },
        { "@type": "HowToStep", position: 2, name: "Enter height and weight", text: "Type your height and weight in the input fields." },
        { "@type": "HowToStep", position: 3, name: "Optional: enter age, sex, waist", text: "For BMR, TDEE, body fat, and waist-to-height ratio, provide age, biological sex, and waist circumference." },
        { "@type": "HowToStep", position: 4, name: "Choose options", text: "Toggle Asian cut-offs, BMR formula, macro split, and decimal precision as needed." },
        { "@type": "HowToStep", position: 5, name: "Read the result", text: "Your BMI, category, healthy weight range, and derived metrics appear live below." },
        { "@type": "HowToStep", position: 6, name: "Export or print", text: "Use Copy, Download (TXT/JSON/CSV/MD/HTML), or Print to save your result." },
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "/" },
        { "@type": "ListItem", position: 2, name: "Tools", item: "/tools" },
        { "@type": "ListItem", position: 3, name: "Calculators", item: "/category/calculators" },
        { "@type": "ListItem", position: 4, name: "BMI Calculator", item: "/tools/bmi-calculator" },
      ],
    },
  ],
};

// ============================================================================
// Main component.
// ============================================================================

export default function BmiCalculator() {
  // ----- Load URL state on mount -----
  const [urlLoaded, setUrlLoaded] = useState(false);
  const initialUrl = useRef<UrlState>({});
  useEffect(() => {
    if (urlLoaded) return;
    initialUrl.current = decodeUrlState(window.location.hash);
    setUrlLoaded(true);
  }, [urlLoaded]);

  const u = initialUrl.current;

  // ----- Input state -----
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(u.u ?? "metric");
  const [height, setHeight] = useState<string>(u.h ?? "170");
  const [weight, setWeight] = useState<string>(u.w ?? "70");
  const [age, setAge] = useState<string>(u.a ?? "");
  const [sex, setSex] = useState<Sex | "">(u.s ?? "");
  const [waistCm, setWaistCm] = useState<string>(u.wa ?? "");
  const [hipCm, setHipCm] = useState<string>(u.hip ?? "");
  const [bodyFatPct, setBodyFatPct] = useState<string>(u.bf ?? "");

  // ----- Options state -----
  const [asianCutoffs, setAsianCutoffs] = useState<boolean>(u.ac ?? false);
  const [bmrFormula, setBmrFormula] = useState<BmrFormula>(u.bmr ?? "mifflin");
  const [macroSplit, setMacroSplit] = useState<MacroSplit>(u.ms ?? "balanced");
  const [decimalPrecision, setDecimalPrecision] = useState<0 | 1 | 2 | 3>(u.dp ?? 1);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // ----- UI state -----
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [customPresets, setCustomPresets] = usePersistentState<Preset[]>(`${PREFIX}:presets`, []);
  const [draftRestored, setDraftRestored] = useState<boolean>(false);
  const [liveRegion, setLiveRegion] = useState<string>("");

  const { history, record, pin, remove, clearAll } = useToolHistory("default");

  // ----- Autosave draft (F062) -----
  useEffect(() => {
    if (!urlLoaded) return;
    const draft = {
      input: { height, weight, unitSystem, age, sex, waistCm, hipCm, bodyFatPct },
      options: { asianCutoffs, bmrFormula, macroSplit, decimalPrecision },
      ts: Date.now(),
    };
    safeLocalSet(`${PREFIX}:draft`, JSON.stringify(draft));
  }, [height, weight, unitSystem, age, sex, waistCm, hipCm, bodyFatPct, asianCutoffs, bmrFormula, macroSplit, decimalPrecision, urlLoaded]);

  // Restore draft on first mount if no URL state.
  useEffect(() => {
    if (!urlLoaded || draftRestored) return;
    if (u.h || u.w) {
      // URL state takes precedence.
      setDraftRestored(true);
      return;
    }
    const raw = safeLocalGet(`${PREFIX}:draft`);
    if (!raw) {
      setDraftRestored(true);
      return;
    }
    try {
      const draft = JSON.parse(raw);
      if (Date.now() - draft.ts > DRAFT_MAX_AGE) {
        safeLocalRemove(`${PREFIX}:draft`);
        setDraftRestored(true);
        return;
      }
      if (draft.input) {
        if (draft.input.height) setHeight(draft.input.height);
        if (draft.input.weight) setWeight(draft.input.weight);
        if (draft.input.unitSystem) setUnitSystem(draft.input.unitSystem);
        if (draft.input.age) setAge(draft.input.age);
        if (draft.input.sex) setSex(draft.input.sex);
        if (draft.input.waistCm) setWaistCm(draft.input.waistCm);
        if (draft.input.hipCm) setHipCm(draft.input.hipCm);
        if (draft.input.bodyFatPct) setBodyFatPct(draft.input.bodyFatPct);
      }
      if (draft.options) {
        if (draft.options.asianCutoffs) setAsianCutoffs(draft.options.asianCutoffs);
        if (draft.options.bmrFormula) setBmrFormula(draft.options.bmrFormula);
        if (draft.options.macroSplit) setMacroSplit(draft.options.macroSplit);
        if (draft.options.decimalPrecision) setDecimalPrecision(draft.options.decimalPrecision);
      }
    } catch {
      /* ignore malformed draft */
    }
    setDraftRestored(true);
  }, [urlLoaded, draftRestored, u.h, u.w]);

  // ----- URL state sync (F054) -----
  useEffect(() => {
    if (!urlLoaded) return;
    const url = encodeUrlState({
      h: height,
      w: weight,
      u: unitSystem,
      a: age || undefined,
      s: (sex || undefined) as Sex | undefined,
      wa: waistCm || undefined,
      hip: hipCm || undefined,
      bf: bodyFatPct || undefined,
      ac: asianCutoffs,
      bmr: bmrFormula,
      ms: macroSplit,
      dp: decimalPrecision,
    });
    window.history.replaceState(null, "", url || window.location.pathname);
  }, [height, weight, unitSystem, age, sex, waistCm, hipCm, bodyFatPct, asianCutoffs, bmrFormula, macroSplit, decimalPrecision, urlLoaded]);

  // ----- Compute (debounced, F043) -----
  const input: BmiInput = useMemo(
    () => ({
      height: Number(height) || 0,
      weight: Number(weight) || 0,
      unitSystem,
      age: age ? Number(age) : undefined,
      sex: sex || undefined,
      waistCm: waistCm ? Number(waistCm) : undefined,
    }),
    [height, weight, unitSystem, age, sex, waistCm],
  );

  const options: BmiOptions = useMemo(
    () => ({
      asianCutoffs,
      bmrFormula,
      macroSplit,
      decimalPrecision,
      bodyFatPct: bodyFatPct ? Number(bodyFatPct) : undefined,
      hipCm: hipCm ? Number(hipCm) : undefined,
    }),
    [asianCutoffs, bmrFormula, macroSplit, decimalPrecision, bodyFatPct, hipCm],
  );

  const [debouncedInput, setDebouncedInput] = useState(input);
  const [debouncedOptions, setDebouncedOptions] = useState(options);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedInput(input);
      setDebouncedOptions(options);
    }, 150);
    return () => clearTimeout(t);
  }, [input, options]);

  const resultV2 = useMemo<Result<BmiResultV2, BmiToolError> | null>(() => {
    if (!debouncedInput.height || !debouncedInput.weight) return null;
    return calculateBmiV2(debouncedInput, debouncedOptions);
  }, [debouncedInput, debouncedOptions]);

  // ----- Memoised result (F044 — identical input+options returns same object) -----
  const cached: BmiResultV2 | null = useMemo(() => {
    if (!resultV2 || !resultV2.ok) return null;
    return resultV2.value;
  }, [resultV2]);

  // ----- Effect: record to history + announce to SR -----
  useEffect(() => {
    if (!cached) return;
    record({
      input: debouncedInput,
      options: debouncedOptions,
      bmi: cached.bmi,
      categoryLabel: cached.category.label,
    });
    setLiveRegion(
      `BMI calculated: ${fmt(cached.bmi, cached.decimalPrecision)}, ${cached.category.label}.`,
    );
  }, [cached, debouncedInput, debouncedOptions, record]);

  // ----- Error from V2 path -----
  useEffect(() => {
    if (resultV2 && !resultV2.ok) {
      setError(resultV2.error.message + (resultV2.error.hint ? " " + resultV2.error.hint : ""));
    } else {
      setError(null);
    }
  }, [resultV2]);

  // ----- Actions -----
  const loadSample = useCallback(() => {
    setUnitSystem("metric");
    setHeight("175");
    setWeight("80");
    setAge("30");
    setSex("male");
    setWaistCm("88");
    setHipCm("96");
    setBodyFatPct("");
    setAsianCutoffs(false);
    setBmrFormula("mifflin");
    setMacroSplit("balanced");
    setDecimalPrecision(1);
  }, []);

  const clear = useCallback(() => {
    setHeight("");
    setWeight("");
    setAge("");
    setSex("");
    setWaistCm("");
    setHipCm("");
    setBodyFatPct("");
    setError(null);
  }, []);

  const resetDefaults = useCallback(() => {
    setAsianCutoffs(false);
    setBmrFormula("mifflin");
    setMacroSplit("balanced");
    setDecimalPrecision(1);
    setShowAdvanced(false);
  }, []);

  const loadPreset = useCallback((p: Preset) => {
    setUnitSystem(p.input.unitSystem ?? "metric");
    setHeight(String(p.input.height));
    setWeight(String(p.input.weight));
    setAge(p.input.age ? String(p.input.age) : "");
    setSex(p.input.sex ?? "");
    setWaistCm(p.input.waistCm ? String(p.input.waistCm) : "");
    if (p.options.bmrFormula) setBmrFormula(p.options.bmrFormula);
    if (p.options.macroSplit) setMacroSplit(p.options.macroSplit);
    if (p.options.asianCutoffs) setAsianCutoffs(p.options.asianCutoffs);
    if (p.options.decimalPrecision) setDecimalPrecision(p.options.decimalPrecision);
  }, []);

  const saveCustomPreset = useCallback(() => {
    if (customPresets.length >= MAX_PRESETS) return;
    const name = window.prompt("Preset name:");
    if (!name) return;
    const p: Preset = {
      id: `custom-${Date.now()}`,
      name,
      description: "User-saved preset",
      input,
      options,
    };
    setCustomPresets([...customPresets, p]);
  }, [customPresets, input, options, setCustomPresets]);

  const deleteCustomPreset = useCallback(
    (id: string) => {
      setCustomPresets(customPresets.filter((p) => p.id !== id));
    },
    [customPresets, setCustomPresets],
  );

  const clearAllData = useCallback(() => {
    if (!window.confirm("Clear all local data (history, presets, drafts)?")) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => safeLocalRemove(k));
    window.location.reload();
  }, []);

  // ----- Keyboard shortcuts (F052) -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "Enter") {
        e.preventDefault();
        // Already auto-computes; this is a no-op announcement.
        setLiveRegion("Recalculated.");
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        loadSample();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        clear();
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
      } else if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowHistory((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadSample, clear]);

  // ----- Inject JSON-LD -----
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(JSON_LD);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const heightLabel = unitSystem === "metric" ? "Height (cm)" : "Height (inches)";
  const weightLabel = unitSystem === "metric" ? "Weight (kg)" : "Weight (lb)";

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Skip link (F066) */}
      <a
        href="#bmi-output"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:rounded focus:border"
      >
        Skip to result
      </a>

      {/* Live region (F065) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveRegion}
      </div>

      {/* Header + privacy badge (F072) */}
      <Card className="print:hidden">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold">BMI Calculator</h2>
            <p className="text-xs text-muted-foreground">
              WHO + Asian cut-offs · CDC BMI-for-age · Mifflin-St Jeor · 100% client-side
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            <span aria-hidden="true" className="mr-1">🔒</span>
            Private — runs in your browser
          </Badge>
        </CardContent>
      </Card>

      {/* Input panel (F001) */}
      <Section title="Inputs" id="bmi-input" right={
        <Toggle<UnitSystem>
          value={unitSystem}
          onChange={setUnitSystem}
          label="Unit system"
          options={[
            { value: "metric", label: "Metric (cm/kg)" },
            { value: "imperial", label: "Imperial (in/lb)" },
          ]}
        />
      }>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label={heightLabel} htmlFor="bmi-height" help={unitSystem === "metric" ? "Range 30–300 cm" : "Range 12–120 in"}>
            <Num
              id="bmi-height"
              value={height}
              onChange={setHeight}
              ariaLabel="Height"
              placeholder={unitSystem === "metric" ? "170" : "67"}
              min={unitSystem === "metric" ? 30 : 12}
              max={unitSystem === "metric" ? 300 : 120}
            />
          </Field>
          <Field label={weightLabel} htmlFor="bmi-weight" help={unitSystem === "metric" ? "Range 2–500 kg" : "Range 5–1100 lb"}>
            <Num
              id="bmi-weight"
              value={weight}
              onChange={setWeight}
              ariaLabel="Weight"
              placeholder={unitSystem === "metric" ? "70" : "154"}
              min={unitSystem === "metric" ? 2 : 5}
              max={unitSystem === "metric" ? 500 : 1100}
            />
          </Field>
          <Field label="Age (optional)" htmlFor="bmi-age" help="Enables BMR, TDEE, body fat, and CDC percentile (ages 2–20)">
            <Num id="bmi-age" value={age} onChange={setAge} ariaLabel="Age in years" placeholder="30" min={0} max={120} />
          </Field>
          <Field label="Sex (optional)" htmlFor="bmi-sex" help="Affects BMR, body fat, and ideal weight">
            <div id="bmi-sex" className="flex gap-2">
              <Toggle<Sex | "">
                value={sex}
                onChange={(v) => setSex(v === "" ? "" : v)}
                label="Sex"
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
              />
              {sex && (
                <Button variant="ghost" size="sm" onClick={() => setSex("")} aria-label="Clear sex">
                  Clear
                </Button>
              )}
            </div>
          </Field>
          <Field label="Waist cm (optional)" htmlFor="bmi-waist" help="Enables waist-to-height and waist-to-hip ratios">
            <Num id="bmi-waist" value={waistCm} onChange={setWaistCm} ariaLabel="Waist circumference in cm" placeholder="85" min={20} max={300} />
          </Field>
          {showAdvanced && (
            <>
              <Field label="Hip cm (optional)" htmlFor="bmi-hip" help="Enables waist-to-hip ratio">
                <Num id="bmi-hip" value={hipCm} onChange={setHipCm} ariaLabel="Hip circumference in cm" placeholder="96" min={20} max={300} />
              </Field>
              <Field label="Body fat % (optional)" htmlFor="bmi-bf" help="Enables Katch-McArdle BMR (most accurate)">
                <Num id="bmi-bf" value={bodyFatPct} onChange={setBodyFatPct} ariaLabel="Body fat percentage" placeholder="18" min={3} max={60} />
              </Field>
            </>
          )}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap print:hidden">
          <Button onClick={() => setLiveRegion("Computed.")} aria-label="Calculate">Calculate</Button>
          <Button variant="ghost" onClick={loadSample}>Sample (Ctrl+S)</Button>
          <Button variant="ghost" onClick={clear}>Clear (Ctrl+L)</Button>
          <Button variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </Button>
          <Button variant="ghost" onClick={() => setShowHistory((v) => !v)}>History (Ctrl+H)</Button>
        </div>
      </Section>

      {/* Options panel (F025–F029) */}
      <Section title="Options" id="bmi-options" right={
        <Button variant="ghost" size="sm" onClick={resetDefaults}>Reset to defaults</Button>
      }>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Cut-off set" htmlFor="bmi-cutoff" help="Asian cut-offs use WHO WPR 2004 (≥23 / ≥27.5)">
            <Toggle<string>
              value={asianCutoffs ? "asian" : "universal"}
              onChange={(v) => setAsianCutoffs(v === "asian")}
              label="Cut-off set"
              options={[
                { value: "universal", label: "Universal (25/30)" },
                { value: "asian", label: "Asian (23/27.5)" },
              ]}
            />
          </Field>
          <Field label="BMR formula" htmlFor="bmi-bmr" help="Mifflin recommended; Katch-McArdle needs body fat %">
            <Select<BmrFormula>
              id="bmi-bmr"
              label="BMR formula"
              value={bmrFormula}
              onChange={setBmrFormula}
              options={[
                { value: "mifflin", label: "Mifflin-St Jeor (1990)" },
                { value: "harris-benedict", label: "Harris-Benedict (1919)" },
                { value: "katch-mcardle", label: "Katch-McArdle (1975)" },
              ]}
            />
          </Field>
          <Field label="Macro split" htmlFor="bmi-macros" help="Carb/protein/fat split for maintenance calories">
            <Select<MacroSplit>
              id="bmi-macros"
              label="Macro split"
              value={macroSplit}
              onChange={setMacroSplit}
              options={[
                { value: "balanced", label: "Balanced (50/30/20)" },
                { value: "low-carb", label: "Low-carb (40/30/30)" },
                { value: "keto", label: "Keto (5/20/75)" },
                { value: "high-protein", label: "High-protein (30/40/30)" },
              ]}
            />
          </Field>
          <Field label="Decimal precision" htmlFor="bmi-precision" help="Number of decimal places in displayed numbers">
            <Range
              id="bmi-precision"
              label="Decimal precision"
              value={decimalPrecision}
              min={0}
              max={3}
              step={1}
              onChange={(v) => setDecimalPrecision(v as 0 | 1 | 2 | 3)}
            />
          </Field>
        </div>
      </Section>

      {/* Preset bar (F030/F031) */}
      <Section title="Presets" id="bmi-presets" right={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={saveCustomPreset} disabled={customPresets.length >= MAX_PRESETS}>
            Save current
          </Button>
        </div>
      }>
        <div className="flex flex-wrap gap-2">
          {BUILT_IN_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadPreset(p)}
              title={p.description}
              className={`rounded-md border px-3 py-1.5 text-xs hover:bg-accent ${FOCUS}`}
            >
              {p.name}
            </button>
          ))}
          {customPresets.map((p) => (
            <div key={p.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => loadPreset(p)}
                title={p.description}
                className={`hover:underline ${FOCUS}`}
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => deleteCustomPreset(p.id)}
                aria-label={`Delete preset ${p.name}`}
                className={`text-muted-foreground hover:text-foreground ${FOCUS}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Error (F094/F096) */}
      {error && (
        <Card className="print:hidden">
          <CardContent className="p-4">
            <ErrorBanner message={error} />
          </CardContent>
        </Card>
      )}

      {/* Empty state (F096) */}
      {!resultV2 && !error && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Enter height and weight to see your BMI.</p>
            <p className="text-xs mt-1">Or click <strong>Sample</strong> to load example values.</p>
          </CardContent>
        </Card>
      )}

      {/* Output (F013) */}
      {cached && (
        <div id="bmi-output" className="space-y-4">
          {/* Metrics strip (F077) */}
          <Section title="Headline metrics" id="bmi-metrics" right={
            <div className="flex gap-2 print:hidden">
              <CopyButton label="Copy summary" getText={() => exportTxt(cached, debouncedInput, debouncedOptions)} />
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowExportMenu((v) => !v)}>
                  Download ▾
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-md border bg-background shadow-lg">
                    <button
                      type="button"
                      onClick={() => { downloadFile(`bmi-${Date.now()}.txt`, "text/plain", exportTxt(cached, debouncedInput, debouncedOptions)); setShowExportMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${FOCUS}`}
                    >
                      TXT (summary)
                    </button>
                    <button
                      type="button"
                      onClick={() => { downloadFile(`bmi-${Date.now()}.json`, "application/json", exportJson(cached, debouncedInput, debouncedOptions)); setShowExportMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${FOCUS}`}
                    >
                      JSON (full)
                    </button>
                    <button
                      type="button"
                      onClick={() => { downloadFile(`bmi-${Date.now()}.csv`, "text/csv", exportCsv(cached)); setShowExportMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${FOCUS}`}
                    >
                      CSV (table)
                    </button>
                    <button
                      type="button"
                      onClick={() => { downloadFile(`bmi-${Date.now()}.md`, "text/markdown", exportMarkdown(cached, debouncedInput, debouncedOptions)); setShowExportMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${FOCUS}`}
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => { downloadFile(`bmi-${Date.now()}.html`, "text/html", exportHtml(cached, debouncedInput, debouncedOptions)); setShowExportMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${FOCUS}`}
                    >
                      HTML (printable)
                    </button>
                    <button
                      type="button"
                      onClick={() => { downloadFile(`bmi-weight-scenarios-${Date.now()}.csv`, "text/csv", weightScenariosCsv(debouncedInput)); setShowExportMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${FOCUS}`}
                    >
                      CSV (weight scenarios)
                    </button>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.print()}>Print</Button>
            </div>
          }>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              <Stat label="Your BMI" value={<span className="text-2xl text-primary">{fmt(cached.bmi, cached.decimalPrecision)}</span>} sub="kg/m²" />
              <Stat label="Category" value={<Badge2 tone={LEVEL_TO_BADGE_CLASS[cached.category.level]}>{cached.category.label}</Badge2>} />
              <Stat label="BMI Prime" value={fmt(cached.bmiPrimeV2, cached.decimalPrecision)} sub={`Ratio to ${asianCutoffs ? "23" : "25"}`} />
              <Stat label="Healthy weight" value={`${fmt(cached.healthyWeightRange.min, cached.decimalPrecision)}–${fmt(cached.healthyWeightRange.max, cached.decimalPrecision)}`} sub={cached.unitLabel} />
              <Stat label="Ponderal Index" value={fmt(cached.ponderalIndex, cached.decimalPrecision)} sub="kg/m³" />
              <Stat label="BSA (Mosteller)" value={`${fmt(cached.bsa.mosteller, cached.decimalPrecision)} m²`} sub="body surface area" />
            </div>
          </Section>

          {/* Visualisation (F079) — SVG BMI scale */}
          <Section title="BMI scale" id="bmi-scale">
            <BmiScale bmi={cached.bmi} asianCutoffs={asianCutoffs} precision={cached.decimalPrecision} />
            <p className="text-xs text-muted-foreground mt-2">
              {asianCutoffs ? "Using WHO WPR 2004 Asian cut-offs (≥23 overweight, ≥27.5 obese)." : "Using WHO universal cut-offs (≥25 overweight, ≥30 obese)."}
              {" "}Scale shows BMI 15–40; values above 40 are clipped at the right edge.
            </p>
          </Section>

          {/* Risk + weight delta (F081) */}
          <Section title="Health risk & weight target" id="bmi-risk">
            <p className="text-sm">
              <strong className="text-foreground">Risk:</strong> {cached.category.risk}
            </p>
            <p className="text-sm mt-2">
              <strong className="text-foreground">Cut-off source:</strong> {cached.cutoffLabel} ({cached.cutoffSource})
            </p>
            <p className="text-sm mt-2">
              <strong className="text-foreground">Weight delta to healthy range:</strong>{" "}
              {cached.weightDeltaToHealthy.toMin > 0
                ? `Gain ${fmt(Math.abs(cached.weightDeltaToHealthy.toMin), cached.decimalPrecision)} ${cached.unitLabel} to reach minimum healthy BMI`
                : `Lose ${fmt(Math.abs(cached.weightDeltaToHealthy.toMin), cached.decimalPrecision)} ${cached.unitLabel} to reach maximum healthy BMI`}
              {" "}({fmt(Math.abs(cached.weightDeltaToHealthy.toMax), cached.decimalPrecision)} {cached.unitLabel} to reach the other bound).
            </p>
          </Section>

          {/* Detailed stats (F078) */}
          <Section title="Detailed metrics" id="bmi-detail">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <Stat label="BSA — Mosteller" value={`${fmt(cached.bsa.mosteller, cached.decimalPrecision)} m²`} sub="sqrt(h_cm × w_kg / 3600)" />
              <Stat label="BSA — Du Bois" value={`${fmt(cached.bsa.duBois, cached.decimalPrecision)} m²`} sub="0.007184 × h^0.725 × w^0.425" />
              <Stat label="BSA — Haycock" value={`${fmt(cached.bsa.haycock, cached.decimalPrecision)} m²`} sub="paediatric-accurate" />
              <Stat label="Ponderal Index" value={fmt(cached.ponderalIndex, cached.decimalPrecision)} sub="kg/m³ — corpulence" />
              {cached.bodyFatPctEstimated !== undefined && (
                <Stat label="Body fat (Deurenberg)" value={`${fmt(cached.bodyFatPctEstimated, cached.decimalPrecision)}%`} sub="estimated from BMI, age, sex" />
              )}
              {cached.bodyFatPctProvided !== undefined && (
                <Stat label="Body fat (provided)" value={`${fmt(cached.bodyFatPctProvided, cached.decimalPrecision)}%`} sub="user-entered" />
              )}
              {cached.waistToHip !== undefined && (
                <Stat label="Waist-to-hip" value={fmt(cached.waistToHip, 2)} sub={cached.waistToHip > (sex === "male" ? 0.9 : 0.85) ? "above WHO cutoff — abdominal obesity" : "below WHO cutoff"} />
              )}
              {cached.cdcPercentile !== undefined && (
                <Stat label="CDC percentile" value={`${fmt(cached.cdcPercentile, cached.decimalPrecision)}%`} sub="BMI-for-age (ages 2–20)" />
              )}
            </div>
          </Section>

          {/* Metabolic profile (BMR + TDEE + macros) */}
          {cached.bmrValue && cached.dailyCalories && (
            <Section title="Metabolic profile" id="bmi-metabolic" right={<Badge variant="outline" className="text-xs">{cached.bmrFormula}</Badge>}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="BMR" value={`${cached.bmrValue} kcal`} sub="at rest" />
                <Stat label="Sedentary" value={cached.dailyCalories.sedentary} sub="×1.2" />
                <Stat label="Light" value={cached.dailyCalories.light} sub="×1.375" />
                <Stat label="Moderate" value={cached.dailyCalories.moderate} sub="×1.55" />
                <Stat label="Active" value={cached.dailyCalories.active} sub="×1.725" />
                <Stat label="Very Active" value={cached.dailyCalories.veryActive} sub="×1.9" />
              </div>
              {cached.macros && (
                <p className="text-xs text-muted-foreground mt-3">
                  Maintenance macros ({macroSplit}): <strong>{cached.macros.carbs}g</strong> carbs, <strong>{cached.macros.protein}g</strong> protein, <strong>{cached.macros.fat}g</strong> fat
                  {" "}— at moderate activity ({cached.dailyCalories.moderate} kcal/day).
                </p>
              )}
            </Section>
          )}

          {/* Ideal weight (4 formulas) */}
          {cached.idealWeight && (
            <Section title="Ideal body weight" id="bmi-ideal" right={<Badge variant="outline" className="text-xs">{sex}</Badge>}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Devine (1974)" value={`${fmt(cached.idealWeight.devine, cached.decimalPrecision)} kg`} />
                <Stat label="Robinson (1983)" value={`${fmt(cached.idealWeight.robinson, cached.decimalPrecision)} kg`} />
                <Stat label="Miller (1983)" value={`${fmt(cached.idealWeight.miller, cached.decimalPrecision)} kg`} />
                <Stat label="Hamwi (1964)" value={`${fmt(cached.idealWeight.hamwi, cached.decimalPrecision)} kg`} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Four published formulas for "ideal" body weight based on height and sex. They disagree by ±2 kg typically — none is authoritative.
              </p>
            </Section>
          )}

          {/* Validation report (F083) */}
          <Section title="Validation & hints" id="bmi-validation">
            <ul className="space-y-1 text-xs">
              {cached.validations.map((v, i) => (
                <li key={i} className={`flex gap-2 ${v.level === "fail" ? "text-red-600 dark:text-red-400" : v.level === "warn" ? "text-yellow-700 dark:text-yellow-400" : "text-muted-foreground"}`}>
                  <span aria-hidden="true">{v.level === "pass" ? "✓" : v.level === "warn" ? "⚠" : "✗"}</span>
                  <span><strong>{v.code}:</strong> {v.message}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Limitations (D13 — visible in UI, not buried) */}
          <Section title="Limitations of BMI" id="bmi-limitations">
            <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
              <li><strong>Athletes:</strong> BMI overestimates body fat in muscular individuals (muscle is denser than fat).</li>
              <li><strong>Elderly:</strong> BMI underestimates body fat in older adults who have lost muscle mass.</li>
              <li><strong>Pregnant:</strong> BMI is not applicable during pregnancy.</li>
              <li><strong>Children (under 2):</strong> BMI-for-age is not defined; use weight-for-length charts instead.</li>
              <li><strong>Asian populations:</strong> WHO recommends lower cut-offs (≥23 / ≥27.5) — toggle "Asian" in Options.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2 italic">
              BMI is a screening tool, not a diagnostic of body fat or health. Consult a doctor for individual assessment.
            </p>
          </Section>

          {/* References (D14) */}
          <Section title="References" id="bmi-references">
            <ol className="space-y-1 text-xs text-muted-foreground list-decimal pl-4">
              {REFERENCES.map((ref) => (
                <li key={ref.id}><strong>{ref.citation}</strong> — {ref.summary}</li>
              ))}
            </ol>
          </Section>

          {/* Reproducibility receipt (F084) */}
          <Section title="Reproducibility receipt" id="bmi-receipt">
            <p className="text-xs text-muted-foreground font-mono">
              tool: {cached.receipt.tool} · version: {cached.receipt.version} · timestamp: {cached.receipt.timestamp} · fingerprint: {cached.receipt.inputFingerprint}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The fingerprint is a non-cryptographic hash of the inputs and options — it does <strong>not</strong> reveal the actual values.
            </p>
          </Section>

          {/* Privacy footer (F072) */}
          <Card className="print:hidden">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser. Nothing is sent to any server. History, presets, and drafts are stored in <code>localStorage</code> on this device only. <button type="button" onClick={clearAllData} className={`underline hover:text-foreground ${FOCUS}`}>Clear all local data</button>.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History drawer (F058/F059) */}
      {showHistory && (
        <div className="fixed inset-0 z-40 print:hidden" role="dialog" aria-modal="true" aria-label="History drawer">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistory(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">History (last {MAX_HISTORY})</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearAll}>Clear unpinned</Button>
                <IconButton label="Close history" onClick={() => setShowHistory(false)}>✕</IconButton>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet. Calculate a BMI to see it here.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">BMI {fmt(h.bmi, 1)} — {h.categoryLabel}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => pin(h.id)}
                          aria-label={h.pinned ? "Unpin" : "Pin"}
                          className={`px-1 ${FOCUS} ${h.pinned ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {h.pinned ? "★" : "☆"}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(h.id)}
                          aria-label="Remove entry"
                          className={`px-1 text-muted-foreground hover:text-foreground ${FOCUS}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {new Date(h.timestamp).toLocaleString()} · {h.input.height} {h.input.unitSystem === "imperial" ? "in" : "cm"} / {h.input.weight} {h.input.unitSystem === "imperial" ? "lb" : "kg"}
                      {h.input.age ? ` · age ${h.input.age}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => loadPreset({
                        id: h.id,
                        name: "restored",
                        description: "restored from history",
                        input: h.input,
                        options: h.options,
                      })}
                      className={`mt-2 underline hover:text-foreground ${FOCUS}`}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Command palette (F053) */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-40 print:hidden" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCommandPalette(false)} />
          <div className="absolute left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg bg-background border rounded-lg shadow-xl p-2">
            <input
              type="text"
              placeholder="Type a command or preset name…"
              autoFocus
              className={`w-full px-3 py-2 text-sm bg-transparent border-none outline-none ${FOCUS}`}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowCommandPalette(false);
              }}
            />
            <ul className="mt-2 max-h-72 overflow-y-auto text-sm">
              <li>
                <button type="button" onClick={() => { loadSample(); setShowCommandPalette(false); }} className={`block w-full px-3 py-2 text-left hover:bg-accent ${FOCUS}`}>
                  Load sample
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { clear(); setShowCommandPalette(false); }} className={`block w-full px-3 py-2 text-left hover:bg-accent ${FOCUS}`}>
                  Clear inputs
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { resetDefaults(); setShowCommandPalette(false); }} className={`block w-full px-3 py-2 text-left hover:bg-accent ${FOCUS}`}>
                  Reset options to defaults
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { setShowHistory(true); setShowCommandPalette(false); }} className={`block w-full px-3 py-2 text-left hover:bg-accent ${FOCUS}`}>
                  Open history
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { window.print(); setShowCommandPalette(false); }} className={`block w-full px-3 py-2 text-left hover:bg-accent ${FOCUS}`}>
                  Print result
                </button>
              </li>
              {BUILT_IN_PRESETS.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { loadPreset(p); setShowCommandPalette(false); }} className={`block w-full px-3 py-2 text-left hover:bg-accent ${FOCUS}`}>
                    Preset: {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">BMI Calculator — Result</h1>
        <p className="text-xs">{new Date().toLocaleString()}</p>
      </div>

      {/* Print stylesheet (F024) */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #bmi-output, #bmi-output * { visibility: visible; }
          #bmi-output { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

/* === END OF FILE === */
