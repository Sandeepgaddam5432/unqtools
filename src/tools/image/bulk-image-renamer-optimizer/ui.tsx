"use client";

/**
 * ===========================================================================
 * UI PART 1 of 4 — shell: types, constants, inline atoms, object-URL registry.
 * ===========================================================================
 *
 * Concatenate PARTS 1-4 in order to produce `ui.tsx`. This part carries the
 * main import block; PARTS 3 and 4 each add one short `./logic` line for the
 * few symbols only they need, and those lines are folded into this one at
 * assembly time (STATUS.md records it as the single merge step).
 *
 * The default export `BulkImageRenamerOptimizerUI` lives in PART 4 (D2: same
 * name, same default-export shape as the original).
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ORIGINAL UI ACTUALLY DID — read in full before rewriting
 * ---------------------------------------------------------------------------
 *
 * The original was 71 KB and looked complete: a drop zone, four settings
 * panels, an action bar, a stats dashboard, a preview table, a duplicates
 * panel, an EXIF inspector, a history panel and two modals. Reading it end to
 * end turned up three defects that were NOT in the original list of 18, all of
 * which are invisible from the outside.
 *
 * DEFECT 19 — FOLDER PATHS ARE THROWN AWAY, so "preserve folder structure"
 * cannot ever work.
 *
 *   The folder picker did exactly the right thing first: it read
 *   `webkitRelativePath` off every File into a `paths` array. Then it copied
 *   the files into a `new DataTransfer()` and passed `dt.files` on — and
 *   DataTransfer does not carry `webkitRelativePath`. The paths it had just
 *   collected were handed to a CustomEvent:
 *
 *       window.dispatchEvent(new CustomEvent("unqtools:bulk-image-paths", ...))
 *
 *   whose only listener is a module-level no-op with the comment "placeholder
 *   for future use". So `originalPath` was always just `file.name`, the nested
 *   directories were gone before anything could use them, and the "Preserve
 *   source folder structure in ZIP" switch — plus the tip text explaining how
 *   to use it — described behaviour that could not happen. That is defect 7,
 *   and this is its mechanism.
 *
 *   Fixed in PART 2: paths travel WITH each file, in one array of
 *   `{ file, path }` records. Nothing is ever copied through DataTransfer.
 *
 * DEFECT 20 — the worker request id is a shared mutable counter.
 *
 *       worker.postMessage({ id: processed, ... })
 *       const handler = (ev) => { if (ev.data.id === processed) ... }
 *
 *   `processed` is one closure variable incremented in a `finally`. The
 *   handler compares against its CURRENT value, not the value the job was sent
 *   with. This happens to work only because the loop is strictly sequential —
 *   which is to say it works only because defect 2 (the pool that never runs
 *   anything in parallel) is also present. Fix one bug and the other becomes a
 *   data-corruption bug: results get attached to the wrong files, so photos
 *   come out with each other's bytes under each other's names. Two defects
 *   were holding each other up.
 *
 *   Worse, immediately after transferring the bitmap the code calls
 *   `bitmap.close()` on a bitmap it no longer owns, and the main-thread
 *   fallback closes it a second time.
 *
 *   Fixed here by never hand-rolling this again: PART 4 drives the pool from
 *   `runBatch` in ENGINE PART 5, where each job carries its own immutable id.
 *
 * DEFECT 21 — a fabricated hash on the fallback path.
 *
 *       hash: entry.pHash ?? "0000000000000000"
 *
 *   When the main-thread fallback ran and no hash had been computed yet, a
 *   zero hash was invented. But the all-zero hash is a REAL value that means
 *   "this image is a flat, featureless block", and the duplicate finder treats
 *   equal hashes as matches. So unrelated files that merely failed to hash
 *   were reported to the user as visual duplicates of one another — in a panel
 *   offering to delete them. A measurement that did not happen must be absent,
 *   never faked (D20). ENGINE PART 4 returns `undefined` instead, and the UI
 *   says "not compared".
 *
 * Also confirmed here, with mechanisms:
 *
 *   - defect 13: the directory-drop walker pushes into `pending` WHILE
 *     `Promise.all(walks)` is already settling, and `readAll()` recurses
 *     without awaiting, so `readEntries` batches after the first are racing
 *     the resolve. Deep folders silently lost files. `readEntries` returns at
 *     most 100 entries per call, so this triggers on any folder over 100
 *     images — exactly the batch sizes this tool is for.
 *   - defect 15: `URL.createObjectURL(e.file)` is called in the table's render
 *     body, so every re-render minted a new URL and none were ever revoked.
 *     Each live URL pins its Blob in memory, so scrolling a 300-photo list
 *     leaked until the tab died. Same pattern in both modals.
 *   - defect 16: `peakMemory += blob.size` is a running TOTAL of every output
 *     ever produced. It only ever grows, it is shown as "Peak memory", and the
 *     same number is shown again as "MB processed". It also drives the cap
 *     check, so the batch stops on cumulative output rather than actual usage.
 *   - defect 6: "Progressive JPEG" was a real switch wired to a real config
 *     field that no encoder reads, because Canvas cannot emit progressive
 *     JPEG. It even had a `disabled` rule to look attentive.
 *   - the cap message says "Processing paused … then clear and continue", but
 *     nothing can resume: the queue is gone and `peakMemory` never falls.
 *   - the EXIF inspector was nearly unreachable: it renders only for the
 *     selected file, and selecting a file also opened the diff modal on top.
 *   - the table rendered every row with a full-size `<img>` thumbnail and no
 *     lazy loading, so 1,000 files meant 1,000 simultaneous decodes.
 *
 * ---------------------------------------------------------------------------
 * HOUSE RULES APPLIED
 * ---------------------------------------------------------------------------
 *
 * The original imported `Card`, `Label`, `Input`, `Button`, `Switch`,
 * `Slider`, `Badge`, `Textarea` from `@/components/ui/*` and `CopyButton`,
 * `DownloadButton`, `ErrorBanner` from `../../_shared`. Per house rules every
 * atom is rebuilt inline below and `../../_shared` is not touched, so this
 * tool has no cross-tool coupling. (`Textarea`, `CopyButton`, `AlertCircle`,
 * `Check`, `Plus`, `Minus`, `Copy` and `FileText` were imported and never
 * used — the recurring dead-import class.)
 *
 * ---------------------------------------------------------------------------
 * IMPORT BLOCK CORRECTION (found by re-reading ENGINE PART 5 in full, D22)
 * ---------------------------------------------------------------------------
 * The first version of this file imported `createMainThreadProcessor`, which
 * does not exist anywhere in the engine. The engine's shared single-pipeline
 * processor is `processBatchItem`, and `runBatch` already defaults to it, so
 * the import was both wrong and unnecessary — but a named import of a missing
 * export fails the BUILD, not the test suite, which is why it was worth
 * catching before assembly. Remembering an export name is not the same as
 * verifying its signature (D24).
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { toast } from "sonner";
import {
  Images,
  FileImage,
  FolderTree,
  Layers,
  Download,
  Share2,
  History,
  Eye,
  Settings2,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Calendar,
  Ruler,
  Type,
  Droplet,
  Gauge,
  RotateCcw,
  Hash,
  Trash2,
  Loader2,
  Ban,
  MapPin,
  Info,
  ArrowUp,
  ArrowDown,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  // rename
  applyRenamePattern,
  resolveConflictsSafe,
  buildOutputPath,
  sanitiseFilename,
  slugifyForSeo,
  MAX_NAME_BYTES,
  // batch
  runBatch,
  processBatchItem,
  buildTokenContext,
  planBatch,
  recommendedConcurrency,
  createMemoryLedger,
  createObjectUrlRegistry,
  // packaging
  packageBatch,
  buildZipArchive,
  buildZipFileName,
  buildSplitArchiveName,
  planArchiveSplits,
  generateAuditCsv,
  generateAuditJson,
  generateRunManifest,
  // metadata + hashing
  getExifData,
  hasGpsData,
  computeImageHashes,
  computeContentHash,
  findExactDuplicates,
  findSimilarImages,
  similarityPercent,
  // pipeline
  processImageDetailed,
  decodeToBitmap,
  isHeicFile,
  isGifFile,
  // config
  validateConfig,
  diffConfigs,
  encodeConfigToUrl,
  decodeConfigFromUrl,
  estimateSizeSavings,
  formatBytes,
  formatDuration,
  DEFAULT_CONFIG,
  STARTER_PRESETS,
  KNOWN_TOKENS,
  MEMORY_CAP_BYTES,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  WARN_TOTAL_BYTES,
  type RenameRule,
  type OptimizeOptions,
  type RenameOptimizeConfig,
  type ExifData,
  type ImageHashes,
  type OutputFormat,
  type CaseMode,
  type WatermarkPosition,
  type PreviewRow,
  type BatchFileInput,
  type BatchItemOutput,
  type BatchResult,
} from "./logic";

// ===========================================================================
// Constants
// ===========================================================================

/** Storage key kept EXACTLY as the original so existing history survives (D2). */
const HISTORY_KEY = "unqtools:bulk-image-renamer-optimizer:history";
const PRESET_KEY = "unqtools:bulk-image-renamer-optimizer:presets";
const DRAFT_KEY = "unqtools:bulk-image-renamer-optimizer:draft";

const MAX_HISTORY = 20;
const MAX_PRESETS = 12;
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * How many preview rows get real DOM.
 *
 * The original rendered every row, each with an `<img>` pointing at a fresh
 * object URL. At the 1,000-file limit that is 1,000 concurrent full-resolution
 * decodes, which is enough to take the tab down before the user has processed
 * anything. Rows past this limit still exist in every count, every export and
 * every ZIP — only their DOM is withheld, and the table says so (D11).
 */
const RENDER_LIMIT = 200;

/** Thumbnail edge in CSS pixels. */
const THUMB_PX = 40;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--ring] focus-visible:ring-offset-[--background]";
const BOX = "rounded-lg border border-[--border] bg-[--card]";
const INPUT =
  "h-9 w-full rounded-md border border-[--border] bg-[--background] px-3 text-sm text-[--foreground] placeholder:text-[--muted-foreground] disabled:opacity-50 disabled:cursor-not-allowed " +
  FOCUS;

// ===========================================================================
// Types
// ===========================================================================

/**
 * One queued image.
 *
 * `path` is the RELATIVE path including folders, captured at intake and never
 * reconstructed from `file.name` afterwards — see defect 19 above. It is the
 * single reason "preserve folder structure" can work at all.
 */
export interface FileEntry {
  id: string;
  file: File;
  path: string;

  /** Source pixel dimensions, read once at intake. */
  width?: number;
  height?: number;

  exif?: ExifData;
  exifError?: string;

  /**
   * Perceptual hashes of the SOURCE image. `undefined` means "not computed",
   * which is a different thing from a zero hash (defect 21).
   */
  hashes?: ImageHashes;
  /** SHA-256 of the source bytes, for exact-duplicate detection. */
  contentHash?: string;

  /** Populated by a run. */
  outputBlob?: Blob;
  outputWidth?: number;
  outputHeight?: number;
  outputFormat?: OutputFormat;
  quality?: number;
  keptOriginal?: boolean;
  warnings?: string[];
  error?: string;
  errorCode?: string;

  /** User-typed name that overrides the pattern for this one file. */
  manualName?: string;

  /** Excluded from processing and from the ZIP, but kept visible. */
  skipped?: boolean;
}

/**
 * Live run statistics.
 *
 * Every field here is MEASURED. `peakMemoryBytes` is a genuine high-water
 * mark from the engine's memory ledger, not the running total of output sizes
 * that the original displayed under the same label (defect 16). `bytesIn` and
 * `bytesOut` are separated, because "MB processed" meaning "sum of the outputs
 * so far" was simply the wrong number under the right name.
 */
export interface RunStats {
  processed: number;
  failed: number;
  skipped: number;
  total: number;
  bytesIn: number;
  bytesOut: number;
  filesPerSec: number;
  etaSec: number;
  peakMemoryBytes: number;
  startedAt: number;
  finishedAt?: number;
  cancelled: boolean;
}

export interface HistoryItem {
  ts: number;
  label: string;
  config: RenameOptimizeConfig;
  /** Real outcome of that run, so history is a record and not just a label. */
  fileCount?: number;
  savedBytes?: number;
}

export interface NamedPreset {
  name: string;
  config: RenameOptimizeConfig;
  ts: number;
}

/** Which heavy panel is open. Only one modal at a time, by construction. */
export type ModalKind = "none" | "diff" | "matrix" | "exif" | "savePreset";

// ===========================================================================
// Small helpers
// ===========================================================================

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Stable-ish unique id. Not security-sensitive. */
let idCounter = 0;
function nextId(prefix = "f"): string {
  idCounter += 1;
  return `${prefix}${idCounter.toString(36)}${Date.now().toString(36)}`;
}

function stamp(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
}

/** Trigger a browser download for a Blob, revoking the URL afterwards. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking immediately can cancel the download in some browsers; a short
  // delay is the accepted compromise. This is the ONLY place object URLs are
  // created outside the registry, and it cleans up after itself.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function downloadText(text: string, filename: string, mime: string): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

// ===========================================================================
// Object-URL registry hook (defect 15)
// ===========================================================================

/**
 * Hand out object URLs that are guaranteed to be revoked.
 *
 * The rule this enforces: a component may ask for the URL of a Blob as many
 * times as it likes and will always get the SAME string back, and every string
 * handed out is released when the component unmounts or when `revokeAll` is
 * called.
 *
 * That matters more than it sounds. An object URL is a strong reference: while
 * it is alive the browser cannot free the Blob behind it, even if nothing on
 * the page still points at that Blob. The original minted one per row per
 * render and revoked none, so simply scrolling the list pinned every source
 * photo in memory forever. For a batch of 300 phone photos that is several
 * gigabytes of unreleasable data, and the visible symptom is not a leak
 * warning — it is the tab dying, which reads to the user as "this tool cannot
 * handle my photos".
 */
function useObjectUrls() {
  const registryRef = useRef<ReturnType<typeof createObjectUrlRegistry> | null>(null);
  if (registryRef.current === null) {
    registryRef.current = createObjectUrlRegistry();
  }
  const cache = useRef(new WeakMap<Blob, string>());

  const urlFor = useCallback((blob: Blob | null | undefined): string | null => {
    if (!blob) return null;
    const existing = cache.current.get(blob);
    if (existing) return existing;
    const url = registryRef.current!.create(blob);
    cache.current.set(blob, url);
    return url;
  }, []);

  const release = useCallback((blob: Blob | null | undefined): void => {
    if (!blob) return;
    const existing = cache.current.get(blob);
    if (!existing) return;
    registryRef.current!.revoke(existing);
    cache.current.delete(blob);
  }, []);

  useEffect(() => {
    const registry = registryRef.current!;
    return () => {
      registry.revokeAll();
      cache.current = new WeakMap();
    };
  }, []);

  return { urlFor, release, revokeAll: () => registryRef.current!.revokeAll() };
}

// ===========================================================================
// Announcer (a11y)
// ===========================================================================

/**
 * One polite live region for the whole tool.
 *
 * Long batch jobs are the case where a screen-reader user is most likely to be
 * left guessing: the visible progress bar says everything and announces
 * nothing. Announcements are deliberately coarse — start, every 25 files,
 * finish, cancel, error — because a message per file would be unusable.
 */
function useAnnouncer() {
  const [message, setMessage] = useState("");
  const announce = useCallback((text: string) => setMessage(text), []);
  const node = (
    <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
      {message}
    </div>
  );
  return { announce, announcerNode: node };
}

// ===========================================================================
// Inline atoms
// ===========================================================================

type ButtonVariant = "primary" | "ghost" | "danger" | "outline";

function Button({
  children,
  onClick,
  disabled,
  variant = "outline",
  type = "button",
  className,
  title,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
    FOCUS;
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-[--primary] text-[--primary-foreground] hover:opacity-90",
    outline:
      "border border-[--border] bg-[--background] text-[--foreground] hover:bg-[--muted]",
    ghost: "text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]",
    danger:
      "border border-[--destructive] text-[--destructive] hover:bg-[--destructive] hover:text-[--primary-foreground]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cx(base, styles[variant], className)}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  label,
  disabled,
  danger,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        danger
          ? "text-[--muted-foreground] hover:bg-[--destructive] hover:text-[--primary-foreground]"
          : "text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]",
        FOCUS,
        className,
      )}
    >
      {children}
    </button>
  );
}

function CopyButton({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      onClick={() => {
        const text = getText();
        if (!text) return;
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          })
          .catch(() => toast.error("The browser blocked clipboard access."));
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs text-[--muted-foreground]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[--muted-foreground]">{hint}</p>}
    </div>
  );
}

/**
 * A switch that renders as a real checkbox.
 *
 * Custom toggles built from divs are the single most common way a settings
 * panel becomes unusable by keyboard. A native input is focusable, tabbable,
 * togglable with Space and correctly announced with no ARIA at all.
 *
 * `reason` exists because of D19: a control that cannot do anything right now
 * must say WHY it is disabled. The original disabled "Progressive JPEG" for
 * non-JPEG formats — implying it worked for JPEG, which it never did.
 */
function Toggle({
  id,
  checked,
  onChange,
  label,
  disabled,
  reason,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  reason?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cx("mt-0.5 h-4 w-4 accent-[--primary] disabled:opacity-50", FOCUS)}
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className={cx(
            "text-xs cursor-pointer select-none",
            disabled && "text-[--muted-foreground] cursor-not-allowed",
          )}
        >
          {label}
        </label>
        {disabled && reason && (
          <p className="text-[11px] text-[--muted-foreground]">{reason}</p>
        )}
      </div>
    </div>
  );
}

function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
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

/**
 * A numeric input that reports emptiness instead of coercing it.
 *
 * `Number("")` is 0, so the original's `Number(e.target.value)` turned a
 * cleared "Max dimension" box into a request to resize every image to zero
 * pixels. Empty is a distinct state and is passed up as `undefined`.
 */
function Num({
  id,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  disabled,
}: {
  id: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw.trim() === "") {
          onChange(undefined);
          return;
        }
        const n = Number(raw);
        if (!isFinite(n)) return;
        onChange(min != null && n < min ? min : max != null && n > max ? max : n);
      }}
      className={INPUT}
    />
  );
}

/** Range slider with its value in the label, so the number is never hidden. */
function Range({
  id,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cx("h-9 w-full accent-[--primary] disabled:opacity-50", FOCUS)}
    />
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-[--border] text-[--muted-foreground]",
    good: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
    warn: "border-amber-500 text-amber-700 dark:text-amber-300",
    bad: "border-[--destructive] text-[--destructive]",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded border px-1 py-0 text-[10px] leading-4 whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Determinate progress bar. Indeterminate state is a separate spinner. */
function Bar({ percent, warn }: { percent: number; warn?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[--muted]"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx(
          "h-full transition-all",
          warn ? "bg-[--destructive]" : "bg-[--primary]",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Collapsible section with a real disclosure button. */
function Section({
  icon,
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useMemo(() => nextId("sec"), []);
  return (
    <section className={cx(BOX, "p-4 space-y-3")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={cx("flex w-full items-center justify-between gap-2 text-left rounded", FOCUS)}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
          {badge}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div id={id} className="space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Modal dialog with focus trapping and Escape to close.
 *
 * The original modals were plain divs with `role="dialog"`: focus stayed on
 * whatever was behind them, Tab walked out into the page underneath, and
 * Escape did nothing. For a viewer opened from a table row that is a dead end
 * for anyone not using a mouse.
 */
function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          "w-full overflow-auto rounded-lg bg-[--background] p-4 shadow-lg max-h-[90vh]",
          wide ? "max-w-5xl" : "max-w-3xl",
          FOCUS,
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <IconButton onClick={onClose} label="Close dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
        {children}
        {footer && <div className="mt-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Inline error banner. Errors are sentences, not codes (D8). */
function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-[--destructive] bg-[--destructive]/10 p-3"
    >
      <TriangleAlert
        className="mt-0.5 h-4 w-4 shrink-0 text-[--destructive]"
        aria-hidden="true"
      />
      <p className="flex-1 text-xs text-[--foreground]">{message}</p>
      {onDismiss && (
        <IconButton onClick={onDismiss} label="Dismiss this message">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

/** Neutral note. Used for facts and limits, never for failures. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[--border] bg-[--muted]/40 p-2.5">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[--muted-foreground]" aria-hidden="true" />
      <p className="flex-1 text-[11px] text-[--muted-foreground]">{children}</p>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cx("h-3.5 w-3.5 animate-spin", className)}
      aria-hidden="true"
    />
  );
}

/** One labelled figure in the stats grid. */
function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  hint?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-[--destructive]"
          : "";
  return (
    <div className="rounded-md border border-[--border] p-2" title={hint}>
      <div className="text-[11px] text-[--muted-foreground]">{label}</div>
      <div className={cx("text-sm font-medium tabular-nums", toneClass)}>{value}</div>
    </div>
  );
}

/**
 * ===========================================================================
 * UI PART 2 of 4 — file intake.
 * ===========================================================================
 *
 * Everything between "the user drops something" and "the queue holds entries
 * with real paths, dimensions, EXIF and hashes".
 *
 * Depends on PART 1 for atoms, types and constants. Adds no imports.
 *
 * This part carries the fixes for defects 13, 19 and 22, all of which live in
 * intake, and all of which are invisible until you use the tool the way it is
 * advertised — by dropping a folder of a few hundred photos.
 */

// ===========================================================================
// Intake results
// ===========================================================================

/** One file plus the relative path it was found at. Paths never get separated
 *  from their file (defect 19). */
interface PickedFile {
  file: File;
  path: string;
}

/** A picked file with its queue id already assigned. See `useFileQueue`. */
interface IdentifiedFile extends PickedFile {
  id: string;
}

/** Why a file was not accepted. Always a full sentence the user can act on. */
interface Rejection {
  name: string;
  reason: string;
}

interface IntakeResult {
  accepted: PickedFile[];
  rejected: Rejection[];
  /** True when the walk stopped early because a hard limit was hit. */
  truncated: boolean;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;

/**
 * Is this plausibly an image we can open?
 *
 * `file.type` alone is not enough: files dragged from some archive tools and
 * most `.heic` files from a Windows filesystem arrive with an empty MIME type,
 * and the original's `f.type.startsWith("image/")` check dropped them silently
 * with the unhelpful message "No image files found in the selection." The
 * extension is the fallback, and being wrong here is cheap — a non-image that
 * gets through fails to decode and is reported per file.
 */
function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(file.name);
}

// ===========================================================================
// Directory walking (defect 13)
// ===========================================================================

/** Hard cap on directory recursion, to stop a symlink loop from hanging the tab. */
const MAX_WALK_DEPTH = 12;

/**
 * Read a directory completely.
 *
 * `readEntries` is the API that makes folder drops unreliable when it is used
 * naively, and it is worth being precise about why. It does NOT return the
 * directory's contents. It returns *up to* an implementation-defined batch —
 * 100 entries in Chromium — and you are required to call it again, on the same
 * reader, until it hands back an empty array. Every call after the first
 * returns the next batch.
 *
 * The original called it inside a self-recursive `readAll()` that never
 * awaited, and pushed the child walks into a `pending` array that
 * `Promise.all(walks)` had already begun settling over. So the first 100
 * entries of any directory were processed and everything after them was in a
 * race it usually lost. A folder of 80 photos worked perfectly; a folder of
 * 300 quietly imported some fraction of them, differing run to run. Nothing
 * errored — the user just got fewer files than they dropped, which is the kind
 * of bug people blame on themselves.
 *
 * Here the loop is explicit and awaited: keep asking until empty, then stop.
 */
async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(
        (entries) => resolve(Array.from(entries)),
        (err) => reject(err),
      );
    });
    if (batch.length === 0) return all;
    all.push(...batch);
    // Defensive: a pathological directory should not be able to grow this
    // array without bound.
    if (all.length > MAX_FILES * 4) return all;
  }
}

/** Promisified `FileSystemFileEntry.file`. */
function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(
      (f) => resolve(f),
      (err) => reject(err),
    );
  });
}

/**
 * Walk one dropped entry, depth-first, collecting files with their paths.
 *
 * `out` is mutated in place and the walk is fully awaited by the caller, so
 * there is no window in which a consumer can observe a partial result — the
 * exact failure the original had.
 */
async function walkEntry(
  entry: FileSystemEntry,
  prefix: string,
  out: PickedFile[],
  rejected: Rejection[],
  depth: number,
): Promise<void> {
  if (out.length >= MAX_FILES) return;

  if (entry.isFile) {
    try {
      const file = await entryToFile(entry as FileSystemFileEntry);
      const path = prefix ? `${prefix}/${file.name}` : file.name;
      if (looksLikeImage(file)) {
        out.push({ file, path });
      }
      // Non-images inside a dropped folder are skipped silently and on
      // purpose: a photo folder legitimately contains Thumbs.db, .DS_Store
      // and sidecar files, and listing them as rejections would bury the
      // rejections that matter.
    } catch {
      rejected.push({
        name: prefix ? `${prefix}/${entry.name}` : entry.name,
        reason:
          "The browser could not open this file. It may have been moved or renamed since the folder was opened.",
      });
    }
    return;
  }

  if (!entry.isDirectory) return;

  if (depth >= MAX_WALK_DEPTH) {
    rejected.push({
      name: entry.name,
      reason: `This folder is nested more than ${MAX_WALK_DEPTH} levels deep, so its contents were not read.`,
    });
    return;
  }

  const dir = entry as FileSystemDirectoryEntry;
  const nextPrefix = prefix ? `${prefix}/${dir.name}` : dir.name;

  let children: FileSystemEntry[];
  try {
    children = await readAllDirectoryEntries(dir.createReader());
  } catch {
    rejected.push({
      name: nextPrefix,
      reason:
        "The browser could not read this folder. Try choosing it with the folder button instead of dragging it.",
    });
    return;
  }

  for (const child of children) {
    if (out.length >= MAX_FILES) return;
    await walkEntry(child, nextPrefix, out, rejected, depth + 1);
  }
}

/**
 * Collect files from a drop event.
 *
 * The synchronous snapshot at the top is load-bearing. A `DataTransferItemList`
 * is only valid during the event handler that received it: the moment control
 * returns to the browser — which is to say, at the first `await` — the list is
 * emptied. So every `webkitGetAsEntry()` has to happen before anything is
 * awaited, and only then can the walk begin. Getting this backwards produces a
 * bug that reads as "folder drops work sometimes", because a warm cache can
 * let a short synchronous path finish first.
 */
async function collectFromDrop(dataTransfer: DataTransfer): Promise<IntakeResult> {
  const entries: FileSystemEntry[] = [];
  const items = dataTransfer.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item.webkitGetAsEntry !== "function") continue;
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  // Plain-file fallback for browsers without the entries API. Snapshot this
  // synchronously too, for the same reason.
  const plainFiles = Array.from(dataTransfer.files ?? []);

  const accepted: PickedFile[] = [];
  const rejected: Rejection[] = [];

  if (entries.length > 0) {
    for (const entry of entries) {
      await walkEntry(entry, "", accepted, rejected, 0);
    }
  } else {
    for (const file of plainFiles) {
      if (accepted.length >= MAX_FILES) break;
      if (looksLikeImage(file)) accepted.push({ file, path: file.name });
    }
  }

  return { accepted, rejected, truncated: accepted.length >= MAX_FILES };
}

/**
 * Collect files from an `<input type="file">`, including the folder picker.
 *
 * `webkitRelativePath` is read straight off each File and kept alongside it.
 * The original read the same property, then dropped the files through a
 * `new DataTransfer()` — which does not preserve it — and tried to reunite
 * names with paths afterwards through a CustomEvent whose listener did
 * nothing. There is no reason to separate them in the first place.
 */
function collectFromInput(fileList: FileList | null): IntakeResult {
  const accepted: PickedFile[] = [];
  const rejected: Rejection[] = [];
  if (!fileList || fileList.length === 0) {
    return { accepted, rejected, truncated: false };
  }
  for (const file of Array.from(fileList)) {
    if (accepted.length >= MAX_FILES) break;
    if (!looksLikeImage(file)) continue;
    const relative =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    accepted.push({ file, path: relative || file.name });
  }
  return {
    accepted,
    rejected,
    truncated: accepted.length >= MAX_FILES && fileList.length > accepted.length,
  };
}

// ===========================================================================
// Limits and de-duplication
// ===========================================================================

/** Identity of a file for de-duplication purposes. */
function dedupeKey(path: string, file: File): string {
  return `${path}\u0000${file.size}\u0000${file.lastModified}`;
}

interface LimitOutcome {
  admitted: IdentifiedFile[];
  rejected: Rejection[];
  duplicatesSkipped: number;
  /** Set when the batch is large enough to be worth warning about. */
  sizeWarning?: string;
}

/**
 * Apply the queue limits.
 *
 * The limits are refusals, not silent clamps: a file that is too large is
 * named and explained rather than dropped, because "I dropped 200 photos and
 * 197 appeared" is a far worse experience than "3 photos were too large, here
 * they are". D9 — input that cannot be handled is reported, never discarded
 * quietly.
 *
 * Pure: same inputs, same outputs, no side effects. It is called from the
 * reducer, so this matters.
 */
function applyIntakeLimits(
  existing: FileEntry[],
  incoming: IdentifiedFile[],
): LimitOutcome {
  const rejected: Rejection[] = [];
  const admitted: IdentifiedFile[] = [];
  let duplicatesSkipped = 0;

  const seen = new Set<string>();
  for (const entry of existing) {
    seen.add(dedupeKey(entry.path, entry.file));
  }

  let totalBytes = existing.reduce((sum, e) => sum + e.file.size, 0);
  let count = existing.length;

  for (const picked of incoming) {
    if (count >= MAX_FILES) {
      rejected.push({
        name: picked.path,
        reason: `The queue is limited to ${MAX_FILES} files. Process and clear the current batch, then add the rest.`,
      });
      continue;
    }

    const key = dedupeKey(picked.path, picked.file);
    if (seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }

    if (picked.file.size === 0) {
      rejected.push({
        name: picked.path,
        reason: "This file is empty (0 bytes), so there is nothing to process.",
      });
      continue;
    }

    if (picked.file.size > MAX_FILE_BYTES) {
      rejected.push({
        name: picked.path,
        reason: `This file is ${formatBytes(picked.file.size)}, above the ${formatBytes(MAX_FILE_BYTES)} per-file limit.`,
      });
      continue;
    }

    if (totalBytes + picked.file.size > MAX_TOTAL_BYTES) {
      rejected.push({
        name: picked.path,
        reason: `Adding this file would take the queue past the ${formatBytes(MAX_TOTAL_BYTES)} total limit.`,
      });
      continue;
    }

    seen.add(key);
    admitted.push(picked);
    totalBytes += picked.file.size;
    count += 1;
  }

  let sizeWarning: string | undefined;
  if (totalBytes > WARN_TOTAL_BYTES) {
    sizeWarning = `This batch is ${formatBytes(totalBytes)}. Large batches are slower and use a lot of memory — if the tab becomes unresponsive, process in smaller groups.`;
  }

  return { admitted, rejected, duplicatesSkipped, sizeWarning };
}

// ===========================================================================
// Metadata extraction
// ===========================================================================

/** What intake learns about a file before any processing happens. */
interface EntryMetadata {
  width?: number;
  height?: number;
  exif?: ExifData;
  exifError?: string;
  hashes?: ImageHashes;
  contentHash?: string;
}

/**
 * Read dimensions, EXIF and hashes for one file.
 *
 * Two rules are enforced here, and both come from earlier mistakes:
 *
 * 1. Hashes come from the SOURCE bitmap, always. A perceptual hash taken after
 *    resizing describes the output, not the photograph — so it changes when an
 *    unrelated setting changes, and two copies of one image at two sizes stop
 *    matching. A fingerprint that moves is not a fingerprint.
 *
 * 2. A failed measurement is absent, never invented. If hashing fails,
 *    `hashes` stays `undefined` and the duplicates panel says "not compared".
 *    The original substituted the all-zero hash, which is a real value meaning
 *    "flat featureless image" — so files that merely failed to hash were shown
 *    to the user as visual duplicates of each other, in a panel that offers to
 *    remove duplicates (defect 21, D20).
 *
 * Nothing here throws: intake must never fail as a whole because one file in
 * three hundred is damaged.
 */
async function extractMetadata(file: File): Promise<EntryMetadata> {
  const meta: EntryMetadata = {};

  // EXIF first — it is cheap, it needs the File (not a bitmap), and its
  // orientation field is needed before anything renders the image.
  try {
    const exifResult = await getExifData(file);
    if (exifResult.ok) {
      meta.exif = exifResult.output;
    } else {
      meta.exifError = exifResult.error;
    }
  } catch (err) {
    meta.exifError = err instanceof Error ? err.message : String(err);
  }

  // Content hash of the raw bytes, for exact-duplicate detection. This is
  // independent of decoding, so a file that cannot be decoded can still be
  // recognised as byte-identical to another.
  try {
    meta.contentHash = await computeContentHash(file);
  } catch {
    /* absent, not faked */
  }

  // Decode last, and release the bitmap in a finally. `decodeToBitmap` owns
  // the HEIC path, so this works for formats `createImageBitmap` refuses.
  let bitmap: ImageBitmap | null = null;
  try {
    const decoded = await decodeToBitmap(file);
    if (decoded.ok) {
      bitmap = decoded.output.bitmap;
      meta.width = bitmap.width;
      meta.height = bitmap.height;
      try {
        meta.hashes = await computeImageHashes(bitmap);
      } catch {
        /* absent, not faked */
      }
    }
  } catch {
    /* the run itself will report a decode failure per file */
  } finally {
    bitmap?.close();
  }

  return meta;
}

/**
 * Run metadata extraction over many files with a bounded number in flight.
 *
 * DEFECT 22 — unbounded intake decoding.
 *
 *   The original kicked off extraction for every new file at once:
 *
 *       for (const entry of newEntries) {
 *         decodeMetadata(entry).then((meta) => setEntries(...));
 *       }
 *
 *   Dropping 400 photos therefore started 400 simultaneous decodes, each
 *   holding a full-resolution bitmap. A 12-megapixel photo is about 48 MB
 *   decoded, so that is nominally nineteen gigabytes of live bitmaps competing
 *   for the same heap — before the user has pressed Process. The tool would
 *   often die at the moment files were added, which looks like "it cannot even
 *   open my photos".
 *
 *   Each `.then` also called `setEntries` on its own, so those 400 decodes
 *   produced 400 separate React state updates, each re-rendering a table that
 *   rendered every row with a fresh object URL.
 *
 *   Fixed on both counts: at most `concurrency` decodes are alive at any
 *   moment, and results are flushed to React in batches on a short timer.
 */
async function runMetadataQueue(
  targets: Array<{ id: string; file: File }>,
  concurrency: number,
  flush: (updates: Array<{ id: string; meta: EntryMetadata }>) => void,
  signal: { cancelled: boolean },
): Promise<void> {
  let cursor = 0;
  let buffer: Array<{ id: string; meta: EntryMetadata }> = [];
  let timer: number | null = null;

  const flushNow = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    flush(batch);
  };

  const scheduleFlush = () => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      flushNow();
    }, 120);
  };

  const lanes = Math.max(1, Math.min(concurrency, targets.length));
  const workers: Array<Promise<void>> = [];

  for (let lane = 0; lane < lanes; lane++) {
    workers.push(
      (async () => {
        for (;;) {
          if (signal.cancelled) return;
          const index = cursor;
          cursor += 1;
          if (index >= targets.length) return;
          const target = targets[index]!;
          const meta = await extractMetadata(target.file);
          if (signal.cancelled) return;
          buffer.push({ id: target.id, meta });
          scheduleFlush();
        }
      })(),
    );
  }

  await Promise.all(workers);
  flushNow();
}

// ===========================================================================
// Queue state
// ===========================================================================

/** A message to surface once, then forget. */
interface Notice {
  key: number;
  kind: "success" | "info" | "error";
  text: string;
}

interface QueueState {
  entries: FileEntry[];
  rejections: Rejection[];
  scanning: boolean;
  /** How many files still need metadata. Drives the intake progress line. */
  pendingMetadata: number;
  sizeWarning?: string;
  /** Files admitted but not yet handed to the metadata queue. */
  metaQueue: Array<{ id: string; file: File }>;
  notice?: Notice;
}

type QueueAction =
  | { type: "scanStart" }
  | { type: "scanFailed"; message: string }
  | { type: "add"; picked: IdentifiedFile[]; rejected: Rejection[] }
  | { type: "metaClaimed" }
  | { type: "metaResults"; updates: Array<{ id: string; meta: EntryMetadata }> }
  | { type: "patch"; id: string; patch: Partial<FileEntry> }
  | { type: "patchMany"; patches: Array<{ id: string; patch: Partial<FileEntry> }> }
  | { type: "remove"; id: string }
  | { type: "toggleSkip"; id: string }
  | { type: "move"; id: string; delta: number }
  | { type: "reorder"; fromId: string; toId: string }
  | { type: "sort"; key: "name" | "size" | "date"; direction: 1 | -1 }
  | { type: "clear" }
  | { type: "dismissRejections" }
  | { type: "noticeConsumed" };

let noticeCounter = 0;
function notice(kind: Notice["kind"], text: string): Notice {
  noticeCounter += 1;
  return { key: noticeCounter, kind, text };
}

const INITIAL_QUEUE: QueueState = {
  entries: [],
  rejections: [],
  scanning: false,
  pendingMetadata: 0,
  metaQueue: [],
};

/**
 * The whole queue as one pure transition function.
 *
 * SELF-REVIEW FIX — side effects do not belong in a state updater.
 *
 * The first version of this file computed intake inside a `setState(prev => ...)`
 * callback and, from inside that same callback, started the metadata queue and
 * fired the toast. That is a real bug, not a style preference. React treats
 * updaters as pure functions it may call more than once for a single update —
 * StrictMode does it deliberately in development, and concurrent rendering can
 * replay an update that gets interrupted. Either one would have started the
 * bounded metadata queue TWICE for the same files: double the decodes, double
 * the peak memory, `pendingMetadata` counted down twice as fast so the intake
 * progress line finished early and wrong, and two toasts.
 *
 * The bitter part is what that bug was: unbounded duplicate decoding at
 * intake, which is defect 22 — the one this file exists to fix, reintroduced
 * a few lines below the comment explaining it. Knowing the failure mode is not
 * the same as not causing it, which is why the review step is not optional
 * (D25).
 *
 * So the reducer is pure and only ever computes state. Admitted files land in
 * `metaQueue` and a `useEffect` drains it; user-facing messages land in
 * `notice` and a `useEffect` shows them. Running an effect twice is now
 * harmless, because the work is claimed out of state before it starts.
 */
function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "scanStart":
      return { ...state, scanning: true };

    case "scanFailed":
      return { ...state, scanning: false, notice: notice("error", action.message) };

    case "add": {
      const outcome = applyIntakeLimits(state.entries, action.picked);
      const rejections = [...state.rejections, ...action.rejected, ...outcome.rejected].slice(-50);

      if (outcome.admitted.length === 0) {
        const text =
          action.rejected.length + outcome.rejected.length > 0
            ? "No files were added — see the list below for why."
            : outcome.duplicatesSkipped > 0
              ? `Those ${outcome.duplicatesSkipped} file${outcome.duplicatesSkipped === 1 ? " is" : "s are"} already in the queue.`
              : "No images were found in that selection.";
        return {
          ...state,
          scanning: false,
          rejections,
          sizeWarning: outcome.sizeWarning ?? state.sizeWarning,
          notice: notice("info", text),
        };
      }

      const newEntries: FileEntry[] = outcome.admitted.map((picked) => ({
        id: picked.id,
        file: picked.file,
        path: picked.path,
      }));

      const text = `Added ${newEntries.length} image${newEntries.length === 1 ? "" : "s"}${
        outcome.duplicatesSkipped > 0
          ? `, skipped ${outcome.duplicatesSkipped} already in the queue`
          : ""
      }.`;

      return {
        ...state,
        scanning: false,
        entries: [...state.entries, ...newEntries],
        rejections,
        pendingMetadata: state.pendingMetadata + newEntries.length,
        sizeWarning: outcome.sizeWarning,
        metaQueue: [
          ...state.metaQueue,
          ...newEntries.map((e) => ({ id: e.id, file: e.file })),
        ],
        notice: notice("success", text),
      };
    }

    case "metaClaimed":
      return state.metaQueue.length === 0 ? state : { ...state, metaQueue: [] };

    case "metaResults": {
      const byId = new Map(action.updates.map((u) => [u.id, u.meta]));
      return {
        ...state,
        pendingMetadata: Math.max(0, state.pendingMetadata - action.updates.length),
        entries: state.entries.map((entry) => {
          const meta = byId.get(entry.id);
          return meta ? { ...entry, ...meta } : entry;
        }),
      };
    }

    case "patch":
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e,
        ),
      };

    case "patchMany": {
      if (action.patches.length === 0) return state;
      const byId = new Map(action.patches.map((p) => [p.id, p.patch]));
      return {
        ...state,
        entries: state.entries.map((e) => {
          const patch = byId.get(e.id);
          return patch ? { ...e, ...patch } : e;
        }),
      };
    }

    case "remove": {
      const target = state.entries.find((e) => e.id === action.id);
      const stillPending = target != null && target.width == null && target.exif == null;
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== action.id),
        // A removed file that never got its metadata would otherwise leave
        // `pendingMetadata` stuck above zero forever.
        pendingMetadata: stillPending
          ? Math.max(0, state.pendingMetadata - 1)
          : state.pendingMetadata,
      };
    }

    case "toggleSkip":
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.id ? { ...e, skipped: !e.skipped } : e,
        ),
      };

    case "move": {
      const from = state.entries.findIndex((e) => e.id === action.id);
      if (from < 0) return state;
      const to = Math.max(0, Math.min(state.entries.length - 1, from + action.delta));
      if (to === from) return state;
      const next = state.entries.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return { ...state, entries: next };
    }

    case "reorder": {
      const from = state.entries.findIndex((e) => e.id === action.fromId);
      const to = state.entries.findIndex((e) => e.id === action.toId);
      if (from < 0 || to < 0 || from === to) return state;
      const next = state.entries.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return { ...state, entries: next };
    }

    case "sort": {
      const { key, direction } = action;
      const next = state.entries.slice().sort((a, b) => {
        let result: number;
        if (key === "size") {
          result = a.file.size - b.file.size;
        } else if (key === "date") {
          result = a.file.lastModified - b.file.lastModified;
        } else {
          // Natural sort, so IMG_2.jpg comes before IMG_10.jpg. Plain
          // lexicographic order on photo filenames is almost never what
          // anyone means, and here it silently decides the numbering.
          result = a.path.localeCompare(b.path, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        return result * direction;
      });
      return { ...state, entries: next };
    }

    case "clear":
      return { ...INITIAL_QUEUE, notice: notice("info", "Cleared the queue.") };

    case "dismissRejections":
      return { ...state, rejections: [] };

    case "noticeConsumed":
      return state.notice ? { ...state, notice: undefined } : state;

    default:
      return state;
  }
}

// ===========================================================================
// Queue hook
// ===========================================================================

/**
 * The file queue: intake, metadata, removal, reordering, manual renames.
 *
 * All entry mutation goes through here, so there is exactly one place where the
 * queue can change and exactly one place that has to be right about paths.
 */
function useFileQueue(announce: (text: string) => void) {
  const [state, dispatch] = useReducer(queueReducer, INITIAL_QUEUE);

  /** Cancels in-flight metadata work when the queue is cleared or unmounted. */
  const metaSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    const signal = metaSignalRef.current;
    return () => {
      signal.cancelled = true;
    };
  }, []);

  // --- Drain the metadata queue -------------------------------------------
  //
  // The work is claimed out of state first, so a double-invoked effect finds
  // an empty queue on its second pass and does nothing.
  useEffect(() => {
    if (state.metaQueue.length === 0) return;
    const targets = state.metaQueue;
    dispatch({ type: "metaClaimed" });
    const signal = metaSignalRef.current;
    void runMetadataQueue(
      targets,
      recommendedConcurrency(),
      (updates) => dispatch({ type: "metaResults", updates }),
      signal,
    );
  }, [state.metaQueue]);

  // --- Surface notices ----------------------------------------------------
  useEffect(() => {
    const current = state.notice;
    if (!current) return;
    announce(current.text);
    if (current.kind === "success") toast.success(current.text);
    else if (current.kind === "error") toast.error(current.text);
    else toast.info(current.text);
    dispatch({ type: "noticeConsumed" });
  }, [state.notice, announce]);

  // --- Intake -------------------------------------------------------------
  //
  // Ids are minted here, in an event handler, rather than in the reducer:
  // `nextId()` advances a module counter, which would make the reducer impure
  // for the same reason the old code was wrong.
  const identify = useCallback(
    (picked: PickedFile[]): IdentifiedFile[] =>
      picked.map((p) => ({ ...p, id: nextId("e") })),
    [],
  );

  const addFromDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      dispatch({ type: "scanStart" });
      announce("Reading the dropped folder…");
      try {
        const result = await collectFromDrop(dataTransfer);
        dispatch({
          type: "add",
          picked: identify(result.accepted),
          rejected: result.rejected,
        });
        if (result.truncated) toast.info(`Stopped at the ${MAX_FILES}-file limit.`);
      } catch {
        dispatch({
          type: "scanFailed",
          message:
            "That drop could not be read. Try the Choose files button instead.",
        });
      }
    },
    [announce, identify],
  );

  const addFromInput = useCallback(
    (fileList: FileList | null) => {
      const result = collectFromInput(fileList);
      dispatch({
        type: "add",
        picked: identify(result.accepted),
        rejected: result.rejected,
      });
      if (result.truncated) toast.info(`Stopped at the ${MAX_FILES}-file limit.`);
    },
    [identify],
  );

  // --- Mutations ----------------------------------------------------------
  const patchEntry = useCallback(
    (id: string, patch: Partial<FileEntry>) => dispatch({ type: "patch", id, patch }),
    [],
  );

  const patchMany = useCallback(
    (patches: Array<{ id: string; patch: Partial<FileEntry> }>) =>
      dispatch({ type: "patchMany", patches }),
    [],
  );

  const removeEntry = useCallback(
    (id: string) => {
      dispatch({ type: "remove", id });
      announce("Removed one file from the queue.");
    },
    [announce],
  );

  const toggleSkip = useCallback(
    (id: string) => dispatch({ type: "toggleSkip", id }),
    [],
  );

  /**
   * Move an entry.
   *
   * Order is not cosmetic here — it decides `{index}` and `{counter}` in every
   * generated name, so reordering is a rename operation. It is exposed through
   * buttons as well as drag and drop, because drag-only reordering is unusable
   * by keyboard and this is the one control whose effect the user cannot
   * achieve any other way.
   */
  const moveEntry = useCallback(
    (id: string, delta: number) => {
      dispatch({ type: "move", id, delta });
      announce(delta < 0 ? "Moved up." : "Moved down.");
    },
    [announce],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) => dispatch({ type: "reorder", fromId, toId }),
    [],
  );

  const sortBy = useCallback(
    (key: "name" | "size" | "date", direction: 1 | -1) => {
      dispatch({ type: "sort", key, direction });
      announce(`Sorted by ${key}, ${direction === 1 ? "ascending" : "descending"}.`);
    },
    [announce],
  );

  const clearAll = useCallback(() => {
    metaSignalRef.current.cancelled = true;
    metaSignalRef.current = { cancelled: false };
    dispatch({ type: "clear" });
  }, []);

  const dismissRejections = useCallback(
    () => dispatch({ type: "dismissRejections" }),
    [],
  );

  return {
    entries: state.entries,
    rejections: state.rejections,
    scanning: state.scanning,
    pendingMetadata: state.pendingMetadata,
    sizeWarning: state.sizeWarning,
    addFromDrop,
    addFromInput,
    patchEntry,
    patchMany,
    removeEntry,
    toggleSkip,
    moveEntry,
    reorder,
    sortBy,
    clearAll,
    dismissRejections,
  };
}

// ===========================================================================
// Drop zone
// ===========================================================================

function DropZone({
  onDrop,
  onFiles,
  scanning,
  disabled,
}: {
  onDrop: (dataTransfer: DataTransfer) => void;
  onFiles: (files: FileList | null) => void;
  scanning: boolean;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const depthRef = useRef(0);

  return (
    <section className={cx(BOX, "p-4")}>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          // dragenter/dragleave fire for every child element the pointer
          // crosses, so a naive handler flickers the highlight constantly.
          // Counting depth is the reliable way to know when the pointer has
          // actually left the zone.
          depthRef.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          depthRef.current -= 1;
          if (depthRef.current <= 0) {
            depthRef.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          depthRef.current = 0;
          setDragging(false);
          if (disabled) return;
          // Hand the DataTransfer over synchronously. The collector snapshots
          // the item list before its first await, because the list is emptied
          // as soon as this handler returns.
          onDrop(e.dataTransfer);
        }}
        className={cx(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-[--primary] bg-[--primary]/5" : "border-[--border]",
          disabled && "opacity-60",
        )}
      >
        {scanning ? (
          <>
            <Spinner className="mx-auto h-6 w-6 text-[--primary]" />
            <p className="mt-2 text-sm text-[--muted-foreground]">
              Reading folder contents…
            </p>
          </>
        ) : (
          <FileImage
            className="mx-auto mb-2 h-8 w-8 text-[--muted-foreground]"
            aria-hidden="true"
          />
        )}

        {!scanning && (
          <p className="mb-3 text-sm text-[--muted-foreground]">
            Drag images or a whole folder here, or choose them below. Nested
            folders are read in full.
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || scanning}
          >
            <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
            Choose files
          </Button>
          <Button
            onClick={() => folderInputRef.current?.click()}
            disabled={disabled || scanning}
          >
            <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
            Choose folder
          </Button>
        </div>

        <p className="mt-3 text-[11px] text-[--muted-foreground]">
          Up to {MAX_FILES} files, {formatBytes(MAX_FILE_BYTES)} each,{" "}
          {formatBytes(MAX_TOTAL_BYTES)} in total. JPEG, PNG, WebP, GIF, BMP,
          TIFF and HEIC are read; JPEG, PNG and WebP can be written.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          aria-label="Choose image files"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            // Reset so picking the same file twice still fires a change event.
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          aria-label="Choose a folder of images"
          // @ts-expect-error webkitdirectory is not in the standard typings
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

// ===========================================================================
// Rejection list
// ===========================================================================

/**
 * Files that were not accepted, and why.
 *
 * This panel exists so that intake can never be lossy in silence. The original
 * collapsed every possible problem into one sentence — "No image files found
 * in the selection." — and only when nothing at all got through; partial
 * losses produced no message whatsoever.
 */
function RejectionPanel({
  rejections,
  onDismiss,
}: {
  rejections: Rejection[];
  onDismiss: () => void;
}) {
  if (rejections.length === 0) return null;
  return (
    <section className={cx(BOX, "p-4 space-y-2")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <TriangleAlert
            className="h-4 w-4 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          Not added ({rejections.length})
        </h2>
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {rejections.map((r, i) => (
          <li key={`${r.name}-${i}`} className="text-[11px]">
            <span className="font-mono break-all">{r.name}</span>
            <span className="text-[--muted-foreground]"> — {r.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * ===========================================================================
 * UI PART 3 of 4 — config state, offer banners, settings panels, presets.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-2-UI-PART-2.tsx. Shares PART 1's module scope, so
 * every atom (`Button`, `Field`, `Toggle`, `Select`, `Num`, `Range`, `Section`,
 * `Dialog`, `Note`, `ErrorBanner`, `Badge`), every constant (`INPUT`, `FOCUS`,
 * `BOX`, `DRAFT_KEY`, `PRESET_KEY`, `MAX_PRESETS`, `DRAFT_MAX_AGE`) and every
 * helper (`cx`, `nextId`) is used directly.
 *
 * ASSEMBLY NOTE: PART 1 carries the shared import block. These five symbols
 * are needed only here, so they are imported at the top of this part; at
 * assembly time fold this line into PART 1's `./logic` import and delete it.
 * STATUS.md records this as the one merge step for the UI.
 */
import {
  findUnknownTokens,
  sanitiseRelativePath,
  type ResizeMode,
  type ReplaceRule,
  type TokenContext,
} from "./logic";

// ===========================================================================
// Option lists
// ===========================================================================

const FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string }> = [
  { value: "image/jpeg", label: "JPEG — smallest for photos" },
  { value: "image/webp", label: "WebP — smaller again, modern browsers" },
  { value: "image/png", label: "PNG — lossless, keeps transparency" },
];

const CASE_OPTIONS: Array<{ value: CaseMode; label: string }> = [
  { value: "none", label: "Leave as-is" },
  { value: "lower", label: "lowercase" },
  { value: "upper", label: "UPPERCASE" },
  { value: "kebab", label: "kebab-case" },
  { value: "snake", label: "snake_case" },
  { value: "title", label: "Title Case" },
  { value: "sentence", label: "Sentence case" },
  { value: "seo", label: "seo-slug (accents folded)" },
];

const RESIZE_OPTIONS: Array<{ value: ResizeMode; label: string }> = [
  { value: "longest", label: "Limit the longest edge" },
  { value: "width", label: "Fixed width, height follows" },
  { value: "height", label: "Fixed height, width follows" },
  { value: "fit", label: "Fit inside a box (nothing cropped)" },
  { value: "cover", label: "Fill a box exactly (centre-cropped)" },
  { value: "percent", label: "Scale by percentage" },
];

const WATERMARK_OPTIONS: Array<{ value: WatermarkPosition; label: string }> = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
  { value: "center", label: "Centre" },
];

/** Short label for each token chip, so the palette is readable at a glance. */
const TOKEN_HINTS: Record<string, string> = {
  "{index}": "1, 2, 3 …",
  "{counter}": "zero-padded counter",
  "{counter:folder}": "counter restarting per folder",
  "{original}": "the original name",
  "{ext}": "original extension, no dot",
  "{date}": "file date",
  "{exif:date}": "date the photo was taken",
  "{width}": "source width",
  "{height}": "source height",
  "{size}": "source bytes",
  "{sizekb}": "source size in KB",
  "{mp}": "megapixels",
  "{orientation}": "landscape / portrait / square",
  "{aspect}": "16x9, 4x3 …",
  "{parent}": "parent folder name",
  "{random:6}": "6 seeded random chars",
  "{exif:make}": "camera make",
  "{exif:model}": "camera model",
  "{exif:iso}": "ISO",
  "{exif:fnumber}": "aperture",
  "{exif:exposure}": "shutter speed",
  "{exif:lens}": "lens model",
};

/**
 * A representative photo used only to render the live name preview.
 *
 * A rename tool where you cannot see the result until after you have renamed a
 * thousand files is a tool nobody trusts. This context also makes the preview
 * a genuine validator: an invalid regular expression or an unknown token shows
 * up as an error sentence here, before any file is touched.
 */
const SAMPLE_CTX: TokenContext = {
  original: "DSC_0001",
  ext: ".JPG",
  width: 4032,
  height: 3024,
  size: 3_355_443,
  parent: "Holiday",
  fileDate: "2026-03-14T09:26:53.000Z",
  exifDate: "2026-03-12T17:04:11.000Z",
  make: "Canon",
  model: "EOS R8",
  lens: "RF 24-70mm F2.8",
  iso: 200,
  fNumber: 2.8,
  exposureTime: 0.004,
  folderCounter: 1,
};

const SAMPLE_NAME = "DSC_0001.JPG";

// ===========================================================================
// localStorage that cannot throw
// ===========================================================================

/**
 * `localStorage` is not always there.
 *
 * Safari private browsing throws on write, some managed browsers throw on
 * read, and a quota-exceeded write throws too. A settings panel must never be
 * the reason a tool fails to render, so every access is wrapped and a failure
 * simply means "no stored value".
 */
function safeLocalGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeLocalRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

/** True when a config is something other than the untouched defaults. */
function differsFromDefaults(config: RenameOptimizeConfig): boolean {
  // A structural comparison rather than `diffConfigs`, which covers only the
  // headline fields: a draft that changed nothing but the ZIP options is still
  // a draft worth keeping.
  return JSON.stringify(config) !== JSON.stringify(DEFAULT_CONFIG);
}

/** Drop `#p=…` from the address bar without reloading or adding history. */
function clearPresetHash(): void {
  try {
    if (typeof window === "undefined") return;
    if (!window.location.hash.includes("#p=")) return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  } catch {
    /* replaceState can be blocked; the hash is cosmetic at this point */
  }
}

// ===========================================================================
// Config state
// ===========================================================================

export interface ConfigOffer {
  /** Where it came from, for the banner wording. */
  source: "draft" | "link";
  config: RenameOptimizeConfig;
  /** Draft timestamp; absent for links. */
  ts?: number;
}

export interface ConfigApi {
  config: RenameOptimizeConfig;
  setConfig: (next: RenameOptimizeConfig) => void;
  patchRule: (patch: Partial<RenameRule>) => void;
  patchOptimize: (patch: Partial<OptimizeOptions>) => void;
  patchWatermark: (patch: Partial<RenameOptimizeConfig["optimize"]["watermark"]>) => void;
  patchConfig: (patch: Partial<RenameOptimizeConfig>) => void;
  reset: () => void;
  /** A recovered draft or shared link, waiting for the user to accept it (D10). */
  offer: ConfigOffer | null;
  acceptOffer: () => void;
  dismissOffer: () => void;
  /** Non-fatal problem with a shared link, shown once. */
  linkError: string | null;
  clearLinkError: () => void;
}

/**
 * Owns the config, persists a draft, and reads a shared link — without ever
 * applying either one behind the user's back.
 *
 * D10 is the rule that shapes this: a restored draft and a shared preset are
 * both OFFERS. They land in `offer` and are rendered as a banner listing what
 * would change; nothing moves until the user accepts. Silently restoring
 * settings from last week is how someone re-exports 800 photos at the wrong
 * quality and cannot work out why.
 */
function useConfigState(): ConfigApi {
  const [config, setConfigRaw] = useState<RenameOptimizeConfig>(DEFAULT_CONFIG);
  const [offer, setOffer] = useState<ConfigOffer | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // --- read the URL hash and the stored draft, once, on mount ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.location.hash.includes("#p=")) {
      const decoded = decodeConfigFromUrl(window.location.href);
      if (decoded.ok) {
        setOffer({ source: "link", config: decoded.output });
      } else {
        // A bad link is reported, never swallowed (D9) and never crashed on.
        setLinkError(decoded.error);
      }
      return; // a link outranks a local draft
    }

    const raw = safeLocalGet(DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { ts?: number; config?: unknown };
      const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
      if (!ts || Date.now() - ts > DRAFT_MAX_AGE) {
        safeLocalRemove(DRAFT_KEY);
        return;
      }
      const validated = validateConfig(parsed.config);
      if (!validated.ok) {
        safeLocalRemove(DRAFT_KEY);
        return;
      }
      if (!differsFromDefaults(validated.output)) return;
      setOffer({ source: "draft", config: validated.output, ts });
    } catch {
      safeLocalRemove(DRAFT_KEY);
    }
  }, []);

  /**
   * Persist the draft, debounced.
   *
   * The `offer` guard is load-bearing and was missing in the first version of
   * this file. Without it the sequence is: mount → read the stored draft into
   * `offer` → 600 ms later this effect writes the CURRENT config (still the
   * untouched defaults) over that same key. The banner still works for as long
   * as the tab is open, but the stored draft is already gone, so reloading
   * without accepting loses it permanently — the exact opposite of what a
   * draft is for. Nothing is written while an offer is unresolved.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (offer) return;
    if (!differsFromDefaults(config)) {
      // Back at the defaults: there is nothing to restore, so leave no stale
      // draft behind to offer on the next visit.
      safeLocalRemove(DRAFT_KEY);
      return;
    }
    const handle = window.setTimeout(() => {
      safeLocalSet(DRAFT_KEY, JSON.stringify({ ts: Date.now(), config }));
    }, 600);
    return () => window.clearTimeout(handle);
  }, [config, offer]);

  const setConfig = useCallback((next: RenameOptimizeConfig) => setConfigRaw(next), []);

  const patchConfig = useCallback((patch: Partial<RenameOptimizeConfig>) => {
    setConfigRaw((c) => ({ ...c, ...patch }));
  }, []);

  const patchRule = useCallback((patch: Partial<RenameRule>) => {
    setConfigRaw((c) => ({ ...c, rule: { ...c.rule, ...patch } }));
  }, []);

  const patchOptimize = useCallback((patch: Partial<OptimizeOptions>) => {
    setConfigRaw((c) => ({ ...c, optimize: { ...c.optimize, ...patch } }));
  }, []);

  const patchWatermark = useCallback(
    (patch: Partial<RenameOptimizeConfig["optimize"]["watermark"]>) => {
      setConfigRaw((c) => ({
        ...c,
        optimize: { ...c.optimize, watermark: { ...c.optimize.watermark, ...patch } },
      }));
    },
    [],
  );

  const reset = useCallback(() => {
    setConfigRaw(DEFAULT_CONFIG);
    safeLocalRemove(DRAFT_KEY);
  }, []);

  // Both of these read `offer` from state and then set state ONCE each. An
  // earlier version called `setConfigRaw` from inside a `setOffer` updater,
  // which is the same impurity as D28: updaters are replayed under StrictMode
  // and concurrent rendering, so the config would have been applied twice.
  const acceptOffer = useCallback(() => {
    if (!offer) return;
    setConfigRaw(offer.config);
    if (offer.source === "link") clearPresetHash();
    if (offer.source === "draft") safeLocalRemove(DRAFT_KEY);
    setOffer(null);
  }, [offer]);

  const dismissOffer = useCallback(() => {
    if (!offer) return;
    if (offer.source === "draft") safeLocalRemove(DRAFT_KEY);
    if (offer.source === "link") clearPresetHash();
    setOffer(null);
  }, [offer]);

  const clearLinkError = useCallback(() => {
    clearPresetHash();
    setLinkError(null);
  }, []);

  return {
    config,
    setConfig,
    patchRule,
    patchOptimize,
    patchWatermark,
    patchConfig,
    reset,
    offer,
    acceptOffer,
    dismissOffer,
    linkError,
    clearLinkError,
  };
}

// ===========================================================================
// Offer banner
// ===========================================================================

/**
 * Shows what a draft or a shared link would change, with Apply and Dismiss.
 *
 * The diff is the whole point: "Restore previous settings?" tells the user
 * nothing, while "Quality: 0.8 → 0.95, Keep metadata: false → true" lets them
 * decide in a second.
 */
function ConfigOfferBanner({
  offer,
  current,
  onApply,
  onDismiss,
}: {
  offer: ConfigOffer;
  current: RenameOptimizeConfig;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const changes = useMemo(() => diffConfigs(current, offer.config), [current, offer.config]);
  const when = offer.ts ? new Date(offer.ts).toLocaleString() : null;

  return (
    <div className={cx(BOX, "p-3 space-y-2")} role="region" aria-label="Settings offer">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs">
          {offer.source === "link" ? (
            <>
              <strong>This link carries shared settings.</strong> Nothing has been applied yet.
            </>
          ) : (
            <>
              <strong>Unsaved settings from a previous visit were found</strong>
              {when ? ` (saved ${when})` : ""}. Nothing has been applied yet.
            </>
          )}
        </p>
        <Badge tone="warn">Not applied</Badge>
      </div>

      {changes.length === 0 ? (
        <Note>
          These settings match what is already on screen, so applying them changes nothing.
        </Note>
      ) : (
        <ul className="space-y-0.5 text-[11px] text-[--muted-foreground]">
          {changes.slice(0, 12).map((line) => (
            <li key={line} className="tabular-nums">
              {line}
            </li>
          ))}
          {changes.length > 12 && <li>…and {changes.length - 12} more.</li>}
        </ul>
      )}

      <div className="flex gap-2">
        <Button variant="primary" onClick={onApply}>
          Apply these settings
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          {offer.source === "draft" ? "Discard them" : "Ignore"}
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// Token palette
// ===========================================================================

/**
 * Clickable token chips plus live validation of the pattern.
 *
 * Two things are worth pointing out. Chips INSERT at the caret rather than
 * replacing the field, because a pattern is usually built up from several
 * tokens and literal separators. And `findUnknownTokens` runs on every
 * keystroke: a typo like `{iso}` (the real token is `{exif:iso}`) would
 * otherwise be baked literally into a thousand filenames, braces and all.
 */
function TokenPalette({
  pattern,
  onInsert,
}: {
  pattern: string;
  onInsert: (token: string) => void;
}) {
  const unknown = useMemo(() => findUnknownTokens(pattern), [pattern]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {KNOWN_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => onInsert(token)}
            title={TOKEN_HINTS[token] ?? token}
            className={cx(
              "rounded border border-[--border] px-1.5 py-0.5 font-mono text-[10px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]",
              FOCUS,
            )}
          >
            {token}
          </button>
        ))}
      </div>
      {unknown.length > 0 && (
        <ErrorBanner
          message={`${unknown.join(", ")} ${
            unknown.length === 1
              ? "is not a token this tool knows"
              : "are not tokens this tool knows"
          }, so the braces would appear literally in every filename. Pick one from the list above, or remove the braces.`}
        />
      )}
    </div>
  );
}

/** Live preview of the pattern against one representative photo. */
function NamePreview({ config }: { config: RenameOptimizeConfig }) {
  const result = useMemo(() => {
    // In rename-only mode the extension must not change, so no output format is
    // passed — otherwise the preview would promise a .jpg the run will not
    // produce.
    const format = config.optimize.copyOriginalBytes ? undefined : config.optimize.format;
    return applyRenamePattern(SAMPLE_NAME, 0, config.rule, SAMPLE_CTX, format);
  }, [config.rule, config.optimize.format, config.optimize.copyOriginalBytes]);

  if (!result.ok) return <ErrorBanner message={result.error} />;

  return (
    <div className="rounded-md border border-[--border] bg-[--muted]/40 p-2.5 text-xs">
      <div className="text-[11px] text-[--muted-foreground]">
        Example, using a 4032 × 3024 photo named {SAMPLE_NAME} inside a folder called Holiday
      </div>
      <div className="mt-1 flex items-center gap-2 font-mono">
        <span className="text-[--muted-foreground] line-through">{SAMPLE_NAME}</span>
        <span aria-hidden="true">→</span>
        <span className="font-medium break-all">{result.output}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// Find / replace chain
// ===========================================================================

/** Editor for the ordered extra find/replace steps (feature 20). */
function ReplacementChain({
  rules,
  onChange,
}: {
  rules: ReplaceRule[];
  onChange: (next: ReplaceRule[]) => void;
}) {
  const uid = useMemo(() => nextId("rr"), []);

  const update = (i: number, patch: Partial<ReplaceRule>) => {
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <Note>
          Extra steps run in order, after the main find and replace above. Useful for cleaning up
          several different patterns in one pass.
        </Note>
      )}
      {rules.map((rule, i) => (
        <div key={`${uid}-${i}`} className="flex items-end gap-2">
          <Field label={`Find ${i + 2}`} htmlFor={`${uid}-find-${i}`} className="flex-1">
            <input
              id={`${uid}-find-${i}`}
              className={INPUT}
              value={rule.find}
              onChange={(e) => update(i, { find: e.target.value })}
            />
          </Field>
          <Field label={`Replace ${i + 2}`} htmlFor={`${uid}-rep-${i}`} className="flex-1">
            <input
              id={`${uid}-rep-${i}`}
              className={INPUT}
              value={rule.replace}
              onChange={(e) => update(i, { replace: e.target.value })}
            />
          </Field>
          <div className="pb-2">
            <Toggle
              id={`${uid}-re-${i}`}
              checked={rule.useRegex}
              onChange={(v) => update(i, { useRegex: v })}
              label="Regex"
            />
          </div>
          <div className="pb-1">
            <IconButton
              label={`Remove extra replacement ${i + 2}`}
              danger
              onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      ))}
      <Button
        onClick={() => onChange([...rules, { find: "", replace: "", useRegex: false }])}
        disabled={rules.length >= 20}
        title={rules.length >= 20 ? "Twenty extra steps is the limit." : undefined}
      >
        Add another find and replace
      </Button>
    </div>
  );
}

// ===========================================================================
// Rename rules panel
// ===========================================================================

function RenameRulesPanel({ api }: { api: ConfigApi }) {
  const { config, patchRule } = api;
  const rule = config.rule;
  const uid = useMemo(() => nextId("rn"), []);
  const patternRef = useRef<HTMLInputElement>(null);

  /** Insert a token at the caret, keeping focus and caret position sane. */
  const insertToken = useCallback(
    (token: string) => {
      const el = patternRef.current;
      if (!el) {
        patchRule({ pattern: `${rule.pattern}${token}` });
        return;
      }
      const start = el.selectionStart ?? rule.pattern.length;
      const end = el.selectionEnd ?? start;
      const next = `${rule.pattern.slice(0, start)}${token}${rule.pattern.slice(end)}`;
      patchRule({ pattern: next });
      // Restore the caret after React has written the new value.
      window.requestAnimationFrame(() => {
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
    },
    [patchRule, rule.pattern],
  );

  const usesCounter = rule.pattern.includes("{counter");
  const usesRandom = /\{random:\d+\}/.test(rule.pattern);

  return (
    <Section icon={<Type className="h-4 w-4" aria-hidden="true" />} title="Naming" defaultOpen>
      <Field
        label="Filename pattern"
        htmlFor={`${uid}-pattern`}
        hint="Leave empty to keep the original name. Click a token below to insert it."
      >
        <input
          id={`${uid}-pattern`}
          ref={patternRef}
          className={cx(INPUT, "font-mono")}
          value={rule.pattern}
          placeholder="{original}"
          onChange={(e) => patchRule({ pattern: e.target.value })}
        />
      </Field>

      <TokenPalette pattern={rule.pattern} onInsert={insertToken} />
      <NamePreview config={config} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prefix" htmlFor={`${uid}-prefix`}>
          <input
            id={`${uid}-prefix`}
            className={INPUT}
            value={rule.prefix}
            onChange={(e) => patchRule({ prefix: e.target.value })}
          />
        </Field>
        <Field label="Suffix" htmlFor={`${uid}-suffix`}>
          <input
            id={`${uid}-suffix`}
            className={INPUT}
            value={rule.suffix}
            onChange={(e) => patchRule({ suffix: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Counter starts at"
          htmlFor={`${uid}-cstart`}
          hint={usesCounter ? undefined : "Used by {counter}"}
        >
          <Num
            id={`${uid}-cstart`}
            value={rule.counterStart}
            onChange={(v) => patchRule({ counterStart: v ?? 1 })}
            step={1}
          />
        </Field>
        <Field label="Counter step" htmlFor={`${uid}-cstep`}>
          <Num
            id={`${uid}-cstep`}
            value={rule.counterStep}
            onChange={(v) => patchRule({ counterStep: v ?? 1 })}
            step={1}
          />
        </Field>
        <Field label="Zero padding" htmlFor={`${uid}-cpad`} hint="3 gives 001">
          <Num
            id={`${uid}-cpad`}
            value={rule.counterPad}
            onChange={(v) => patchRule({ counterPad: v ?? 0 })}
            min={0}
            max={12}
          />
        </Field>
      </div>

      <Field label="Letter case" htmlFor={`${uid}-case`}>
        <Select<CaseMode>
          id={`${uid}-case`}
          value={rule.caseMode}
          onChange={(v) => patchRule({ caseMode: v })}
          options={CASE_OPTIONS}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Find" htmlFor={`${uid}-find`}>
          <input
            id={`${uid}-find`}
            className={INPUT}
            value={rule.find}
            onChange={(e) => patchRule({ find: e.target.value })}
          />
        </Field>
        <Field label="Replace with" htmlFor={`${uid}-replace`}>
          <input
            id={`${uid}-replace`}
            className={INPUT}
            value={rule.replace}
            onChange={(e) => patchRule({ replace: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          id={`${uid}-regex`}
          checked={rule.useRegex}
          onChange={(v) => patchRule({ useRegex: v })}
          label="Treat Find as a regular expression"
        />
        <Toggle
          id={`${uid}-spaces`}
          checked={rule.removeSpaces}
          onChange={(v) => patchRule({ removeSpaces: v })}
          label="Replace spaces with dashes"
        />
        <Toggle
          id={`${uid}-special`}
          checked={rule.removeSpecialChars}
          onChange={(v) => patchRule({ removeSpecialChars: v })}
          label="Remove punctuation and symbols"
        />
        <Toggle
          id={`${uid}-nfc`}
          checked={rule.normaliseUnicode !== false}
          onChange={(v) => patchRule({ normaliseUnicode: v })}
          label="Normalise accents to Unicode NFC"
        />
        <Toggle
          id={`${uid}-reserved`}
          checked={rule.guardReservedNames !== false}
          onChange={(v) => patchRule({ guardReservedNames: v })}
          label="Avoid Windows reserved names (CON, NUL, …)"
        />
      </div>

      <Field
        label="Random seed"
        htmlFor={`${uid}-seed`}
        hint={
          usesRandom
            ? "The same seed always produces the same names, so a run is repeatable."
            : "Used by {random:6}"
        }
      >
        <Num
          id={`${uid}-seed`}
          value={rule.randomSeed ?? 1}
          onChange={(v) => patchRule({ randomSeed: v ?? 1 })}
          min={0}
        />
      </Field>

      <details className="rounded-md border border-[--border] p-2">
        <summary className={cx("cursor-pointer text-xs", FOCUS)}>
          More find and replace steps
          {(rule.extraReplacements?.length ?? 0) > 0 && (
            <span className="ml-1 text-[--muted-foreground]">
              ({rule.extraReplacements!.length})
            </span>
          )}
        </summary>
        <div className="mt-2">
          <ReplacementChain
            rules={rule.extraReplacements ?? []}
            onChange={(next) => patchRule({ extraReplacements: next })}
          />
        </div>
      </details>

      <Note>
        Names are always made safe for Windows, macOS and Linux before anything is written:
        illegal characters are replaced, trailing dots and spaces removed, and names longer than{" "}
        {rule.maxNameBytes ?? 255} bytes shortened without touching the extension. Every change of
        that kind is listed against the file in the table.
      </Note>
    </Section>
  );
}

// ===========================================================================
// Optimize panel
// ===========================================================================

function OptimizePanel({ api }: { api: ConfigApi }) {
  const { config, patchOptimize } = api;
  const o = config.optimize;
  const uid = useMemo(() => nextId("op"), []);

  const copyOnly = o.copyOriginalBytes === true;
  const isPng = o.format === "image/png";
  const mode: ResizeMode = o.resizeMode ?? "longest";

  /**
   * Every disabled control below carries a reason (D19).
   *
   * The original had a "Progressive JPEG" switch wired to a real config field,
   * which even disabled itself for non-JPEG formats to look attentive, and
   * which could never work at all: canvas encoders expose no progressive or
   * interlace parameter. It is not disabled here — it is GONE, and DOCS.md
   * lists it under "Not applicable" with the reason. A control that cannot work
   * should not be on screen.
   */
  const copyReason = copyOnly
    ? "Rename only is on, so the original bytes are copied through untouched and no encoding setting applies."
    : undefined;

  return (
    <Section
      icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
      title="Image output"
      defaultOpen
    >
      <Toggle
        id={`${uid}-copy`}
        checked={copyOnly}
        onChange={(v) => patchOptimize({ copyOriginalBytes: v })}
        label="Rename only — do not re-encode the images"
      />
      {copyOnly && (
        <Note>
          Files keep their exact original bytes, extension and metadata. This is the fastest and
          safest mode, and the only one that cannot lose a single pixel of quality — but it also
          cannot make anything smaller.
        </Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Output format" htmlFor={`${uid}-format`}>
          <Select<OutputFormat>
            id={`${uid}-format`}
            value={o.format}
            onChange={(v) => patchOptimize({ format: v })}
            options={FORMAT_OPTIONS}
            disabled={copyOnly}
          />
        </Field>
        <Field
          label={`Quality — ${Math.round(o.quality * 100)}%`}
          htmlFor={`${uid}-quality`}
          hint={
            isPng
              ? "PNG is lossless, so quality does not apply to it."
              : o.targetBytes
                ? "Used as the starting point while hunting for the target file size."
                : undefined
          }
        >
          <Range
            id={`${uid}-quality`}
            value={Math.round(o.quality * 100)}
            onChange={(v) => patchOptimize({ quality: v / 100 })}
            min={5}
            max={100}
            disabled={copyOnly || isPng}
          />
        </Field>
      </div>

      <Field label="Resize" htmlFor={`${uid}-resize`}>
        <Select<ResizeMode>
          id={`${uid}-resize`}
          value={mode}
          onChange={(v) => patchOptimize({ resizeMode: v })}
          options={RESIZE_OPTIONS}
          disabled={copyOnly}
        />
      </Field>

      {!copyOnly && (
        <div className="grid gap-3 sm:grid-cols-3">
          {mode === "longest" && (
            <Field
              label="Longest edge (px)"
              htmlFor={`${uid}-maxdim`}
              hint="Empty means keep the original size."
            >
              <Num
                id={`${uid}-maxdim`}
                value={o.maxDimension}
                onChange={(v) => patchOptimize({ maxDimension: v })}
                min={16}
                max={20000}
                placeholder="original"
              />
            </Field>
          )}
          {(mode === "width" || mode === "fit" || mode === "cover") && (
            <Field label="Width (px)" htmlFor={`${uid}-tw`}>
              <Num
                id={`${uid}-tw`}
                value={o.targetWidth}
                onChange={(v) => patchOptimize({ targetWidth: v })}
                min={1}
                max={20000}
              />
            </Field>
          )}
          {(mode === "height" || mode === "fit" || mode === "cover") && (
            <Field label="Height (px)" htmlFor={`${uid}-th`}>
              <Num
                id={`${uid}-th`}
                value={o.targetHeight}
                onChange={(v) => patchOptimize({ targetHeight: v })}
                min={1}
                max={20000}
              />
            </Field>
          )}
          {mode === "percent" && (
            <Field label="Scale (%)" htmlFor={`${uid}-pct`}>
              <Num
                id={`${uid}-pct`}
                value={o.scalePercent ?? 100}
                onChange={(v) => patchOptimize({ scalePercent: v ?? 100 })}
                min={1}
                max={400}
              />
            </Field>
          )}
          <Field
            label="Target file size (KB)"
            htmlFor={`${uid}-target`}
            hint={
              isPng
                ? "PNG has no quality dial to trade away, so a byte target cannot be hit."
                : "Quality is searched for automatically. Empty means use the quality above."
            }
          >
            <Num
              id={`${uid}-target`}
              value={o.targetBytes ? Math.round(o.targetBytes / 1024) : undefined}
              onChange={(v) => patchOptimize({ targetBytes: v ? v * 1024 : undefined })}
              min={1}
              placeholder="off"
              disabled={isPng}
            />
          </Field>
        </div>
      )}

      {mode === "cover" && !copyOnly && (
        <Note>
          Fill crops whatever does not fit, centred. Anything outside the box is gone from the
          output — use Fit instead if nothing may be cut.
        </Note>
      )}
      {mode === "percent" && (o.scalePercent ?? 100) > 100 && !copyOnly && (
        <Note>
          Scaling above 100% enlarges the image. No detail is added by doing that, and the file
          usually gets bigger.
        </Note>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          id={`${uid}-nevergrow`}
          checked={o.neverGrow !== false}
          onChange={(v) => patchOptimize({ neverGrow: v })}
          label="Never write a file larger than the original"
          disabled={copyOnly}
          reason={copyReason}
        />
        <Toggle
          id={`${uid}-smart`}
          checked={o.smartFormat === true}
          onChange={(v) => patchOptimize({ smartFormat: v })}
          label="Try JPEG and WebP, keep the smaller one"
          disabled={copyOnly || isPng}
          reason={
            copyReason ??
            (isPng
              ? "PNG is chosen explicitly, usually for transparency, so it is not swapped for a lossy format."
              : undefined)
          }
        />
        <Toggle
          id={`${uid}-orient`}
          checked={o.autoOrient !== false}
          onChange={(v) => patchOptimize({ autoOrient: v })}
          label="Rotate photos upright using their EXIF orientation"
          disabled={copyOnly}
          reason={copyReason}
        />
        <Toggle
          id={`${uid}-hq`}
          checked={o.highQualityDownscale !== false}
          onChange={(v) => patchOptimize({ highQualityDownscale: v })}
          label="Sharper downscaling (halve in steps)"
          disabled={copyOnly}
          reason={copyReason}
        />
      </div>

      {!copyOnly && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={`Sharpen after resize — ${o.unsharpAmount ?? 0}`}
            htmlFor={`${uid}-unsharp`}
            hint="0 is off. Only applies when the image is made smaller."
          >
            <Range
              id={`${uid}-unsharp`}
              value={o.unsharpAmount ?? 0}
              onChange={(v) => patchOptimize({ unsharpAmount: v })}
              min={0}
              max={100}
            />
          </Field>
          <Field
            label="Background behind transparency"
            htmlFor={`${uid}-bg`}
            hint={
              o.format === "image/jpeg"
                ? "JPEG cannot store transparency, so transparent areas are filled with this colour."
                : "Only used when the output format cannot store transparency."
            }
          >
            <input
              id={`${uid}-bg`}
              type="color"
              value={o.backgroundColor ?? "#ffffff"}
              onChange={(e) => patchOptimize({ backgroundColor: e.target.value })}
              className={cx(
                "h-9 w-full rounded-md border border-[--border] bg-[--background]",
                FOCUS,
              )}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          id={`${uid}-strip`}
          checked={o.stripExif}
          onChange={(v) => patchOptimize({ stripExif: v })}
          label="Remove all metadata (EXIF, GPS, camera info)"
          disabled={copyOnly}
          reason={copyReason}
        />
        <Toggle
          id={`${uid}-gps`}
          checked={o.stripGps !== false}
          onChange={(v) => patchOptimize({ stripGps: v })}
          label="Remove GPS location only"
          disabled={copyOnly || o.stripExif}
          reason={
            copyReason ??
            (o.stripExif ? "All metadata is already being removed, GPS included." : undefined)
          }
        />
      </div>

      {!copyOnly && !o.stripExif && (
        <Field
          label="Copyright to write into the output"
          htmlFor={`${uid}-copyright`}
          hint="Written to JPEG output only. Left empty, nothing is added."
        >
          <input
            id={`${uid}-copyright`}
            className={INPUT}
            value={o.copyright ?? ""}
            placeholder="© 2026 Your Name"
            onChange={(e) => patchOptimize({ copyright: e.target.value || undefined })}
          />
        </Field>
      )}

      {copyOnly && (
        <Note>
          Metadata is untouched in rename-only mode, so photos keep their GPS coordinates. Turn
          rename-only off if you are publishing them.
        </Note>
      )}
    </Section>
  );
}

// ===========================================================================
// Watermark editor
// ===========================================================================

function WatermarkEditor({ api }: { api: ConfigApi }) {
  const { config, patchWatermark } = api;
  const w = config.optimize.watermark;
  const copyOnly = config.optimize.copyOriginalBytes === true;
  const uid = useMemo(() => nextId("wm"), []);

  return (
    <Section
      icon={<Droplet className="h-4 w-4" aria-hidden="true" />}
      title="Watermark"
      badge={w.enabled && !copyOnly ? <Badge tone="good">On</Badge> : undefined}
    >
      <Toggle
        id={`${uid}-on`}
        checked={w.enabled}
        onChange={(v) => patchWatermark({ enabled: v })}
        label="Draw a text watermark on every image"
        disabled={copyOnly}
        reason={
          copyOnly
            ? "Rename only is on, so the images are copied without being redrawn. Turn it off to draw a watermark."
            : undefined
        }
      />

      {w.enabled && !copyOnly && (
        <>
          <Field label="Text" htmlFor={`${uid}-text`}>
            <input
              id={`${uid}-text`}
              className={INPUT}
              value={w.text}
              onChange={(e) => patchWatermark({ text: e.target.value })}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Position" htmlFor={`${uid}-pos`}>
              <Select<WatermarkPosition>
                id={`${uid}-pos`}
                value={w.position}
                onChange={(v) => patchWatermark({ position: v })}
                options={WATERMARK_OPTIONS}
              />
            </Field>
            <Field label="Colour" htmlFor={`${uid}-color`}>
              <input
                id={`${uid}-color`}
                type="color"
                value={w.color}
                onChange={(e) => patchWatermark({ color: e.target.value })}
                className={cx(
                  "h-9 w-full rounded-md border border-[--border] bg-[--background]",
                  FOCUS,
                )}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Opacity — ${Math.round(w.opacity * 100)}%`} htmlFor={`${uid}-op`}>
              <Range
                id={`${uid}-op`}
                value={Math.round(w.opacity * 100)}
                onChange={(v) => patchWatermark({ opacity: v / 100 })}
                min={5}
                max={100}
              />
            </Field>
            <Field
              label="Text size"
              htmlFor={`${uid}-fs`}
              hint="Relative to a 1000 px wide image, so it scales with each photo."
            >
              <Num
                id={`${uid}-fs`}
                value={w.fontSize}
                onChange={(v) => patchWatermark({ fontSize: v ?? 24 })}
                min={4}
                max={400}
              />
            </Field>
          </div>

          {/* A watermark is burned in permanently — worth saying once, plainly. */}
          <Note>
            The watermark is drawn into the pixels and cannot be removed afterwards. Keep your
            originals.
          </Note>
        </>
      )}
    </Section>
  );
}

// ===========================================================================
// Output / packaging panel
// ===========================================================================

function OutputPanel({ api, hasFolders }: { api: ConfigApi; hasFolders: boolean }) {
  const { config, patchConfig } = api;
  const uid = useMemo(() => nextId("out"), []);

  return (
    <Section icon={<FolderTree className="h-4 w-4" aria-hidden="true" />} title="Folders and ZIP">
      <Toggle
        id={`${uid}-preserve`}
        checked={config.preserveFolderStructure}
        onChange={(v) =>
          patchConfig({
            preserveFolderStructure: v,
            flattenOutput: v ? false : config.flattenOutput,
          })
        }
        label="Keep the source folder structure inside the ZIP"
        disabled={config.flattenOutput === true}
        reason={
          config.flattenOutput
            ? "Everything is being flattened into one folder, which is the opposite of this."
            : undefined
        }
      />
      {config.preserveFolderStructure && !hasFolders && (
        <Note>
          Nothing added so far came from a folder, so this will have no effect on the current
          batch. Use “Add folder”, or drop a folder onto the box above, to bring the structure in.
        </Note>
      )}

      <Toggle
        id={`${uid}-flatten`}
        checked={config.flattenOutput === true}
        onChange={(v) =>
          patchConfig({
            flattenOutput: v,
            preserveFolderStructure: v ? false : config.preserveFolderStructure,
          })
        }
        label="Flatten every folder into one"
      />
      {config.flattenOutput && (
        <Note>
          Two files from different folders can share a name. Collapsing the folders would let one
          overwrite the other, so names are made unique across the whole archive first and each
          change is listed in the table.
        </Note>
      )}

      <Field
        label="Put everything inside this folder"
        htmlFor={`${uid}-folder`}
        hint="Optional. Leave empty for files at the top level of the ZIP."
      >
        <input
          id={`${uid}-folder`}
          className={INPUT}
          value={config.outputFolder}
          placeholder="exports"
          onChange={(e) => patchConfig({ outputFolder: sanitiseRelativePath(e.target.value) })}
        />
      </Field>

      <Field
        label="ZIP filename pattern"
        htmlFor={`${uid}-zipname`}
        hint="Uses the same tokens as filenames. Empty gives bulk-images-{date}."
      >
        <input
          id={`${uid}-zipname`}
          className={cx(INPUT, "font-mono")}
          value={config.zipNamePattern ?? ""}
          placeholder="bulk-images-{date}"
          onChange={(e) => patchConfig({ zipNamePattern: e.target.value || undefined })}
        />
      </Field>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          id={`${uid}-audit`}
          checked={config.includeAuditInZip === true}
          onChange={(v) => patchConfig({ includeAuditInZip: v })}
          label="Include _audit.csv in the ZIP"
        />
        <Toggle
          id={`${uid}-manifest`}
          checked={config.includeManifestInZip === true}
          onChange={(v) => patchConfig({ includeManifestInZip: v })}
          label="Include _manifest.json of every setting"
        />
      </div>

      <Field
        label="Split the ZIP above this size (MB)"
        htmlFor={`${uid}-split`}
        hint="Empty means one archive, however large. Useful for upload limits."
      >
        <Num
          id={`${uid}-split`}
          value={
            config.zipSplitBytes ? Math.round(config.zipSplitBytes / (1024 * 1024)) : undefined
          }
          onChange={(v) => patchConfig({ zipSplitBytes: v ? v * 1024 * 1024 : undefined })}
          min={1}
          placeholder="off"
        />
      </Field>
    </Section>
  );
}

// ===========================================================================
// Presets
// ===========================================================================

/** Named presets in localStorage, capped and validated on the way back in. */
function useNamedPresets() {
  const [presets, setPresets] = useState<NamedPreset[]>([]);

  useEffect(() => {
    const raw = safeLocalGet(PRESET_KEY);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned: NamedPreset[] = [];
      for (const item of parsed.slice(0, MAX_PRESETS)) {
        if (typeof item !== "object" || item === null) continue;
        const rec = item as { name?: unknown; config?: unknown; ts?: unknown };
        if (typeof rec.name !== "string") continue;
        // Stored settings are as untrusted as a shared link: they may come from
        // an older version of the tool, or have been hand-edited.
        const validated = validateConfig(rec.config);
        if (!validated.ok) continue;
        cleaned.push({
          name: rec.name.slice(0, 60),
          config: validated.output,
          ts: typeof rec.ts === "number" ? rec.ts : Date.now(),
        });
      }
      setPresets(cleaned);
    } catch {
      safeLocalRemove(PRESET_KEY);
    }
  }, []);

  const persist = useCallback((next: NamedPreset[]) => {
    setPresets(next);
    const ok = safeLocalSet(PRESET_KEY, JSON.stringify(next));
    if (!ok) {
      toast.error(
        "This browser would not let the tool save presets. They will work for this visit only.",
      );
    }
  }, []);

  const save = useCallback(
    (name: string, config: RenameOptimizeConfig) => {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) return false;
      const without = presets.filter((p) => p.name !== trimmed);
      if (without.length >= MAX_PRESETS) {
        toast.error(`Presets are limited to ${MAX_PRESETS}. Delete one before saving another.`);
        return false;
      }
      persist([{ name: trimmed, config, ts: Date.now() }, ...without]);
      return true;
    },
    [presets, persist],
  );

  const remove = useCallback(
    (name: string) => persist(presets.filter((p) => p.name !== name)),
    [presets, persist],
  );

  return { presets, save, remove };
}

/**
 * Confirmation dialog for applying a preset over the current settings.
 *
 * Same reasoning as the offer banner: a preset that quietly rewrites eighteen
 * fields is indistinguishable from a bug. The diff is shown first (D10).
 */
function ApplyPresetDialog({
  name,
  description,
  current,
  next,
  onApply,
  onClose,
}: {
  name: string;
  description?: string;
  current: RenameOptimizeConfig;
  next: RenameOptimizeConfig;
  onApply: () => void;
  onClose: () => void;
}) {
  const changes = useMemo(() => diffConfigs(current, next), [current, next]);
  return (
    <Dialog
      title={`Apply “${name}”?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onApply}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {description && <p className="text-xs text-[--muted-foreground]">{description}</p>}
        {changes.length === 0 ? (
          <Note>These settings are already in place, so applying this changes nothing.</Note>
        ) : (
          <>
            <p className="text-xs">
              This will change {changes.length} setting{changes.length === 1 ? "" : "s"}:
            </p>
            <ul className="max-h-72 space-y-0.5 overflow-auto text-[11px] text-[--muted-foreground]">
              {changes.map((line) => (
                <li key={line} className="tabular-nums">
                  {line}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Dialog>
  );
}

function PresetPanel({ api }: { api: ConfigApi }) {
  const { config, setConfig, reset } = api;
  const { presets, save, remove } = useNamedPresets();
  const [pending, setPending] = useState<{
    name: string;
    description?: string;
    config: RenameOptimizeConfig;
  } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const uid = useMemo(() => nextId("ps"), []);

  const shareCurrent = useCallback(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const url = encodeConfigToUrl(config, base);
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("A link to these settings was copied to your clipboard."))
      .catch(() =>
        toast.error("The browser blocked clipboard access, so the link could not be copied."),
      );
  }, [config]);

  return (
    <Section
      icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
      title="Presets"
      badge={presets.length > 0 ? <Badge>{presets.length} saved</Badge> : undefined}
    >
      <div>
        <p className="mb-1.5 text-[11px] text-[--muted-foreground]">Starting points</p>
        <div className="flex flex-wrap gap-2">
          {STARTER_PRESETS.map((p) => (
            <Button
              key={p.name}
              onClick={() =>
                setPending({ name: p.name, description: p.description, config: p.config })
              }
              title={p.description}
            >
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      {presets.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] text-[--muted-foreground]">Your presets</p>
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.name} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPending({ name: p.name, config: p.config })}
                  className={cx(
                    "flex-1 rounded-md border border-[--border] px-2 py-1.5 text-left text-xs hover:bg-[--muted]",
                    FOCUS,
                  )}
                >
                  {p.name}
                  <span className="ml-2 text-[10px] text-[--muted-foreground]">
                    {new Date(p.ts).toLocaleDateString()}
                  </span>
                </button>
                <IconButton
                  label={`Delete preset ${p.name}`}
                  danger
                  onClick={() => remove(p.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setDraftName("");
            setSaveOpen(true);
          }}
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          Save current settings
        </Button>
        <Button onClick={shareCurrent}>
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Copy a link to these settings
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Back to defaults
        </Button>
      </div>

      <Note>
        Presets and links carry settings only — never your images, which never leave this device.
      </Note>

      {saveOpen && (
        <Dialog
          title="Save these settings"
          onClose={() => setSaveOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={draftName.trim().length === 0}
                onClick={() => {
                  if (save(draftName, config)) {
                    toast.success(`Saved “${draftName.trim()}”.`);
                    setSaveOpen(false);
                  }
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <Field
            label="Preset name"
            htmlFor={`${uid}-name`}
            hint={`Saving over an existing name replaces it. Up to ${MAX_PRESETS} presets.`}
          >
            <input
              id={`${uid}-name`}
              className={INPUT}
              value={draftName}
              autoFocus
              maxLength={60}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </Field>
        </Dialog>
      )}

      {pending && (
        <ApplyPresetDialog
          name={pending.name}
          description={pending.description}
          current={config}
          next={pending.config}
          onClose={() => setPending(null)}
          onApply={() => {
            setConfig(pending.config);
            toast.success(`Applied “${pending.name}”.`);
            setPending(null);
          }}
        />
      )}
    </Section>
  );
}

// ===========================================================================
// Settings column
// ===========================================================================

/**
 * All settings in one column, in the order people actually work through them:
 * what the files will be called, what the images will be, decoration, then
 * packaging, then presets.
 */
function SettingsColumn({ api, hasFolders }: { api: ConfigApi; hasFolders: boolean }) {
  return (
    <div className="space-y-3">
      <RenameRulesPanel api={api} />
      <OptimizePanel api={api} />
      <WatermarkEditor api={api} />
      <OutputPanel api={api} hasFolders={hasFolders} />
      <PresetPanel api={api} />
    </div>
  );
}

/**
 * ===========================================================================
 * UI PART 4 of 6 — the queue table and the duplicate finder.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-2-UI-PART-3.tsx.
 *
 * PART-COUNT HISTORY (read this before assembling)
 * PARTS 1-3 were written when the UI was planned as four files, and their
 * headers still say "of 4". The viewers and the orchestrator each turned out
 * large enough to need their own file, so the UI ships as SIX parts:
 *
 *   PART 1  constants, shared types, hooks, atoms
 *   PART 2  intake: drop zone, directory walk, limits, queue reducer
 *   PART 3  settings: rename rules, optimize, watermark, output, presets
 *   PART 4  THIS FILE — PlanView, PreviewTable, DuplicatesPanel
 *   PART 5  viewers: EXIF inspector, before/after diff, quality matrix, history
 *   PART 6  orchestration: worker client, run, downloads, default export
 *
 * Concatenation order is 1, 2, 3, 4, 5, 6 and the result is the single
 * `ui.tsx`. STATUS.md carries this as the assembly order of record.
 *
 * WHY THIS FILE WAS SPLIT AFTER IT WAS FIRST PUSHED
 * The first version of PART 4 held all of the above plus the viewers, at ~50
 * KB. That is past the size where a single generated file can be trusted to
 * arrive whole — this project has already lost five files to silent truncation
 * — so it was cut in half rather than left as a file nobody can safely
 * regenerate. Three defects found while re-reading it are fixed below.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE'S ONE IMPORT LINE
 * ---------------------------------------------------------------------------
 * `hammingDistance` is not in PART 1's import block, and it is needed here
 * because `similarityPercent` takes a DISTANCE, not a pair of hashes — a
 * detail confirmed by reading ENGINE PART 4 rather than trusting a note about
 * it (D22/D24). At assembly this line folds into PART 1's block, exactly as
 * PART 3's line does.
 */

import { hammingDistance } from "./logic";

// ===========================================================================
// Shared view model
// ===========================================================================

/**
 * The planned outcome for the current queue and the current settings.
 *
 * The table never computes names itself. It renders what `planBatch` in the
 * engine decided, keyed by file id, so the name in the preview is the SAME
 * string that ends up in the ZIP — produced by the same function, from the
 * same inputs, with the same collision suffixes. A preview computed separately
 * from the real run is a preview that will eventually lie, and the one promise
 * this tool makes is that its filenames are exact.
 */
export interface PlanView {
  nameById: Map<string, string>;
  pathById: Map<string, string>;
  suffixedIds: Set<string>;
  errorById: Map<string, string>;
  warningsById: Map<string, string[]>;
}

export const EMPTY_PLAN: PlanView = {
  nameById: new Map(),
  pathById: new Map(),
  suffixedIds: new Set(),
  errorById: new Map(),
  warningsById: new Map(),
};

export type SortKey = "queue" | "name" | "newName" | "size" | "savings";

/**
 * Human-order comparison: "IMG_2" before "IMG_10".
 *
 * Plain string sorting puts "IMG_10" first because "1" < "2", which is exactly
 * wrong for a tool whose users are looking at numbered photo sequences. The
 * browser's own collator does this correctly, including for non-Latin scripts,
 * so there is nothing to hand-roll (D21).
 */
const naturalCollator =
  typeof Intl !== "undefined"
    ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
    : null;

export function naturalCompare(a: string, b: string): number {
  return naturalCollator ? naturalCollator.compare(a, b) : a < b ? -1 : a > b ? 1 : 0;
}

// ===========================================================================
// Thumbnail
// ===========================================================================

/**
 * One lazily loaded thumbnail.
 *
 * Two things here are deliberate. The URL comes from the shared registry, so
 * the same Blob always yields the same string and every string is revoked on
 * unmount (defect 15). And `loading="lazy"` plus explicit width and height
 * means the browser decodes only what is scrolled into view — the original
 * rendered a full-resolution `<img>` for every row at once, so a 300-photo
 * queue triggered 300 simultaneous full-size decodes before the user had
 * pressed anything.
 */
export function Thumb({
  blob,
  alt,
  urlFor,
}: {
  blob: Blob | null | undefined;
  alt: string;
  urlFor: (blob: Blob | null | undefined) => string | null;
}) {
  const url = urlFor(blob);
  if (!url) {
    return (
      <div
        className="flex items-center justify-center rounded border border-[--border] bg-[--muted]"
        style={{ width: THUMB_PX, height: THUMB_PX }}
        aria-hidden="true"
      >
        <FileImage className="h-4 w-4 text-[--muted-foreground]" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={THUMB_PX}
      height={THUMB_PX}
      className="rounded border border-[--border] object-cover"
      style={{ width: THUMB_PX, height: THUMB_PX }}
    />
  );
}

// ===========================================================================
// Manual rename cell
// ===========================================================================

/**
 * Per-file name override (feature 25).
 *
 * The typed value is held locally and only committed on blur or Enter, so the
 * whole table is not re-planned on every keystroke. It is passed through the
 * engine's `sanitiseFilename` before it is accepted, and the warnings that
 * come back are shown rather than swallowed: if the user types a name with a
 * slash or a trailing dot, they get told what was changed and why instead of
 * silently receiving a different file (D9).
 */
function ManualName({
  entry,
  plannedName,
  onRename,
  disabled,
}: {
  entry: FileEntry;
  plannedName: string;
  onRename: (id: string, name: string | undefined) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const start = useCallback(() => {
    setDraft(entry.manualName ?? plannedName);
    setWarnings([]);
    setEditing(true);
  }, [entry.manualName, plannedName]);

  const commit = useCallback(() => {
    const raw = draft.trim();
    setEditing(false);
    if (raw.length === 0) {
      setWarnings([]);
      onRename(entry.id, undefined); // cleared — fall back to the pattern
      return;
    }
    const result = sanitiseFilename(raw, "image");
    setWarnings(result.warnings);
    onRename(entry.id, result.name);
  }, [draft, entry.id, onRename]);

  if (!editing) {
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className={cx(
            "block max-w-full truncate rounded px-1 text-left text-xs hover:bg-[--muted] disabled:cursor-not-allowed disabled:hover:bg-transparent",
            FOCUS,
          )}
          title={
            entry.manualName
              ? "This name was set by hand. Click to change it, or clear it to go back to the pattern."
              : "Click to rename just this file"
          }
        >
          {entry.manualName ?? plannedName}
        </button>
        {entry.manualName && (
          <span className="ml-1 align-middle">
            <Badge tone="warn">manual</Badge>
          </span>
        )}
        {warnings.length > 0 && (
          <p className="px-1 text-[11px] text-amber-600 dark:text-amber-400">
            {warnings.join(" ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      maxLength={MAX_NAME_BYTES}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
      aria-label={`New name for ${entry.file.name}`}
      className={cx(INPUT, "h-7 text-xs")}
    />
  );
}

// ===========================================================================
// Preview table
// ===========================================================================

export interface PreviewTableProps {
  entries: FileEntry[];
  plan: PlanView;
  urlFor: (blob: Blob | null | undefined) => string | null;
  busy: boolean;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onToggleSkip: (id: string) => void;
  onRename: (id: string, name: string | undefined) => void;
  onInspect: (id: string) => void;
  onCompare: (id: string) => void;
}

/**
 * The queue, as a real table.
 *
 * WHY ONLY `RENDER_LIMIT` ROWS GET DOM (D11)
 * The queue holds up to 1,000 files. Every row carries a thumbnail, an
 * editable name and six buttons, so rendering all of them costs thousands of
 * DOM nodes and, worse, a decode per image. Rows past the limit are still
 * counted, still processed, still exported and still in the ZIP — the table
 * says exactly how many are hidden and offers filtering and sorting so the
 * interesting ones can be brought into view. What it never does is quietly
 * show a subset and let the totals disagree with the list.
 *
 * KEYBOARD REORDERING
 * The original had a drag handle and nothing else, so ordering — which decides
 * the `{index}` and `{counter}` tokens, and therefore the filenames — was
 * mouse-only. Each row now has real Up and Down buttons. They are ordinary
 * buttons in the tab order, they announce themselves with the file's name, and
 * they are disabled at the ends of the list rather than silently doing
 * nothing.
 *
 * THE QUEUE NUMBER IS LOOKED UP, NOT SEARCHED FOR
 * The row number, and whether Up/Down are disabled, both depend on the file's
 * position in the real queue rather than its position in the filtered and
 * sorted view. The first version of this file called `entries.indexOf(entry)`
 * once per rendered row, which is a linear scan inside a render loop: 200 rows
 * against a 1,000-file queue is 200,000 comparisons on every keystroke in the
 * filter box. A single id -> index Map is built once per queue change instead.
 */
function PreviewTable({
  entries,
  plan,
  urlFor,
  busy,
  onMove,
  onRemove,
  onToggleSkip,
  onRename,
  onInspect,
  onCompare,
}: PreviewTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("queue");
  const [query, setQuery] = useState("");

  const queueIndexById = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry, index) => map.set(entry.id, index));
    return map;
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return entries;
    return entries.filter((entry) => {
      const planned = plan.nameById.get(entry.id) ?? "";
      return (
        entry.file.name.toLowerCase().includes(needle) ||
        entry.path.toLowerCase().includes(needle) ||
        planned.toLowerCase().includes(needle)
      );
    });
  }, [entries, plan.nameById, query]);

  const sorted = useMemo(() => {
    if (sortKey === "queue") return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return naturalCompare(a.file.name, b.file.name);
        case "newName":
          return naturalCompare(
            plan.nameById.get(a.id) ?? a.file.name,
            plan.nameById.get(b.id) ?? b.file.name,
          );
        case "size":
          return b.file.size - a.file.size;
        case "savings": {
          // Files with no output yet sort last; there is nothing to compare.
          const sa = a.outputBlob ? a.file.size - a.outputBlob.size : -Infinity;
          const sb = b.outputBlob ? b.file.size - b.outputBlob.size : -Infinity;
          return sb - sa;
        }
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, plan.nameById]);

  const visible = sorted.slice(0, RENDER_LIMIT);
  const hidden = sorted.length - visible.length;

  if (entries.length === 0) return null;

  return (
    <section className={cx(BOX, "overflow-hidden")} aria-label="Files in the queue">
      <div className="flex flex-wrap items-center gap-2 border-b border-[--border] p-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4" aria-hidden="true" />
          Queue
          <Badge>{entries.length.toLocaleString()} files</Badge>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor="queue-filter" className="sr-only">
            Filter files by name
          </label>
          <input
            id="queue-filter"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name…"
            className={cx(INPUT, "h-8 w-44 text-xs")}
          />
          <label htmlFor="queue-sort" className="sr-only">
            Sort the queue
          </label>
          <Select<SortKey>
            id="queue-sort"
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: "queue", label: "Queue order" },
              { value: "name", label: "Original name" },
              { value: "newName", label: "New name" },
              { value: "size", label: "Largest first" },
              { value: "savings", label: "Biggest saving" },
            ]}
          />
        </div>
      </div>

      {sortKey !== "queue" && (
        <div className="border-b border-[--border] px-3 py-2">
          <Note>
            Sorting only changes what you see. The <code>{"{index}"}</code> and{" "}
            <code>{"{counter}"}</code> tokens always follow the queue order, so switch back
            to <strong>Queue order</strong> before reordering files by hand.
          </Note>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Every queued image with its original name, the name it will be saved under, and
            its size before and after processing.
          </caption>
          <thead>
            <tr className="border-b border-[--border] text-[--muted-foreground]">
              <th scope="col" className="w-10 p-2 font-normal">
                #
              </th>
              <th scope="col" className="p-2 font-normal">
                Original
              </th>
              <th scope="col" className="p-2 font-normal">
                New name
              </th>
              <th scope="col" className="p-2 text-right font-normal">
                Before
              </th>
              <th scope="col" className="p-2 text-right font-normal">
                After
              </th>
              <th scope="col" className="w-32 p-2 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => {
              const planned = plan.nameById.get(entry.id) ?? entry.file.name;
              const planError = plan.errorById.get(entry.id);
              const planWarnings = plan.warningsById.get(entry.id) ?? [];
              const suffixed = plan.suffixedIds.has(entry.id);
              const out = entry.outputBlob;
              const saving = out ? estimateSizeSavings(entry.file.size, out.size) : null;
              const queueIndex = queueIndexById.get(entry.id) ?? 0;

              return (
                <tr
                  key={entry.id}
                  className={cx(
                    "border-b border-[--border] align-top",
                    entry.skipped && "opacity-50",
                  )}
                >
                  <td className="p-2 tabular-nums text-[--muted-foreground]">
                    {queueIndex + 1}
                  </td>

                  <td className="p-2">
                    <div className="flex items-start gap-2">
                      <Thumb blob={entry.file} alt="" urlFor={urlFor} />
                      <div className="min-w-0">
                        <div className="truncate" title={entry.path}>
                          {entry.file.name}
                        </div>
                        {entry.path !== entry.file.name && (
                          <div
                            className="truncate text-[11px] text-[--muted-foreground]"
                            title={entry.path}
                          >
                            <FolderTree className="mr-1 inline h-3 w-3" aria-hidden="true" />
                            {entry.path}
                          </div>
                        )}
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {entry.width != null && entry.height != null && (
                            <span className="text-[11px] text-[--muted-foreground]">
                              {entry.width}×{entry.height}
                            </span>
                          )}
                          {hasGpsData(entry.exif) && (
                            <Badge tone="warn">
                              <MapPin className="mr-0.5 inline h-2.5 w-2.5" aria-hidden="true" />
                              GPS
                            </Badge>
                          )}
                          {entry.skipped && <Badge>skipped</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-2">
                    <ManualName
                      entry={entry}
                      plannedName={planned}
                      onRename={onRename}
                      disabled={busy}
                    />
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {suffixed && <Badge tone="warn">renamed to avoid a clash</Badge>}
                      {entry.keptOriginal && (
                        <Badge tone="good">original kept — already smaller</Badge>
                      )}
                    </div>
                    {planError && (
                      <p className="mt-0.5 text-[11px] text-[--destructive]">{planError}</p>
                    )}
                    {entry.error && (
                      <p className="mt-0.5 text-[11px] text-[--destructive]">{entry.error}</p>
                    )}
                    {(planWarnings.length > 0 || (entry.warnings?.length ?? 0) > 0) && (
                      <details className="mt-0.5">
                        <summary
                          className={cx(
                            "cursor-pointer text-[11px] text-amber-600 dark:text-amber-400",
                            FOCUS,
                          )}
                        >
                          {planWarnings.length + (entry.warnings?.length ?? 0)} note(s)
                        </summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[--muted-foreground]">
                          {[...planWarnings, ...(entry.warnings ?? [])].map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>

                  <td className="p-2 text-right tabular-nums">
                    {formatBytes(entry.file.size)}
                  </td>

                  <td className="p-2 text-right tabular-nums">
                    {out ? (
                      <>
                        <div>{formatBytes(out.size)}</div>
                        {saving && (
                          <div
                            className={cx(
                              "text-[11px]",
                              saving.savings > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-[--muted-foreground]",
                            )}
                          >
                            {saving.savings > 0 ? `−${saving.percent}%` : "no change"}
                          </div>
                        )}
                      </>
                    ) : (
                      // Not "0 B", not "−100%": nothing has been measured yet (D20).
                      <span className="text-[--muted-foreground]">not processed</span>
                    )}
                  </td>

                  <td className="p-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton
                        label={`Move ${entry.file.name} up`}
                        disabled={busy || sortKey !== "queue" || queueIndex === 0}
                        onClick={() => onMove(entry.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Move ${entry.file.name} down`}
                        disabled={
                          busy || sortKey !== "queue" || queueIndex === entries.length - 1
                        }
                        onClick={() => onMove(entry.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Show the metadata in ${entry.file.name}`}
                        onClick={() => onInspect(entry.id)}
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Compare ${entry.file.name} before and after`}
                        disabled={!entry.outputBlob}
                        onClick={() => onCompare(entry.id)}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={
                          entry.skipped
                            ? `Include ${entry.file.name} again`
                            : `Leave ${entry.file.name} out of this run`
                        }
                        disabled={busy}
                        onClick={() => onToggleSkip(entry.id)}
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={`Remove ${entry.file.name} from the queue`}
                        danger
                        disabled={busy}
                        onClick={() => onRemove(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <div className="border-t border-[--border] p-3">
          <Note>
            Showing the first {RENDER_LIMIT.toLocaleString()} of{" "}
            {sorted.length.toLocaleString()} files. The other {hidden.toLocaleString()} are
            still queued, still processed and still included in the download — only their
            rows are hidden, so the page stays fast. Use the filter or the sort to bring a
            particular file into view.
          </Note>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="p-6 text-center text-xs text-[--muted-foreground]">
          No file matches “{query}”.
        </div>
      )}
    </section>
  );
}

// ===========================================================================
// Duplicates
// ===========================================================================

export interface DuplicateView {
  /** Groups of ids whose BYTES are identical. */
  exact: string[][];
  /** id -> ids that look like it. */
  similar: Map<string, string[]>;
  /** Ids excluded from visual matching because they have no tonal variation. */
  skippedFlat: string[];
  /** False when hashing was not run for this queue, so nothing was compared. */
  compared: boolean;
}

/**
 * Duplicate finder (features 51-58).
 *
 * THE THING THIS PANEL MUST NEVER DO is claim a result it does not have. The
 * original invented an all-zero hash whenever hashing had not happened, and
 * the all-zero hash is a real value meaning "flat image" — so files that had
 * simply not been hashed were shown to the user as visual duplicates of each
 * other, inside a panel with a Remove button (defect 21). Deleting someone's
 * photos on the strength of a fabricated measurement is about as bad as a bug
 * gets.
 *
 * So there are three distinct states here and all three are named on screen:
 * compared and matched, compared and not matched, and NOT COMPARED. A file
 * that could not be hashed appears under “not compared” with the reason, never
 * in a match group.
 *
 * Exact and visual matches are also kept apart. Identical bytes is a fact.
 * Similar-looking is a judgement with a threshold, and the percentage is shown
 * so the user can weigh it. Where a percentage cannot be computed — because
 * one of the two files has no perceptual hash — the cell says so rather than
 * showing a number that was never measured (D20).
 */
function DuplicatesPanel({
  entries,
  duplicates,
  urlFor,
  onRemove,
  busy,
}: {
  entries: FileEntry[];
  duplicates: DuplicateView;
  urlFor: (blob: Blob | null | undefined) => string | null;
  onRemove: (ids: string[]) => void;
  busy: boolean;
}) {
  const byId = useMemo(() => {
    const map = new Map<string, FileEntry>();
    for (const entry of entries) map.set(entry.id, entry);
    return map;
  }, [entries]);

  const notHashed = useMemo(
    () => entries.filter((e) => !e.hashes && !e.contentHash),
    [entries],
  );

  /** Collapse the id -> ids map into stable, deduplicated groups. */
  const similarGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: string[][] = [];
    for (const [id, others] of duplicates.similar) {
      if (seen.has(id)) continue;
      const group = [id, ...others.filter((o) => !seen.has(o))];
      if (group.length < 2) continue;
      for (const member of group) seen.add(member);
      groups.push(group);
    }
    return groups;
  }, [duplicates.similar]);

  const totalFindings = duplicates.exact.length + similarGroups.length;

  return (
    <Section
      icon={<Hash className="h-4 w-4" aria-hidden="true" />}
      title="Duplicates"
      badge={
        duplicates.compared ? (
          <Badge tone={totalFindings > 0 ? "warn" : "good"}>
            {totalFindings > 0 ? `${totalFindings} to review` : "none found"}
          </Badge>
        ) : (
          <Badge>not compared</Badge>
        )
      }
    >
      {!duplicates.compared ? (
        <Note>
          These files have not been compared yet. Comparing needs a second read of every
          image, so it runs as part of processing rather than on every change to the queue.
          Process the batch and the results will appear here.
        </Note>
      ) : (
        <>
          {totalFindings === 0 && (
            <Note>
              Every file that could be compared was compared, and no two of them are the
              same or look alike.
            </Note>
          )}

          {duplicates.exact.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">
                Identical files
                <span className="ml-1 font-normal text-[--muted-foreground]">
                  — byte for byte the same, so keeping one loses nothing
                </span>
              </h4>
              {duplicates.exact.map((group, i) => {
                const extras = group.length - 1;
                return (
                  <div key={`exact-${i}`} className="rounded-md border border-[--border] p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {group.map((id) => {
                        const entry = byId.get(id);
                        if (!entry) return null;
                        return (
                          <span key={id} className="flex items-center gap-1.5">
                            <Thumb blob={entry.file} alt="" urlFor={urlFor} />
                            <span
                              className="max-w-[16rem] truncate text-xs"
                              title={entry.path}
                            >
                              {entry.file.name}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2">
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => onRemove(group.slice(1))}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Keep the first, remove {extras}{" "}
                        {extras === 1 ? "copy" : "copies"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {similarGroups.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">
                Images that look alike
                <span className="ml-1 font-normal text-[--muted-foreground]">
                  — a judgement, not a fact: check before removing anything
                </span>
              </h4>
              {similarGroups.map((group, i) => {
                const first = byId.get(group[0]!);
                return (
                  <div
                    key={`similar-${i}`}
                    className="rounded-md border border-[--border] p-2"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {group.map((id) => {
                        const entry = byId.get(id);
                        if (!entry) return null;
                        const isReference = first != null && entry.id === first.id;
                        // similarityPercent takes a DISTANCE, so the distance is
                        // computed here from the two dHashes (ENGINE PART 4).
                        const percent =
                          !isReference && first?.hashes && entry.hashes
                            ? similarityPercent(
                                hammingDistance(first.hashes.dHash, entry.hashes.dHash),
                              )
                            : null;
                        return (
                          <span key={id} className="flex items-center gap-1.5">
                            <Thumb blob={entry.file} alt="" urlFor={urlFor} />
                            <span className="min-w-0">
                              <span
                                className="block max-w-[14rem] truncate text-xs"
                                title={entry.path}
                              >
                                {entry.file.name}
                              </span>
                              <span className="text-[11px] text-[--muted-foreground]">
                                {isReference
                                  ? "reference image"
                                  : percent == null
                                    ? "similarity not measured"
                                    : `${percent}% alike`}
                              </span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2">
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => onRemove(group.slice(1))}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Keep the first, remove the other {group.length - 1}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {duplicates.skippedFlat.length > 0 && (
            <Note>
              {duplicates.skippedFlat.length} image
              {duplicates.skippedFlat.length === 1 ? " was" : "s were"} left out of the
              visual comparison because{" "}
              {duplicates.skippedFlat.length === 1 ? "it has" : "they have"} almost no
              tonal variation — a blank scan or a solid colour. Any two such images score
              as a perfect match against each other, which would be a wrong answer rather
              than a useful one.
            </Note>
          )}

          {notHashed.length > 0 && (
            <Note>
              {notHashed.length} file{notHashed.length === 1 ? "" : "s"} could not be
              compared, usually because the image could not be decoded in this browser.
              {notHashed.length === 1 ? " It is" : " They are"} listed nowhere above rather
              than being guessed at.
            </Note>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * ===========================================================================
 * UI PART 5 of 7 — the viewers: EXIF inspector, before/after comparison,
 * quality matrix, and run history.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-2-UI-PART-4.tsx. PART 6 holds the worker client and
 * the run orchestration; PART 7 holds the download plumbing and the default
 * export `BulkImageRenamerOptimizerUI`.
 *
 * Assembly order of record (STATUS.md repeats it): PART 1, 2, 3, 4, 5, 6, 7
 * into a single `ui.tsx`. PARTS 1-3 were written when the UI was planned as
 * four files and their headers still say "of 4", and PART 4 says "of 6" —
 * ignore both, the count is 7. Those headers are cosmetic and are listed in
 * STATUS.md as known discrepancies.
 *
 * ---------------------------------------------------------------------------
 * THREE DEFECTS OF MY OWN, ALL FIXED IN THIS FILE
 * ---------------------------------------------------------------------------
 * The first two were caught while moving these components out of PART 4. The
 * third was caught LATER, after this file had already been pushed and verified
 * byte-for-byte — which is exactly the point of D25: confirming that a file
 * arrived intact says nothing about whether it is correct.
 *
 * 1. `useHistory` called `safeLocalSet` from INSIDE a `setItems` updater. A
 *    state updater must be pure: React is allowed to run it twice (and does,
 *    in development StrictMode) and to discard the first result. The state
 *    would end up correct while `localStorage` kept the value from the run
 *    that was thrown away. Fixed by computing the next list first, then
 *    setting state and persisting side by side (D28).
 *
 * 2. `QualityMatrixModal` listed the `optimize` object in its effect's
 *    dependency array. The parent builds that object fresh on every render,
 *    so its identity changes constantly, so the effect re-ran and started six
 *    fresh encodes — forever, on the main thread, on the user's photo. Fixed
 *    by capturing the settings in a ref when the dialog opens; the grid is
 *    deliberately a snapshot of the settings as they were when it was asked
 *    for.
 *
 * 3. `useHistory` TREATED THE STORAGE HELPERS AS GENERIC JSON WHEN THEY ARE
 *    PLAIN STRING I/O. PART 3 declares them as:
 *
 *        safeLocalGet(key: string): string | null
 *        safeLocalSet(key: string, value: string): boolean
 *        safeLocalRemove(key: string): void
 *
 *    This file called `safeLocalGet<HistoryItem[]>(HISTORY_KEY)` — a type
 *    argument on a function that has no type parameters — then `Array.isArray`
 *    on the resulting string, then `safeLocalSet(HISTORY_KEY, next)` with an
 *    array. Three type errors, so the build fails outright; and even if it had
 *    compiled, `Array.isArray` of a string is always false, so no stored run
 *    would ever have loaded. `useNamedPresets` in PART 3 does the serialising
 *    correctly, so this file was the outlier rather than the helpers.
 *
 *    Fixed below with `JSON.parse` on read and `JSON.stringify` on write. The
 *    read is wrapped in try/catch: a key that has been corrupted by hand or by
 *    an older version of the tool is cleared rather than allowed to throw on
 *    mount, because an unreadable history is a nuisance and a crashing tool is
 *    a failure. The D28-clean `commit(next)` structure is unchanged.
 *
 *    The lesson, recorded as D22, is that a helper's shape has to be READ from
 *    the file that declares it. "Local storage helper" sounds like it takes an
 *    object, and that assumption survived a full verification pass unchallenged.
 *
 * ---------------------------------------------------------------------------
 * IMPORTS
 * ---------------------------------------------------------------------------
 * Everything used here — `hasGpsData`, `processImageDetailed`,
 * `estimateSizeSavings`, `formatBytes`, `diffConfigs`, the atoms, and
 * `safeLocalGet` / `safeLocalSet` / `safeLocalRemove` from PART 3 — is already
 * in scope once the parts are concatenated, so this file needs no import line
 * of its own.
 */

// ===========================================================================
// EXIF inspector
// ===========================================================================

/**
 * Everything the parser found in one file (features 41-50).
 *
 * In the original this rendered only for the selected file, and selecting a
 * file also opened the diff modal on top of it — so the inspector was, in
 * practice, unreachable. Here it is its own dialog, opened by its own button
 * on every row.
 *
 * The GPS block is deliberately loud. A user about to publish photos is
 * exactly the user who needs to know that the file records where they live.
 *
 * `add()` drops empty values instead of printing “undefined”, and an image
 * with no metadata at all gets a sentence saying so — that is an answer, not a
 * failure (D9).
 */
function ExifInspector({ entry, onClose }: { entry: FileEntry; onClose: () => void }) {
  const exif = entry.exif;
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    if (value == null || value === "") return;
    rows.push([label, String(value)]);
  };

  add("Camera make", exif?.make);
  add("Camera model", exif?.model);
  add("Lens", exif?.lens);
  add("Taken", exif?.date ? new Date(exif.date).toLocaleString() : undefined);
  add("ISO", exif?.iso);
  add("Aperture", exif?.fNumber ? `f/${exif.fNumber}` : undefined);
  add(
    "Shutter",
    exif?.exposureTime
      ? exif.exposureTime < 1
        ? `1/${Math.round(1 / exif.exposureTime)} s`
        : `${exif.exposureTime} s`
      : undefined,
  );
  add("Orientation flag", exif?.orientation);
  add(
    "Pixels",
    entry.width != null && entry.height != null
      ? `${entry.width} × ${entry.height}`
      : undefined,
  );
  add("File size", formatBytes(entry.file.size));
  add("Type", entry.file.type || "unknown");
  add("Last modified", new Date(entry.file.lastModified).toLocaleString());

  return (
    <Dialog title={`Metadata — ${entry.file.name}`} onClose={onClose}>
      {entry.exifError && <ErrorBanner message={entry.exifError} />}

      {hasGpsData(exif) && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500 bg-amber-500/10 p-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-medium">This photo records where it was taken.</p>
            <p className="text-[--muted-foreground]">
              {exif?.gps?.latitude?.toFixed(5)}, {exif?.gps?.longitude?.toFixed(5)} — anyone
              you send the original to can read this. Leaving “Remove location data” on
              means it is not written into the processed copy.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 && !entry.exifError && (
        <Note>
          This file carries no metadata at all. That is common for screenshots, exported
          graphics and images that have already been stripped — it is an answer, not a
          failure.
        </Note>
      )}

      {rows.length > 0 && (
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Metadata found in {entry.file.name}</caption>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-[--border] last:border-0">
                <th
                  scope="row"
                  className="w-40 py-1.5 pr-2 font-normal text-[--muted-foreground]"
                >
                  {label}
                </th>
                <td className="py-1.5 break-words">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {entry.hashes && (
        <div className="mt-3 space-y-1 text-[11px] text-[--muted-foreground]">
          <div>
            Visual fingerprints — average <code>{entry.hashes.aHash}</code>, difference{" "}
            <code>{entry.hashes.dHash}</code>
            {entry.hashes.flat && " (flat image: excluded from visual matching)"}
          </div>
          {entry.contentHash && (
            <div>
              SHA-256 of the file — <code>{entry.contentHash.slice(0, 32)}…</code>
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <CopyButton
          label="Copy everything as JSON"
          getText={() =>
            JSON.stringify(
              {
                file: entry.file.name,
                path: entry.path,
                size: entry.file.size,
                type: entry.file.type,
                lastModified: new Date(entry.file.lastModified).toISOString(),
                width: entry.width ?? null,
                height: entry.height ?? null,
                exif: entry.exif ?? null,
                hashes: entry.hashes ?? null,
                contentHash: entry.contentHash ?? null,
              },
              null,
              2,
            )
          }
        />
      </div>
    </Dialog>
  );
}

// ===========================================================================
// Before / after comparison
// ===========================================================================

/**
 * Side-by-side comparison with a wipe slider (feature 85).
 *
 * A percentage saving means nothing on its own — the only question that
 * matters is whether the smaller file still looks right. The slider is a plain
 * range input, so it works by keyboard, and the numbers underneath are the
 * measured sizes rather than an estimate (D20).
 *
 * When the never-grow guard kept the original bytes, this says so: both halves
 * of the comparison are then the same image, and pretending otherwise would
 * leave the user hunting for a difference that does not exist (D19).
 */
function DiffModal({
  entry,
  urlFor,
  onClose,
}: {
  entry: FileEntry;
  urlFor: (blob: Blob | null | undefined) => string | null;
  onClose: () => void;
}) {
  const [wipe, setWipe] = useState(50);
  const beforeUrl = urlFor(entry.file);
  const afterUrl = urlFor(entry.outputBlob);
  const output = entry.outputBlob;
  const saving = output ? estimateSizeSavings(entry.file.size, output.size) : null;

  return (
    <Dialog title={`Before and after — ${entry.file.name}`} onClose={onClose} wide>
      {!afterUrl || !output ? (
        <Note>This file has not been processed yet, so there is nothing to compare.</Note>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-md border border-[--border] bg-[--muted]">
            {beforeUrl && (
              <img
                src={beforeUrl}
                alt={`${entry.file.name} before processing`}
                className="block max-h-[60vh] w-full object-contain"
              />
            )}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
            >
              <img
                src={afterUrl}
                alt={`${entry.file.name} after processing`}
                className="block max-h-[60vh] w-full object-contain"
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-[--primary]"
              style={{ left: `${wipe}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="mt-3">
            <Field
              label={`Wipe position — ${wipe}% original, ${100 - wipe}% processed`}
              htmlFor="diff-wipe"
            >
              <Range id="diff-wipe" value={wipe} onChange={setWipe} min={0} max={100} />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Before" value={formatBytes(entry.file.size)} />
            <Stat label="After" value={formatBytes(output.size)} />
            <Stat
              label="Saved"
              value={saving && saving.savings > 0 ? `${saving.percent}%` : "nothing"}
              tone={saving && saving.savings > 0 ? "good" : undefined}
            />
            <Stat
              label="Pixels"
              value={
                entry.outputWidth != null && entry.outputHeight != null
                  ? `${entry.outputWidth} × ${entry.outputHeight}`
                  : "unchanged"
              }
            />
          </div>

          {entry.keptOriginal && (
            <div className="mt-3">
              <Note>
                Re-encoding this image made it bigger, so the original bytes were kept
                instead. Both sides of this comparison are therefore the same file.
              </Note>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

// ===========================================================================
// Quality matrix
// ===========================================================================

const MATRIX_QUALITIES = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

interface MatrixSample {
  quality: number;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Encode one image at several quality levels so the user can choose with their
 * eyes instead of guessing at a number (feature 86).
 *
 * Every figure in this grid is REAL: each cell is an actual encode of the
 * actual file at that setting, and the byte count is the size of the blob that
 * came back. There is no interpolation and no model of what a quality setting
 * “usually” costs, because the answer depends entirely on the image — a flat
 * graphic and a detailed landscape behave nothing alike (D20).
 *
 * WHY THE SETTINGS ARE CAPTURED IN A REF
 * The first version of this component had `optimize` in the effect's
 * dependency array. The parent rebuilds that object on every render, so its
 * identity changes constantly, so the effect tore down and restarted — six
 * main-thread encodes at a time, without end. The grid is meant to be a
 * snapshot of the settings as they stood when it was opened, so the settings
 * are read once into a ref and the effect depends only on the file. Closing
 * the dialog mid-encode flips `cancelled`, so no `setState` lands after
 * unmount, and no side effect is ever fired from inside a state updater (D28).
 *
 * Three settings are deliberately overridden for the samples: size targeting,
 * the never-grow guard, and the copy-original shortcut. The whole point is to
 * isolate what the quality slider does, and each of those would silently
 * substitute a different result for one or more cells.
 */
function QualityMatrixModal({
  entry,
  optimize,
  urlFor,
  onPick,
  onClose,
}: {
  entry: FileEntry;
  optimize: OptimizeOptions;
  urlFor: (blob: Blob | null | undefined) => string | null;
  onPick: (quality: number) => void;
  onClose: () => void;
}) {
  const [samples, setSamples] = useState<MatrixSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);

  // Snapshot of the settings as they were when the dialog opened. Assigning
  // `.current` on every render keeps it fresh without re-triggering anything;
  // the effect below never depends on it.
  const optimizeRef = useRef(optimize);
  optimizeRef.current = optimize;

  useEffect(() => {
    let cancelled = false;
    const snapshot = optimizeRef.current;
    const collected: MatrixSample[] = [];
    setSamples([]);
    setError(null);
    setRunning(true);

    (async () => {
      for (const quality of MATRIX_QUALITIES) {
        if (cancelled) return;
        const result = await processImageDetailed(entry.file, {
          ...snapshot,
          quality,
          targetBytes: undefined,
          neverGrow: false,
          copyOriginalBytes: false,
        });
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          setRunning(false);
          return;
        }
        collected.push({
          quality,
          blob: result.output.blob,
          width: result.output.width,
          height: result.output.height,
        });
        setSamples([...collected]);
      }
      if (!cancelled) setRunning(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [entry.file]);

  return (
    <Dialog
      title={`Quality comparison — ${entry.file.name}`}
      onClose={onClose}
      wide
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {error && <ErrorBanner message={error} />}

      {running && !error && (
        <div
          className="mb-3 flex items-center gap-2 text-xs text-[--muted-foreground]"
          aria-live="polite"
        >
          <Spinner />
          Encoding sample {Math.min(samples.length + 1, MATRIX_QUALITIES.length)} of{" "}
          {MATRIX_QUALITIES.length}…
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {samples.map((sample) => {
          const url = urlFor(sample.blob);
          const saving = estimateSizeSavings(entry.file.size, sample.blob.size);
          return (
            <figure key={sample.quality} className={cx(BOX, "overflow-hidden")}>
              {url && (
                <img
                  src={url}
                  alt={`${entry.file.name} encoded at quality ${Math.round(
                    sample.quality * 100,
                  )} percent`}
                  loading="lazy"
                  className="block h-40 w-full object-cover"
                />
              )}
              <figcaption className="space-y-1 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Quality {Math.round(sample.quality * 100)}
                  </span>
                  <span className="tabular-nums">{formatBytes(sample.blob.size)}</span>
                </div>
                <div className="text-[11px] text-[--muted-foreground]">
                  {sample.width} × {sample.height} ·{" "}
                  {saving.savings > 0
                    ? `${saving.percent}% smaller than the original`
                    : "larger than the original at this setting"}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onPick(sample.quality);
                    onClose();
                  }}
                >
                  Use this quality
                </Button>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="mt-3">
        <Note>
          Each tile above is a real encode of this file at that setting, not an estimate.
          Two images at the same quality number can differ enormously in size, so the only
          reliable way to choose is to look. Size targeting and the never-grow guard are
          switched off for these samples so that quality is the only thing that varies.
        </Note>
      </div>
    </Dialog>
  );
}

// ===========================================================================
// History
// ===========================================================================

/**
 * Recent runs, stored on this device (features 91-94).
 *
 * D10 governs this panel: a stored configuration is NEVER applied on its own.
 * The user asks for it, sees a plain-language list of exactly what would change
 * against their current settings — produced by the engine's `diffConfigs`, so
 * it cannot drift from what would really happen — and then decides. Silently
 * restoring settings from a previous session is how people end up processing a
 * hundred photos into the wrong output format.
 *
 * Each entry also records the real outcome of the run — how many files, how
 * many bytes saved — so the list is a log rather than a row of labels.
 *
 * ON THE STORAGE HELPERS
 * `safeLocalGet` and `safeLocalSet` (PART 3) move STRINGS, not objects: they
 * wrap `localStorage` so that a private-browsing or quota failure returns
 * `null` / `false` instead of throwing. Serialising is this hook's job, which
 * is why `JSON.parse` and `JSON.stringify` appear here explicitly. An earlier
 * version of this file passed a type argument to `safeLocalGet` and an array to
 * `safeLocalSet`, which does not compile — see the note at the top of the file.
 *
 * The parse is guarded: a key left behind by an older build, or edited by hand,
 * should cost the user their history list and nothing else. It is cleared and
 * the hook starts empty, rather than throwing during mount and taking the whole
 * tool down with it.
 *
 * ON THE WRITES (D28)
 * The next list is computed from `items` in the callback body, then state is
 * set and the value is persisted. Nothing is written from inside an updater:
 * updaters must be pure, React may run them twice and discard a result, and a
 * discarded result that has already reached `localStorage` is a stored value
 * nobody ever computed.
 */
function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const raw = safeLocalGet(HISTORY_KEY);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setItems((parsed as HistoryItem[]).slice(0, MAX_HISTORY));
      }
    } catch {
      // Unreadable stored history: discard it rather than throw on mount.
      safeLocalRemove(HISTORY_KEY);
    }
  }, []);

  const commit = useCallback((next: HistoryItem[]) => {
    setItems(next);
    safeLocalSet(HISTORY_KEY, JSON.stringify(next));
  }, []);

  const record = useCallback(
    (item: HistoryItem) => {
      commit([item, ...items].slice(0, MAX_HISTORY));
    },
    [commit, items],
  );

  const remove = useCallback(
    (ts: number) => {
      commit(items.filter((i) => i.ts !== ts));
    },
    [commit, items],
  );

  const clear = useCallback(() => {
    setItems([]);
    safeLocalRemove(HISTORY_KEY);
  }, []);

  return { items, record, remove, clear };
}

function HistoryPanel({
  history,
  currentConfig,
  onApply,
  busy,
}: {
  history: ReturnType<typeof useHistory>;
  currentConfig: RenameOptimizeConfig;
  onApply: (config: RenameOptimizeConfig) => void;
  busy: boolean;
}) {
  const [pending, setPending] = useState<HistoryItem | null>(null);
  const changes = useMemo(
    () => (pending ? diffConfigs(currentConfig, pending.config) : []),
    [pending, currentConfig],
  );

  return (
    <Section
      icon={<History className="h-4 w-4" aria-hidden="true" />}
      title="Recent runs"
      badge={history.items.length > 0 ? <Badge>{history.items.length}</Badge> : undefined}
    >
      {history.items.length === 0 ? (
        <Note>
          Finished runs are listed here, on this device only, so you can go back to the
          settings you used last time. Nothing is ever restored automatically.
        </Note>
      ) : (
        <>
          <ul className="space-y-1.5">
            {history.items.map((item) => (
              <li
                key={item.ts}
                className="flex items-center gap-2 rounded-md border border-[--border] p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{item.label}</div>
                  <div className="text-[11px] text-[--muted-foreground]">
                    {new Date(item.ts).toLocaleString()}
                    {item.fileCount != null && ` · ${item.fileCount} files`}
                    {item.savedBytes != null &&
                      item.savedBytes > 0 &&
                      ` · saved ${formatBytes(item.savedBytes)}`}
                  </div>
                </div>
                <Button disabled={busy} onClick={() => setPending(item)}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reuse
                </Button>
                <IconButton
                  label={`Remove the run from ${new Date(
                    item.ts,
                  ).toLocaleString()} from this list`}
                  danger
                  onClick={() => history.remove(item.ts)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={history.clear}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear the list
          </Button>
        </>
      )}

      {pending && (
        <Dialog
          title="Reuse these settings?"
          onClose={() => setPending(null)}
          footer={
            <>
              <Button onClick={() => setPending(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  onApply(pending.config);
                  setPending(null);
                }}
              >
                Apply these settings
              </Button>
            </>
          }
        >
          {changes.length === 0 ? (
            <Note>
              These are exactly your current settings, so applying them changes nothing.
            </Note>
          ) : (
            <>
              <p className="mb-2 text-xs text-[--muted-foreground]">
                Applying this run would change {changes.length} setting
                {changes.length === 1 ? "" : "s"}:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                {changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </>
          )}
        </Dialog>
      )}
    </Section>
  );
}

/**
 * ===========================================================================
 * UI PART 6 of 7 — the worker client, the shared-pipeline bridge, and the run
 * orchestration hook.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-2-UI-PART-5.tsx. PART 7 holds the download actions
 * and the default export `BulkImageRenamerOptimizerUI`.
 *
 * Assembly order of record: PART 1, 2, 3, 4, 5, 6, 7 into one `ui.tsx`.
 * PARTS 1-3 still carry "of 4" in their headers from the original plan; the
 * count is 7. STATUS.md repeats this.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE WAS WRITTEN ONLY AFTER READING THREE OTHER FILES IN FULL
 * ---------------------------------------------------------------------------
 * Everything here is a call across a boundary: into the worker's message
 * protocol, and into the engine's batch runner. Both were re-read from source
 * before a line of this file existed (D22/D24), and both contained a detail
 * that a remembered signature would have got wrong:
 *
 *   1. `processBatchItem` does NOT return a `BatchItemOutput`. It returns a
 *      small anonymous object — blob, width, height, quality, keptOriginal,
 *      hashes, contentHash, error, warnings — and `runBatch` copies those
 *      fields onto the row it already built. A drop-in replacement must match
 *      that shape exactly, and nothing else, because `RunBatchOptions.
 *      processItem` is typed as `typeof processBatchItem`.
 *
 *   2. `decodeToBitmap` returns `{ bitmap, warnings }` and NOT the source
 *      format. The never-grow guard in `processBitmapCore` compares against
 *      the source's own format and does nothing at all when that argument is
 *      missing, so the format has to be read separately with
 *      `detectInputFormat(name, type)` — which takes TWO strings, not a File.
 *
 * ---------------------------------------------------------------------------
 * A DEFECT OF MY OWN, CAUGHT ON RE-READING THIS FILE (D29)
 * ---------------------------------------------------------------------------
 * The first version of `useProcessor` returned a fresh object literal on every
 * render, and `useRun` listed that object in the dependency array of the
 * effect that cancels work on unmount. A new object identity every render
 * means that effect's CLEANUP ran on every render — so the very first progress
 * update, which re-renders by design, aborted the batch that had just started
 * and told the worker to drop everything. The batch would have looked like it
 * cancelled itself the instant it began.
 *
 * This is the same family as the quality-matrix loop fixed in PART 5: an
 * effect keyed on a value the parent rebuilds every render. The rule this file
 * now follows is that effects depend only on things that are stable by
 * construction — `useCallback` results, or refs — never on composite objects.
 *
 * ---------------------------------------------------------------------------
 * IMPORTS
 * ---------------------------------------------------------------------------
 * Two lines that PART 1 does not already cover. The worker types are imported
 * with `import type` on purpose: a value import of `./worker` would pull the
 * worker module — and through it the whole engine, again — into the page
 * bundle, which defeats the point of having a worker at all. For the same
 * reason `workerResponseToBlob` is NOT imported; the four-line equivalent is
 * inlined below.
 */

import { detectInputFormat } from "./logic";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerControlMessage,
  WorkerErrorCode,
} from "./worker";

// ===========================================================================
// Worker client
// ===========================================================================

/** Rebuild a Blob from a worker result. Local copy — see the note above. */
function responseToBlob(res: WorkerResponse): Blob | null {
  if (res.blob) return res.blob;
  if (!res.bytes) return null;
  return new Blob([res.bytes], { type: res.mime || "application/octet-stream" });
}

export interface WorkerJob {
  bitmap: ImageBitmap;
  options: OptimizeOptions;
  exif: ExifData | null;
  exifOrientation?: number;
  originalBytes: number;
  originalBlob: Blob;
  originalFormat: OutputFormat | null;
  wantHashes: boolean;
}

export interface WorkerClient {
  /** Resolves true when the worker booted and can really draw. */
  ready: () => Promise<boolean>;
  run: (job: WorkerJob) => Promise<WorkerResponse>;
  cancelAll: () => void;
  dispose: () => void;
}

/**
 * One worker, many jobs, correlated by id.
 *
 * DEFECT 20: THE ID WAS A SHARED MUTABLE COUNTER
 * The original kept a single module-level `let currentId` and compared
 * incoming messages against its CURRENT value. With more than one job in
 * flight — which was the entire purpose of the pool — the counter had already
 * moved on by the time a result arrived, so results were matched to the wrong
 * request or dropped entirely. Here the id is allocated once per job and
 * captured in that job's own closure, and a Map of pending jobs is keyed by
 * it. Nothing is ever compared against "the current id", because there is no
 * such thing.
 *
 * DEFECT 20, SECOND HALF: DOUBLE `bitmap.close()`
 * Both the caller and the worker closed the bitmap, and the second call threw
 * on some browsers. Ownership is now unambiguous: the bitmap is TRANSFERRED,
 * so the main thread's handle is neutered the moment `postMessage` returns and
 * the worker closes it in its own `finally`. This file never closes a bitmap
 * it has handed over — only ones it failed to hand over.
 *
 * BOOT FAILURE IS A RESULT, NOT A HANG
 * If the worker cannot start — no module worker support, a dynamic import that
 * throws — `ready()` resolves false and the caller silently uses the
 * main-thread pipeline. The failure mode that must never happen is jobs that
 * are posted and never answered, so every pending job is also rejected if the
 * worker dies (`onerror`), and each one carries a timeout.
 */
export function createWorkerClient(): WorkerClient {
  let worker: Worker | null = null;
  let booted: Promise<boolean> | null = null;
  let disposed = false;
  let nextId = 1;

  const pending = new Map<
    number,
    { resolve: (res: WorkerResponse) => void; timer: ReturnType<typeof setTimeout> }
  >();

  const settle = (res: WorkerResponse) => {
    const entry = pending.get(res.id);
    if (!entry) return; // already timed out, or a pong
    pending.delete(res.id);
    clearTimeout(entry.timer);
    entry.resolve(res);
  };

  const failAll = (message: string, code: WorkerErrorCode) => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ ok: false, id, code, error: message });
    }
    pending.clear();
  };

  const spawn = (): Worker | null => {
    try {
      return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    } catch {
      return null;
    }
  };

  const ready = (): Promise<boolean> => {
    if (booted) return booted;
    booted = new Promise<boolean>((resolve) => {
      if (disposed || typeof Worker === "undefined") {
        resolve(false);
        return;
      }
      const instance = spawn();
      if (!instance) {
        resolve(false);
        return;
      }
      worker = instance;

      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const res = event.data;
        if (res.type === "pong") {
          // The probe answers the real question — is OffscreenCanvas actually
          // usable in this worker — rather than inferring it from a UA string.
          finish(res.ok === true);
          return;
        }
        settle(res);
      };

      instance.onerror = () => {
        failAll(
          "The background image worker stopped unexpectedly, so processing continued on the main thread.",
          "internal",
        );
        finish(false);
      };

      const probe: WorkerControlMessage = { type: "ping" };
      instance.postMessage(probe);

      // A worker that never answers a ping is a worker we will not wait for.
      setTimeout(() => finish(false), 4000);
    });
    return booted;
  };

  const run = async (job: WorkerJob): Promise<WorkerResponse> => {
    const ok = await ready();
    const instance = worker;
    if (!ok || !instance) {
      return { ok: false, id: -1, code: "internal", error: "No worker available." };
    }

    // Allocated once, captured here, never re-read from shared state.
    const id = nextId++;

    const request: WorkerRequest = {
      id,
      type: "process",
      bitmap: job.bitmap,
      options: job.options,
      exif: job.exif,
      exifOrientation: job.exifOrientation,
      originalBytes: job.originalBytes,
      originalBlob: job.originalBlob,
      originalFormat: job.originalFormat,
      wantHashes: job.wantHashes,
    };

    return new Promise<WorkerResponse>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({
          ok: false,
          id,
          code: "internal",
          error:
            "This image took too long in the background worker and was given up on. It was skipped rather than holding up the batch.",
        });
      }, 120000);

      pending.set(id, { resolve, timer });

      try {
        // Only the ImageBitmap is transferable. A Blob is cloneable but NOT
        // transferable — putting one in this list is defect 1, the bug that
        // made the original worker unable to return a single success.
        instance.postMessage(request, [job.bitmap]);
      } catch (e) {
        pending.delete(id);
        clearTimeout(timer);
        resolve({
          ok: false,
          id,
          code: "internal",
          error: `This image could not be sent to the background worker: ${
            (e as Error).message
          }`,
        });
      }
    });
  };

  const cancelAll = () => {
    if (!worker) return;
    // Ids are handed out in increasing order, so "everything already queued"
    // is one watermark rather than an unbounded set.
    const message: WorkerControlMessage = { type: "cancel-all", id: nextId - 1 };
    worker.postMessage(message);
  };

  const dispose = () => {
    disposed = true;
    failAll("Cancelled because the page moved on.", "cancelled");
    worker?.terminate();
    worker = null;
    booted = null;
  };

  return { ready, run, cancelAll, dispose };
}

// ===========================================================================
// The bridge: a worker-backed `processItem`
// ===========================================================================

/**
 * Wrap a worker client so it can stand in for `processBatchItem`.
 *
 * `RunBatchOptions.processItem` is typed `typeof processBatchItem`, so this
 * returns EXACTLY that shape — no more fields, no fewer. The engine copies the
 * result onto a row it has already planned; anything extra would be ignored
 * and anything missing would silently become `undefined` on the row.
 *
 * WHAT THE MAIN THREAD STILL DOES, AND WHY
 *   - DECODING. `decodeToBitmap` handles HEIC through `heic2any` and warns
 *     about GIF's single frame. The original worker called
 *     `createImageBitmap(file)` on raw HEIC bytes, which no browser can do, so
 *     HEIC worked only on the fallback path (defect 3). Decoding centrally
 *     means the worker is only ever handed something it can draw.
 *   - THE SOURCE FORMAT, via `detectInputFormat(name, type)`. Without it the
 *     never-grow guard is disabled, because keeping the original bytes is only
 *     safe when they are already in the format being emitted.
 *   - THE CONTENT HASH. It is a SHA-256 of the file's bytes, needs no pixels,
 *     and would mean shipping the whole file into the worker for nothing.
 *
 * The perceptual hashes are computed IN the worker, from the source bitmap it
 * already holds. That is the one real saving of this path over the main-thread
 * one: `processBatchItem` has to decode the file a second time to hash it,
 * whereas the worker hashes the bitmap it was given before resizing it.
 *
 * ON FAILURE THIS FALLS BACK. A worker error for one file must not cost the
 * user that file, so anything other than a cancellation is retried on the main
 * thread through the shared pipeline. That is a retry of one image, not a
 * second implementation of the pipeline.
 */
export function createWorkerProcessItem(
  client: WorkerClient,
): typeof processBatchItem {
  return async function processItemInWorker(input, config, exif, opts = {}) {
    const wantHashes = opts.wantHashes !== false;
    const warnings: string[] = [];

    // `copyOriginalBytes` never re-encodes anything, so there is nothing for a
    // worker to do; the shared implementation is already the fast path.
    if (config.optimize.copyOriginalBytes) {
      return processBatchItem(input, config, exif, opts);
    }

    const decoded = await decodeToBitmap(input.file);
    if (!decoded.ok) {
      return { error: decoded.error, warnings };
    }
    warnings.push(...decoded.output.warnings);

    const sourceFormat = detectInputFormat(input.file.name, input.file.type);
    const orientation =
      config.optimize.autoOrient !== false ? exif?.orientation : undefined;

    const res = await client.run({
      bitmap: decoded.output.bitmap,
      options: config.optimize,
      exif,
      exifOrientation: orientation,
      originalBytes: input.file.size,
      originalBlob: input.file,
      originalFormat: sourceFormat ?? null,
      wantHashes,
    });

    // The bitmap was transferred on the way in, so it is not ours to close and
    // the handle here is already neutered. The worker closes it (defect 20).

    if (!res.ok) {
      if (res.code === "cancelled") {
        return { error: res.error, warnings };
      }
      // One image failed in the worker — try it here before giving up on it.
      const fallback = await processBatchItem(input, config, exif, opts);
      return {
        ...fallback,
        warnings: [
          ...warnings,
          ...fallback.warnings,
          "This image was processed on the main thread because the background worker could not handle it.",
        ],
      };
    }

    const blob = responseToBlob(res);
    if (!blob) {
      const fallback = await processBatchItem(input, config, exif, opts);
      return { ...fallback, warnings: [...warnings, ...fallback.warnings] };
    }

    const contentHash = wantHashes
      ? ((await computeContentHash(input.file)) ?? undefined)
      : undefined;

    return {
      blob,
      width: res.width,
      height: res.height,
      quality: res.quality,
      keptOriginal: res.keptOriginal,
      hashes: res.hashes,
      contentHash,
      warnings: [...warnings, ...(res.warnings ?? [])],
    };
  };
}

/**
 * Own one worker for the lifetime of the component.
 *
 * The client is created lazily on first use and terminated on unmount, so a
 * user who never presses Process never pays for a worker, and a user who
 * navigates away mid-batch does not leave one running.
 *
 * Both returned callbacks are stable for the life of the component, which is
 * what lets callers put them in dependency arrays safely. `mode` is returned
 * separately rather than bundled into one object, so that a mode change cannot
 * invalidate an effect that only cares about cancelling (see D29 in the header).
 */
export function useProcessor() {
  const clientRef = useRef<WorkerClient | null>(null);
  const [mode, setMode] = useState<"unknown" | "worker" | "main">("unknown");

  useEffect(() => {
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  /** Resolve the processor to hand to `runBatch`, probing the worker once. */
  const resolveProcessor = useCallback(async (): Promise<{
    processItem: typeof processBatchItem;
    usedWorker: boolean;
  }> => {
    if (!clientRef.current) clientRef.current = createWorkerClient();
    const client = clientRef.current;
    const ok = await client.ready();
    setMode(ok ? "worker" : "main");
    return ok
      ? { processItem: createWorkerProcessItem(client), usedWorker: true }
      : { processItem: processBatchItem, usedWorker: false };
  }, []);

  const cancelWorkers = useCallback(() => {
    clientRef.current?.cancelAll();
  }, []);

  return { resolveProcessor, cancelWorkers, mode };
}

// ===========================================================================
// Run orchestration
// ===========================================================================

export interface RunState {
  busy: boolean;
  completed: number;
  total: number;
  stats: RunStats | null;
  result: BatchResult | null;
  error: string | null;
  usedWorker: boolean;
}

const IDLE_RUN: RunState = {
  busy: false,
  completed: 0,
  total: 0,
  stats: null,
  result: null,
  error: null,
  usedWorker: false,
};

/**
 * Start, watch and stop one batch.
 *
 * WHY THE RESULT IS HANDED BACK RATHER THAN APPLIED HERE
 * This hook does not touch the queue. It calls `onFinished` with the finished
 * `BatchResult` and lets the owner apply it through the queue's own reducer.
 * Two reasons: the reducer in PART 2 is the single place that may mutate
 * entries, and a hook that both runs a batch and rewrites the list it is
 * iterating is how partially-applied state happens.
 *
 * CANCELLATION IS TWO SIGNALS, NOT ONE (defect 17)
 * `AbortSignal` stops the engine's pool from STARTING further work, and the
 * worker is told separately to abandon what it has already been handed.
 * Without the second half, pressing Cancel with four jobs in flight still
 * meant waiting for four full encodes. Neither signal interrupts an encode
 * that is already running — `convertToBlob` is one opaque call — so the UI
 * says “finishing the current image” rather than claiming to have stopped.
 * Whatever finished before the stop is kept and remains downloadable, because
 * discarding completed work is not what anyone means by Cancel.
 *
 * DEPENDENCIES ARE STABLE ON PURPOSE (D29)
 * The unmount effect and the callbacks below depend only on `useCallback`
 * results. An earlier version depended on the whole object returned by
 * `useProcessor`, which was rebuilt every render — so its cleanup fired on
 * every render and aborted the run at the first progress update. `onFinished`
 * and `announce` are held in refs so that a caller who passes an inline
 * function cannot reintroduce the same problem from the outside.
 *
 * PROGRESS IS MEASURED, NOT MODELLED (D20)
 * Rate and the estimate come from elapsed wall-clock time and the number of
 * files actually finished. Before anything has finished there is no estimate
 * at all, rather than a fabricated one.
 */
export function useRun({
  announce,
  onFinished,
}: {
  announce: (message: string) => void;
  onFinished: (result: BatchResult, usedWorker: boolean) => void;
}) {
  const [state, setState] = useState<RunState>(IDLE_RUN);
  const abortRef = useRef<AbortController | null>(null);
  const { resolveProcessor, cancelWorkers, mode } = useProcessor();

  // Held in refs so an inline callback from the caller cannot invalidate the
  // effects below on every render.
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // Cancel anything in flight if the component goes away mid-run. `cancelWorkers`
  // is stable, so this cleanup runs on unmount and at no other time.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cancelWorkers();
    };
  }, [cancelWorkers]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    cancelWorkers();
    announceRef.current(
      "Stopping. The images already finished are kept, and the one being worked on right now will complete first.",
    );
  }, [cancelWorkers]);

  const start = useCallback(
    async (
      inputs: BatchFileInput[],
      config: RenameOptimizeConfig,
      options: { wantHashes: boolean },
    ) => {
      if (inputs.length === 0) {
        setState({ ...IDLE_RUN, error: "Add some images first." });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const startedAt = Date.now();
      const bytesIn = inputs.reduce((sum, i) => sum + i.file.size, 0);

      setState({
        ...IDLE_RUN,
        busy: true,
        total: inputs.length,
        stats: {
          processed: 0,
          failed: 0,
          skipped: 0,
          total: inputs.length,
          bytesIn,
          bytesOut: 0,
          filesPerSec: 0,
          etaSec: 0,
          peakMemoryBytes: 0,
          startedAt,
          cancelled: false,
        },
      });

      announceRef.current(
        `Processing ${inputs.length} image${inputs.length === 1 ? "" : "s"}. You can keep working; progress is announced as it goes.`,
      );

      const { processItem, usedWorker } = await resolveProcessor();

      try {
        const result = await runBatch(inputs, config, {
          signal: controller.signal,
          concurrency: recommendedConcurrency(),
          wantHashes: options.wantHashes,
          processItem,
          onProgress: (completed, total) => {
            const elapsed = (Date.now() - startedAt) / 1000;
            const rate = elapsed > 0 ? completed / elapsed : 0;
            setState((current) => ({
              ...current,
              completed,
              total,
              stats: current.stats
                ? {
                    ...current.stats,
                    processed: completed,
                    filesPerSec: rate,
                    // No finished files means no honest estimate yet.
                    etaSec: rate > 0 ? Math.round((total - completed) / rate) : 0,
                  }
                : current.stats,
            }));
          },
        });

        const finishedAt = result.finishedAt.getTime();
        const elapsed = Math.max(0.001, (finishedAt - startedAt) / 1000);
        const bytesOut = result.outputs.reduce((sum, o) => sum + (o.blob?.size ?? 0), 0);

        setState({
          busy: false,
          completed: result.counts.processed,
          total: inputs.length,
          result,
          error: null,
          usedWorker,
          stats: {
            processed: result.counts.processed,
            failed: result.counts.failed,
            skipped: result.counts.skipped,
            total: inputs.length,
            bytesIn,
            bytesOut,
            filesPerSec: result.counts.processed / elapsed,
            etaSec: 0,
            peakMemoryBytes: result.peakMemoryBytes,
            startedAt,
            finishedAt,
            cancelled: result.cancelled,
          },
        });

        onFinishedRef.current(result, usedWorker);

        if (result.cancelled) {
          announceRef.current(
            `Stopped. ${result.counts.processed} image${result.counts.processed === 1 ? "" : "s"} finished and can still be downloaded.`,
          );
        } else {
          const saved = bytesIn - bytesOut;
          announceRef.current(
            `Finished ${result.counts.processed} of ${inputs.length} images in ${formatDuration(
              finishedAt - startedAt,
            )}${saved > 0 ? `, saving ${formatBytes(saved)}` : ""}.${
              result.counts.failed > 0 ? ` ${result.counts.failed} could not be processed.` : ""
            }`,
          );
        }
      } catch (e) {
        // `runBatch` reports per-file problems on the rows, so reaching here
        // means something went wrong with the batch itself.
        setState((current) => ({
          ...current,
          busy: false,
          error: `The batch stopped unexpectedly: ${(e as Error).message}`,
        }));
        announceRef.current("The batch stopped because of an unexpected error.");
      } finally {
        abortRef.current = null;
      }
    },
    [resolveProcessor],
  );

  const reset = useCallback(() => setState(IDLE_RUN), []);

  return { ...state, start, cancel, reset, mode };
}

/**
 * ===========================================================================
 * UI PART 7 of 7 — planning, duplicates, downloads, and the default export.
 * ===========================================================================
 *
 * Concatenate AFTER CODE-2-UI-PART-6.tsx. This is the last part; the result of
 * concatenating 1 → 2 → 3 → 4 → 5 → 6 → 7 is the single `ui.tsx`.
 *
 * ASSEMBLY ORDER OF RECORD (STATUS.md repeats this)
 *   PART 1  constants, shared types, hooks, atoms
 *   PART 2  intake: drop zone, directory walk, limits, queue reducer
 *   PART 3  settings: rename rules, optimize, watermark, output, presets
 *   PART 4  PlanView, PreviewTable, DuplicatesPanel
 *   PART 5  viewers: ExifInspector, DiffModal, QualityMatrixModal, history
 *   PART 6  worker client, shared-pipeline bridge, run orchestration
 *   PART 7  THIS FILE — plan, duplicates, downloads, default export
 *
 * The headers of PARTS 1-3 still say "of 4" and PARTS 4-5 say "of 6", because
 * each was written before the split that followed it. The count is SEVEN.
 * Those headers are cosmetic and are listed in STATUS.md as such.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE ADDS NO IMPORT LINE, AND THAT IS DELIBERATE
 * ---------------------------------------------------------------------------
 * Every engine symbol used below — `planBatch`, `packageBatch`,
 * `generateAuditCsv`, `generateAuditJson`, `generateRunManifest`,
 * `findExactDuplicates`, `findSimilarImages`, `resolveConflictsSafe`,
 * `estimateSizeSavings`, `encodeConfigToUrl`, `formatBytes`,
 * `formatDuration`, `MEMORY_CAP_BYTES` — is already in PART 1's import block,
 * which was read in full to confirm it rather than assumed. Adding a second
 * `./logic` line here would collide with PART 1's when the parts are merged,
 * so there is none.
 *
 * ---------------------------------------------------------------------------
 * SIX CROSS-FILE SIGNATURES THAT WERE READ, NOT REMEMBERED (D22/D24)
 * ---------------------------------------------------------------------------
 * Every one of these differs from what a sensible guess would have produced,
 * and each would have failed the BUILD rather than a test:
 *
 *   1. `planBatch` returns six PARALLEL ARRAYS — `names`, `archivePaths`,
 *      `suffixed`, `perFileWarnings`, `errors`, `warnings` — indexed by
 *      position, not maps keyed by id. `PlanView` wants Maps, so this file
 *      does the zipping against `inputs[i].id`.
 *   2. `PlanView.suffixedIds` is a `Set<string>`, not an array.
 *   3. `findSimilarImages` returns `{ matches: Map<string, string[]>,
 *      skippedFlat: string[] }` — `matches` is ALREADY the shape
 *      `DuplicateView.similar` needs, so it is assigned, not converted.
 *   4. `useHistory().record` takes ONE `HistoryItem` object, not positional
 *      arguments.
 *   5. `ConfigOfferBanner` takes `{ offer, current, onApply, onDismiss }` and
 *      is NOT rendered by `SettingsColumn`, so this file must render it or the
 *      draft-recovery and shared-link features are dead controls (D19).
 *   6. `OutputFormat` values are MIME strings — `"image/jpeg"`, not `"jpeg"`.
 *
 * ---------------------------------------------------------------------------
 * WHY MANUAL RENAMES NEEDED WORK RATHER THAN A PROP
 * ---------------------------------------------------------------------------
 * `runBatch` calls `planBatch` internally, and the engine has no per-file name
 * override — so a name typed into the table would simply have been ignored by
 * the run, and the manual-rename control in PART 4 would have been decorative.
 *
 * The fix is `applyManualNames` below: it takes whatever the planner decided,
 * substitutes the hand-typed names, and re-resolves collisions through the
 * engine's own `resolveConflictsSafe`. Crucially it is ONE function, called in
 * exactly two places — once to build the preview and once on the finished
 * `BatchResult` — so the name in the table and the name in the ZIP are
 * produced by the same code from the same inputs. Two implementations of
 * "what will this file be called" is how a preview starts lying.
 */

// ===========================================================================
// Naming helpers
// ===========================================================================

/** The extension including its dot, or "" when there is none. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

interface RenamedNames {
  names: string[];
  archivePaths: string[];
  suffixedIds: Set<string>;
  warnings: string[];
}

/**
 * Substitute hand-typed names into a planned name list and re-resolve clashes.
 *
 * THE EXTENSION IS PRESERVED FOR THE USER. Someone renaming a row types
 * "beach sunset", not "beach sunset.jpg", and a file that arrives without its
 * extension is a file the operating system no longer knows how to open. If the
 * typed name has no extension, the planned one is appended.
 *
 * CLASHES ARE RE-RESOLVED, NOT ASSUMED AWAY. Typing a name that another file
 * already has is the single easiest way to lose a photo — in a flat ZIP the
 * second entry simply overwrites the first in most extractors. The whole list
 * therefore goes back through `resolveConflictsSafe`, which is the same
 * function the planner used, so the suffixing rules are identical.
 *
 * THE ARCHIVE PATH IS PATCHED, NOT REBUILT. `archivePath` is the folder prefix
 * plus the filename, so replacing the trailing filename keeps every folder
 * decision the planner already made — flattening, the output folder, preserved
 * structure — without this file needing to know any of those rules. When the
 * suffix does not match, the path is left exactly as planned rather than
 * guessed at.
 */
function applyManualNames(
  ids: string[],
  plannedNames: string[],
  plannedPaths: string[],
  plannedSuffixed: boolean[],
  manualById: Map<string, string>,
): RenamedNames {
  if (manualById.size === 0) {
    const suffixedIds = new Set<string>();
    ids.forEach((id, i) => {
      if (plannedSuffixed[i]) suffixedIds.add(id);
    });
    return {
      names: plannedNames,
      archivePaths: plannedPaths,
      suffixedIds,
      warnings: [],
    };
  }

  const wanted = ids.map((id, i) => {
    const planned = plannedNames[i] ?? "";
    const manual = manualById.get(id);
    if (!manual) return planned;
    return extensionOf(manual) ? manual : `${manual}${extensionOf(planned)}`;
  });

  const resolved = resolveConflictsSafe(wanted);

  const suffixedIds = new Set<string>();
  const archivePaths = ids.map((id, i) => {
    const planned = plannedNames[i] ?? "";
    const plannedPath = plannedPaths[i] ?? planned;
    const finalName = resolved.names[i] ?? planned;

    if (plannedSuffixed[i] || resolved.suffixed[i]) suffixedIds.add(id);

    if (finalName === planned) return plannedPath;
    if (plannedPath.endsWith(planned)) {
      return plannedPath.slice(0, plannedPath.length - planned.length) + finalName;
    }
    // The planner put this file somewhere this function does not understand.
    // Leaving the path alone is wrong-but-visible; inventing one is worse.
    return plannedPath;
  });

  return {
    names: resolved.names,
    archivePaths,
    suffixedIds,
    warnings: resolved.warnings,
  };
}

/**
 * The files a run will actually touch.
 *
 * Skipped rows are excluded here, and that decision has a consequence worth
 * stating: the `{index}` and `{counter}` tokens number the files that are
 * PROCESSED, so skipping the third of ten photos means the fourth becomes
 * number three. The alternative — numbering around the gaps — produces a ZIP
 * with 1, 2, 4, 5 in it, which looks like something went wrong. Because the
 * preview is planned over this same list, the table always shows the numbering
 * the run will really use.
 */
function entriesToInputs(entries: FileEntry[]): BatchFileInput[] {
  return entries
    .filter((entry) => !entry.skipped)
    .map((entry) => ({
      id: entry.id,
      file: entry.file,
      relativePath: entry.path,
    }));
}

/**
 * Plan the current queue with the current settings, on every change.
 *
 * Planning is pure and cheap — it reads EXIF that intake already extracted and
 * touches no pixels — so it can run on every keystroke in the pattern field.
 * That is what makes the preview trustworthy: it is not a sample or an
 * estimate, it is the real planner's real answer for these exact files.
 */
function useQueuePlan(
  entries: FileEntry[],
  config: RenameOptimizeConfig,
): { inputs: BatchFileInput[]; plan: PlanView; planWarnings: string[] } {
  return useMemo(() => {
    const inputs = entriesToInputs(entries);
    if (inputs.length === 0) {
      return { inputs, plan: EMPTY_PLAN, planWarnings: [] };
    }

    const exifById = new Map<string, ExifData>();
    const manualById = new Map<string, string>();
    for (const entry of entries) {
      if (entry.exif) exifById.set(entry.id, entry.exif);
      if (entry.manualName) manualById.set(entry.id, entry.manualName);
    }

    const base = planBatch(inputs, config, exifById);
    const ids = inputs.map((input) => input.id);
    const renamed = applyManualNames(
      ids,
      base.names,
      base.archivePaths,
      base.suffixed,
      manualById,
    );

    const nameById = new Map<string, string>();
    const pathById = new Map<string, string>();
    const errorById = new Map<string, string>();
    const warningsById = new Map<string, string[]>();

    ids.forEach((id, i) => {
      nameById.set(id, renamed.names[i] ?? "");
      pathById.set(id, renamed.archivePaths[i] ?? "");
      const error = base.errors[i];
      if (error) errorById.set(id, error);
      const warnings = base.perFileWarnings[i];
      if (warnings && warnings.length > 0) warningsById.set(id, warnings);
    });

    return {
      inputs,
      plan: {
        nameById,
        pathById,
        suffixedIds: renamed.suffixedIds,
        errorById,
        warningsById,
      },
      planWarnings: [...base.warnings, ...renamed.warnings],
    };
  }, [entries, config]);
}

/**
 * Rewrite a finished batch so its filenames match the ones the user was shown.
 *
 * Called once, on the `BatchResult`, before anything is packaged or displayed.
 * `rows` is rewritten alongside `outputs` because the audit CSV, the JSON
 * export and the manifest are all generated from `rows` — leaving them on the
 * planner's names would produce an audit trail that disagrees with the files
 * next to it in the same ZIP.
 */
function applyManualNamesToResult(
  result: BatchResult,
  manualById: Map<string, string>,
): string[] {
  if (manualById.size === 0) return [];

  const ids = result.outputs.map((output) => output.id);
  const renamed = applyManualNames(
    ids,
    result.outputs.map((output) => output.newName),
    result.outputs.map((output) => output.archivePath),
    result.outputs.map((output) => false),
    manualById,
  );

  result.outputs.forEach((output, i) => {
    const name = renamed.names[i];
    const path = renamed.archivePaths[i];
    if (name) output.newName = name;
    if (path) output.archivePath = path;
    const row = result.rows[output.index];
    if (row && name) row.newName = name;
  });

  return renamed.warnings;
}

// ===========================================================================
// Duplicates
// ===========================================================================

/**
 * Build the duplicate view from whatever has actually been measured.
 *
 * `compared` is the guard that keeps this panel honest. It is true only when a
 * run computed hashes, so an empty result reads as "nothing matched" rather
 * than being confused with "nothing was checked". Files with no hash are
 * simply absent from both maps — never given a placeholder — which is the
 * whole of defect 21 and of D20.
 */
function useDuplicates(entries: FileEntry[], compared: boolean): DuplicateView {
  return useMemo(() => {
    if (!compared) {
      return { exact: [], similar: new Map(), skippedFlat: [], compared: false };
    }

    const contentHashes = new Map<string, string>();
    const perceptual = new Map<string, ImageHashes>();
    for (const entry of entries) {
      if (entry.contentHash) contentHashes.set(entry.id, entry.contentHash);
      if (entry.hashes) perceptual.set(entry.id, entry.hashes);
    }

    const exact = findExactDuplicates(contentHashes);

    // Files already reported as byte-identical do not need to be reported
    // again as "looks similar" — that is the same finding twice, and the user
    // would be offered two different Remove buttons for one problem.
    const inExact = new Set<string>();
    for (const group of exact) for (const id of group) inExact.add(id);

    const { matches, skippedFlat } = findSimilarImages(perceptual);
    const similar = new Map<string, string[]>();
    for (const [id, others] of matches) {
      if (inExact.has(id)) continue;
      const filtered = others.filter((other) => !inExact.has(other));
      if (filtered.length > 0) similar.set(id, filtered);
    }

    return { exact, similar, skippedFlat, compared: true };
  }, [entries, compared]);
}

// ===========================================================================
// Downloads
// ===========================================================================

/** Space out multiple downloads; browsers drop programmatic bursts. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface DownloadState {
  packaging: boolean;
  fraction: number;
  error: string | null;
}

/**
 * Everything the user can take away from a finished run.
 *
 * WHY PACKAGING HAS ITS OWN PROGRESS
 * Zipping several hundred photos is not instant, and a button that appears to
 * do nothing for twenty seconds reads as broken. `packageBatch` reports a
 * fraction across all archives, so the bar is measured rather than animated.
 *
 * WHY MULTI-PART ARCHIVES ARE DOWNLOADED IN SEQUENCE
 * When splitting is on there are several files, and calling `click()` on five
 * anchors in one tick makes most browsers deliver the first and silently drop
 * the rest. Each is triggered a beat apart, and the count is announced so it
 * is obvious how many to expect.
 */
function useDownloads(announce: (message: string) => void) {
  const [state, setState] = useState<DownloadState>({
    packaging: false,
    fraction: 0,
    error: null,
  });

  const downloadArchives = useCallback(
    async (
      result: BatchResult,
      config: RenameOptimizeConfig,
      compression: "store" | "deflate",
    ) => {
      setState({ packaging: true, fraction: 0, error: null });
      announce("Building the download. This can take a moment for a large batch.");

      const packaged = await packageBatch(result, config, {
        compression,
        onProgress: (fraction) =>
          setState((current) => ({ ...current, fraction })),
      });

      if (!packaged.ok) {
        setState({ packaging: false, fraction: 0, error: packaged.error });
        announce("The download could not be built.");
        return;
      }

      const { archives, warnings } = packaged.output;
      for (let i = 0; i < archives.length; i++) {
        const archive = archives[i]!;
        downloadBlob(archive.blob, archive.name);
        if (i < archives.length - 1) await delay(400);
      }

      setState({ packaging: false, fraction: 1, error: null });

      if (archives.length === 1) {
        announce(`Downloading ${archives[0]!.name}.`);
      } else {
        announce(
          `This batch was split into ${archives.length} archives, and all ${archives.length} are downloading.`,
        );
        toast.info(
          `Split into ${archives.length} archives because of the size limit you set. Your browser may ask permission for the extra downloads.`,
        );
      }
      for (const warning of warnings) toast.info(warning);
    },
    [announce],
  );

  const downloadOne = useCallback((entry: FileEntry, name: string) => {
    if (!entry.outputBlob) return;
    downloadBlob(entry.outputBlob, name);
  }, []);

  const downloadAudit = useCallback((result: BatchResult) => {
    downloadText(generateAuditCsv(result.rows), `audit-${stamp()}.csv`, "text/csv");
  }, []);

  const downloadJson = useCallback((result: BatchResult) => {
    downloadText(
      generateAuditJson(result.rows),
      `audit-${stamp()}.json`,
      "application/json",
    );
  }, []);

  const downloadManifest = useCallback(
    (result: BatchResult, config: RenameOptimizeConfig) => {
      downloadText(
        generateRunManifest(config, result.rows, result.startedAt, result.finishedAt),
        `manifest-${stamp()}.json`,
        "application/json",
      );
    },
    [],
  );

  const clearError = useCallback(
    () => setState((current) => ({ ...current, error: null })),
    [],
  );

  return {
    ...state,
    downloadArchives,
    downloadOne,
    downloadAudit,
    downloadJson,
    downloadManifest,
    clearError,
  };
}

// ===========================================================================
// Statistics
// ===========================================================================

/**
 * What the run actually did (features 59-70).
 *
 * Every figure is measured. "Peak memory" is the engine's true high-water mark
 * of concurrently held output, not the running total of every blob ever
 * produced that the original displayed under that name (defect 16) — and it is
 * shown against the cap so the number means something. Where nothing has been
 * measured yet the cell says so instead of showing a zero that looks like a
 * result (D20).
 */
function StatsPanel({
  stats,
  busy,
  completed,
  total,
  usedWorker,
  mode,
}: {
  stats: RunStats;
  busy: boolean;
  completed: number;
  total: number;
  usedWorker: boolean;
  mode: "unknown" | "worker" | "main";
}) {
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const saved = stats.bytesIn - stats.bytesOut;
  const savings =
    stats.bytesOut > 0 ? estimateSizeSavings(stats.bytesIn, stats.bytesOut) : null;
  const elapsed = (stats.finishedAt ?? Date.now()) - stats.startedAt;

  return (
    <section className={cx(BOX, "space-y-3 p-4")} aria-label="Run statistics">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          {busy ? "Processing" : stats.cancelled ? "Stopped" : "Finished"}
        </h2>
        {busy && <Spinner className="text-[--primary]" />}
        <span className="ml-auto text-xs tabular-nums text-[--muted-foreground]">
          {completed.toLocaleString()} of {total.toLocaleString()}
        </span>
      </div>

      <Bar percent={percent} warn={stats.failed > 0} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Processed" value={stats.processed.toLocaleString()} tone="good" />
        <Stat
          label="Failed"
          value={stats.failed.toLocaleString()}
          tone={stats.failed > 0 ? "bad" : undefined}
        />
        <Stat label="Skipped" value={stats.skipped.toLocaleString()} />
        <Stat
          label="Time"
          value={elapsed > 0 ? formatDuration(elapsed) : "—"}
          hint="Measured from the moment the run started."
        />
        <Stat label="Read" value={formatBytes(stats.bytesIn)} />
        <Stat
          label="Written"
          value={stats.bytesOut > 0 ? formatBytes(stats.bytesOut) : "nothing yet"}
        />
        <Stat
          label="Saved"
          value={
            savings && saved > 0 ? `${formatBytes(saved)} (${savings.percent}%)` : "nothing"
          }
          tone={saved > 0 ? "good" : undefined}
          hint="The difference between the bytes read and the bytes written."
        />
        <Stat
          label="Rate"
          value={
            stats.filesPerSec > 0 ? `${stats.filesPerSec.toFixed(1)} files/s` : "measuring…"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[--muted-foreground]">
        <Badge tone={mode === "worker" ? "good" : "neutral"}>
          {mode === "worker" || usedWorker
            ? "background worker"
            : mode === "main"
              ? "main thread"
              : "deciding…"}
        </Badge>
        {stats.peakMemoryBytes > 0 && (
          <span>
            Peak {formatBytes(stats.peakMemoryBytes)} held at once, of{" "}
            {formatBytes(MEMORY_CAP_BYTES)} allowed
          </span>
        )}
        {busy && stats.etaSec > 0 && <span>About {formatDuration(stats.etaSec * 1000)} left</span>}
      </div>

      {stats.cancelled && (
        <Note>
          This run was stopped early. The images that finished are complete and can still be
          downloaded — stopping never throws away work that was already done.
        </Note>
      )}
    </section>
  );
}

// ===========================================================================
// The tool
// ===========================================================================

/**
 * Bulk Image Renamer + Optimizer.
 *
 * Same default export name and shape as the original (D2).
 *
 * WHAT THIS COMPONENT OWNS, AND WHAT IT DOES NOT
 * It owns composition and the small pieces of state that genuinely belong to
 * the page: which modal is open, whether duplicate detection is wanted, and
 * whether the archive should be compressed. Everything else is owned by a hook
 * that can be reasoned about on its own — the queue by `useFileQueue`, the
 * settings by `useConfigState`, the run by `useRun`, object URLs by
 * `useObjectUrls`, history by `useHistory`. The queue reducer stays the single
 * place entries may change, which is why the finished batch is applied through
 * `patchMany` rather than by rewriting the list here.
 *
 * HASHING IS OPT-IN, AND HONESTLY LABELLED
 * Comparing images needs a second decode of every file — roughly double the
 * decode work on a large batch — and buys nothing unless the user looks at the
 * duplicates panel. So it is a switch, it is off by default for big queues,
 * and when it is off the panel says "not compared" rather than "none found"
 * (D20).
 */
export default function BulkImageRenamerOptimizerUI() {
  const { announce, announcerNode } = useAnnouncer();
  const queue = useFileQueue(announce);
  const api = useConfigState();
  const { urlFor } = useObjectUrls();
  const history = useHistory();
  const downloads = useDownloads(announce);

  const [wantDuplicates, setWantDuplicates] = useState(true);
  const [compress, setCompress] = useState(false);
  const [modal, setModal] = useState<{ kind: ModalKind; id: string | null }>({
    kind: "none",
    id: null,
  });

  const { entries } = queue;
  const { config } = api;
  const { inputs, plan, planWarnings } = useQueuePlan(entries, config);

  const hasFolders = useMemo(
    () => entries.some((entry) => entry.path !== entry.file.name),
    [entries],
  );

  /**
   * Apply a finished batch to the queue.
   *
   * The manual names are re-applied to the result first, so the blobs, the
   * audit trail and the archive all carry the names the user was shown. Then
   * every row is updated in ONE dispatch: a patch per file would mean one
   * re-render per file, which for a 500-photo batch is 500 renders of a table.
   *
   * `error` is written even when it is undefined, so a file that failed on a
   * previous run and succeeded on this one loses its old error message rather
   * than keeping a stale one.
   */
  const handleFinished = useCallback(
    (result: BatchResult, usedWorker: boolean) => {
      const manualById = new Map<string, string>();
      for (const entry of entries) {
        if (entry.manualName) manualById.set(entry.id, entry.manualName);
      }
      const warnings = applyManualNamesToResult(result, manualById);
      for (const warning of warnings) toast.info(warning);

      queue.patchMany(
        result.outputs.map((output) => ({
          id: output.id,
          patch: {
            outputBlob: output.blob,
            outputWidth: output.width,
            outputHeight: output.height,
            quality: output.quality,
            keptOriginal: output.keptOriginal,
            hashes: output.hashes,
            contentHash: output.contentHash,
            exif: output.exif,
            warnings: output.warnings.length > 0 ? output.warnings : undefined,
            error: output.error,
          } as Partial<FileEntry>,
        })),
      );

      const bytesIn = result.outputs.reduce((sum, o) => sum + o.originalSize, 0);
      const bytesOut = result.outputs.reduce((sum, o) => sum + (o.blob?.size ?? 0), 0);

      history.record({
        ts: Date.now(),
        label: `${result.counts.processed} image${
          result.counts.processed === 1 ? "" : "s"
        } · ${config.rule.pattern || "{original}"}${usedWorker ? "" : " · main thread"}`,
        config,
        fileCount: result.counts.processed,
        savedBytes: Math.max(0, bytesIn - bytesOut),
      });

      for (const warning of result.warnings) toast.info(warning);
    },
    [entries, queue, history, config],
  );

  const run = useRun({ announce, onFinished: handleFinished });

  const duplicates = useDuplicates(entries, run.result?.hashed === true);

  const processedCount = useMemo(
    () => entries.filter((entry) => entry.outputBlob).length,
    [entries],
  );

  const selected = useMemo(
    () => (modal.id ? (entries.find((entry) => entry.id === modal.id) ?? null) : null),
    [entries, modal.id],
  );

  const closeModal = useCallback(() => setModal({ kind: "none", id: null }), []);

  const start = useCallback(() => {
    void run.start(inputs, config, { wantHashes: wantDuplicates });
  }, [run, inputs, config, wantDuplicates]);

  const download = useCallback(() => {
    if (!run.result) return;
    void downloads.downloadArchives(
      run.result,
      config,
      compress ? "deflate" : "store",
    );
  }, [run.result, config, compress, downloads]);

  const shareLink = useCallback(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    navigator.clipboard
      .writeText(encodeConfigToUrl(config, base))
      .then(() => toast.success("A link to these settings was copied to your clipboard."))
      .catch(() => toast.error("The browser blocked clipboard access."));
  }, [config]);

  const busy = run.busy || downloads.packaging || queue.scanning;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 p-3 sm:p-4">
      {/* A skip link so a keyboard user is not forced through the whole
          settings column to reach the file list. */}
      <a
        href="#file-queue"
        className={cx(
          "sr-only rounded-md bg-[--primary] px-3 py-2 text-sm text-[--primary-foreground] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          FOCUS,
        )}
      >
        Skip to the file list
      </a>

      {announcerNode}

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Images className="h-5 w-5 text-[--primary]" aria-hidden="true" />
          Bulk Image Renamer + Optimizer
        </h1>
        <p className="text-xs text-[--muted-foreground]">
          Rename, resize, compress and watermark up to {MAX_FILES.toLocaleString()} images at
          once, then download them as a ZIP. Everything happens in this browser — no image is
          ever uploaded.
        </p>
      </header>

      {api.linkError && (
        <ErrorBanner message={api.linkError} onDismiss={api.clearLinkError} />
      )}

      {/* Neither a recovered draft nor a shared link is ever applied on its
          own; the banner lists what would change and waits (D10). */}
      {api.offer && (
        <ConfigOfferBanner
          offer={api.offer}
          current={config}
          onApply={api.acceptOffer}
          onDismiss={api.dismissOffer}
        />
      )}

      <DropZone
        onDrop={queue.addFromDrop}
        onFiles={queue.addFromInput}
        scanning={queue.scanning}
        disabled={run.busy}
      />

      <RejectionPanel rejections={queue.rejections} onDismiss={queue.dismissRejections} />

      {queue.sizeWarning && <Note>{queue.sizeWarning}</Note>}

      {queue.pendingMetadata > 0 && (
        <div className="flex items-center gap-2 text-xs text-[--muted-foreground]">
          <Spinner />
          Reading dimensions and metadata for {queue.pendingMetadata.toLocaleString()} more
          file{queue.pendingMetadata === 1 ? "" : "s"}. You can change settings while this
          finishes.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <SettingsColumn api={api} hasFolders={hasFolders} />
        </div>

        <div className="min-w-0 space-y-3">
          {/* --- action bar --- */}
          <section className={cx(BOX, "space-y-3 p-4")} aria-label="Run and download">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={start}
                disabled={busy || inputs.length === 0}
                title={
                  inputs.length === 0
                    ? "Add some images first."
                    : `Process ${inputs.length} images`
                }
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {run.busy
                  ? "Processing…"
                  : `Process ${inputs.length.toLocaleString()} image${
                      inputs.length === 1 ? "" : "s"
                    }`}
              </Button>

              {run.busy && (
                <Button variant="danger" onClick={run.cancel}>
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  Stop
                </Button>
              )}

              <Button
                onClick={download}
                disabled={busy || !run.result || processedCount === 0}
                title={
                  processedCount === 0
                    ? "Process the images first — there is nothing to download yet."
                    : undefined
                }
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {downloads.packaging ? "Building the ZIP…" : "Download ZIP"}
              </Button>

              <Button onClick={shareLink}>
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Share settings
              </Button>

              <div className="ml-auto flex flex-wrap items-center gap-3">
                <Toggle
                  id="want-duplicates"
                  checked={wantDuplicates}
                  onChange={setWantDuplicates}
                  label="Look for duplicates"
                  disabled={run.busy}
                />
                <Toggle
                  id="zip-compress"
                  checked={compress}
                  onChange={setCompress}
                  label="Compress the ZIP"
                  disabled={busy}
                />
                <Button
                  variant="ghost"
                  onClick={() => {
                    queue.clearAll();
                    run.reset();
                  }}
                  disabled={busy || entries.length === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </Button>
              </div>
            </div>

            {wantDuplicates && (
              <Note>
                Duplicate detection reads every image a second time to fingerprint it, which
                roughly doubles the decoding work. Turn it off for a large batch you already
                know is clean.
              </Note>
            )}

            {downloads.packaging && <Bar percent={downloads.fraction * 100} />}

            {downloads.error && (
              <ErrorBanner message={downloads.error} onDismiss={downloads.clearError} />
            )}

            {run.error && <ErrorBanner message={run.error} />}

            {planWarnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-[--muted-foreground]">
                {planWarnings.slice(0, 8).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
                {planWarnings.length > 8 && (
                  <li>…and {planWarnings.length - 8} more, listed against the files below.</li>
                )}
              </ul>
            )}

            {run.result && !run.busy && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => downloads.downloadAudit(run.result!)}>
                  Audit CSV
                </Button>
                <Button onClick={() => downloads.downloadJson(run.result!)}>
                  Audit JSON
                </Button>
                <Button onClick={() => downloads.downloadManifest(run.result!, config)}>
                  Run manifest
                </Button>
              </div>
            )}
          </section>

          {run.stats && (
            <StatsPanel
              stats={run.stats}
              busy={run.busy}
              completed={run.completed}
              total={run.total}
              usedWorker={run.usedWorker}
              mode={run.mode}
            />
          )}

          <div id="file-queue">
            <PreviewTable
              entries={entries}
              plan={plan}
              urlFor={urlFor}
              busy={run.busy}
              onMove={queue.moveEntry}
              onRemove={queue.removeEntry}
              onToggleSkip={queue.toggleSkip}
              onRename={(id, name) => queue.patchEntry(id, { manualName: name })}
              onInspect={(id) => setModal({ kind: "exif", id })}
              onCompare={(id) => setModal({ kind: "diff", id })}
            />
          </div>

          {entries.length > 0 && (
            <DuplicatesPanel
              entries={entries}
              duplicates={duplicates}
              urlFor={urlFor}
              busy={busy}
              onRemove={(ids) => {
                // `removeEntry` is the queue's only removal path, so a group
                // removal is a sequence of them rather than a second way to
                // mutate the list.
                for (const id of ids) queue.removeEntry(id);
              }}
            />
          )}

          <HistoryPanel
            history={history}
            currentConfig={config}
            onApply={api.setConfig}
            busy={run.busy}
          />
        </div>
      </div>

      {/* --- modals: one at a time, by construction --- */}
      {modal.kind === "exif" && selected && (
        <ExifInspector entry={selected} onClose={closeModal} />
      )}
      {modal.kind === "diff" && selected && (
        <DiffModal entry={selected} urlFor={urlFor} onClose={closeModal} />
      )}
      {modal.kind === "matrix" && selected && (
        <QualityMatrixModal
          entry={selected}
          optimize={config.optimize}
          urlFor={urlFor}
          onPick={(quality) => api.patchOptimize({ quality })}
          onClose={closeModal}
        />
      )}

      <footer className="pt-2 text-[11px] text-[--muted-foreground]">
        Your images are processed on this device and never uploaded. Closing the tab discards
        everything except the settings you chose to save.
      </footer>

      {/* One JSON-LD graph, describing what the tool is. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                name: "Bulk Image Renamer + Optimizer",
                applicationCategory: "MultimediaApplication",
                operatingSystem: "Any browser",
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                featureList: [
                  "Batch rename with EXIF and folder tokens",
                  "Resize, compress and target a file size",
                  "Text watermarking",
                  "Remove EXIF and GPS metadata",
                  "Exact and visual duplicate detection",
                  "ZIP download with folder structure preserved",
                ],
              },
              {
                "@type": "FAQPage",
                mainEntity: [
                  {
                    "@type": "Question",
                    name: "Are my photos uploaded anywhere?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "No. Every image is decoded, resized and re-encoded inside your own browser, and nothing is sent to a server.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Can I rename files without changing the images?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Yes. Turn on rename-only and the original bytes, extension and metadata are copied through untouched.",
                    },
                  },
                ],
              },
            ],
          }),
        }}
      />
    </div>
  );
}
