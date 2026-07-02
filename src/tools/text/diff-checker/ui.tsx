/**
 * Diff Checker v2 — Flagship diff tool UI.
 *
 * Features:
 * - Side-by-side AND unified views (toggle)
 * - Line/word/char granularity
 * - Ignore whitespace/case/trim options
 * - File input (drag-and-drop two files)
 * - Swap left↔right
 * - Stats bar (added/removed/changed)
 * - Export unified diff (.patch)
 * - TX: live output, sample, empty state, copy/download, URL state, clear
 */
import { useMemo, useState, useCallback, useRef } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  DownloadButton,
  ToastContainer,
  toast,
  Segmented,
  Switch,
} from "../../../components/ui";
import { EmptyState, useUrlState } from "../../_tx";
import {
  computeDiff,
  getDiffStats,
  toUnifiedPatch,
  DEFAULT_OPTIONS,
  type DiffOptions,
  type DiffView,
  type DiffGranularity,
  type DiffLine,
} from "./logic";

const VIEW_OPTIONS = [
  { value: "unified", label: "Unified" },
  { value: "split", label: "Side-by-side" },
];

const GRANULARITY_OPTIONS = [
  { value: "line", label: "Line" },
  { value: "word", label: "Word" },
  { value: "char", label: "Char" },
];

const SAMPLE_OLD = `function greet(name) {
  console.log("Hello, " + name);
}

const x = 42;
const y = x * 2;`;

const SAMPLE_NEW = `function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

const x = 42;
const y = x * 3;
const z = x + y;`;

export default function DiffChecker() {
  const {
    input: oldText,
    setInput: setOldText,
    urlTooLarge,
  } = useUrlState("diff-checker", "", {} as Record<string, never>);

  const [newText, setNewText] = useState("");
  const [view, setView] = useState<DiffView>("unified");
  const [diffOpts, setDiffOpts] = useState<DiffOptions>(DEFAULT_OPTIONS);
  const oldFileRef = useRef<HTMLInputElement>(null);
  const newFileRef = useRef<HTMLInputElement>(null);

  // Use urlState for oldText, separate state for newText (URL state for both would be too long)
  const actualOldText = oldText || "";

  const diffLines = useMemo(
    () => computeDiff(actualOldText, newText, diffOpts),
    [actualOldText, newText, diffOpts],
  );
  const stats = useMemo(() => getDiffStats(diffLines), [diffLines]);
  const patch = useMemo(
    () => toUnifiedPatch(actualOldText, newText, diffOpts),
    [actualOldText, newText, diffOpts],
  );

  const updateOpts = useCallback((patch: Partial<DiffOptions>) => {
    setDiffOpts((o) => ({ ...o, ...patch }));
  }, []);

  function loadSample() {
    setOldText(SAMPLE_OLD);
    setNewText(SAMPLE_NEW);
    toast("Sample loaded", "info");
  }

  function clear() {
    setOldText("");
    setNewText("");
  }

  function swap() {
    const tmp = actualOldText;
    setOldText(newText);
    setNewText(tmp);
    toast("Swapped left ↔ right", "info");
  }

  async function handleFileInput(e: Event, setter: (v: string) => void) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      toast("File too large (max 5 MB)", "error");
      return;
    }
    const text = await file.text();
    setter(text);
    toast(`Loaded ${file.name}`, "success");
  }

  const hasInput = actualOldText || newText;

  return (
    <div class="space-y-4">
      <ToastContainer />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <label for="dc-old" class="text-sm font-medium text-unq-text">
              Original
            </label>
            <button
              type="button"
              class="text-unq-text-3 text-xs hover:text-unq-accent"
              onClick={() => oldFileRef.current?.click()}
            >
              📁 Load file
            </button>
            <input
              ref={oldFileRef}
              type="file"
              accept=".txt,.md,.json,.csv,.js,.ts,.html,.css,.xml,.yaml,.yml"
              class="hidden"
              onChange={(e) => handleFileInput(e as Event, setOldText)}
            />
          </div>
          <Textarea
            id="dc-old"
            placeholder="Paste original text or load a file…"
            value={actualOldText}
            onInput={(e) => setOldText((e.currentTarget as HTMLTextAreaElement).value)}
            hint={`${actualOldText.length} chars · ${actualOldText.split("\n").length} lines`}
            class="min-h-[180px] resize-y font-mono text-sm"
          />
        </div>
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <label for="dc-new" class="text-sm font-medium text-unq-text">
              Modified
            </label>
            <button
              type="button"
              class="text-unq-text-3 text-xs hover:text-unq-accent"
              onClick={() => newFileRef.current?.click()}
            >
              📁 Load file
            </button>
            <input
              ref={newFileRef}
              type="file"
              accept=".txt,.md,.json,.csv,.js,.ts,.html,.css,.xml,.yaml,.yml"
              class="hidden"
              onChange={(e) => handleFileInput(e as Event, setNewText)}
            />
          </div>
          <Textarea
            id="dc-new"
            placeholder="Paste modified text or load a file…"
            value={newText}
            onInput={(e) => setNewText((e.currentTarget as HTMLTextAreaElement).value)}
            hint={`${newText.length} chars · ${newText.split("\n").length} lines`}
            class="min-h-[180px] resize-y font-mono text-sm"
          />
        </div>
      </div>

      <Card class="!p-4">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex flex-col gap-1">
            <span class="text-unq-text-2 text-xs font-medium">View</span>
            <Segmented
              options={VIEW_OPTIONS}
              value={view}
              onChange={(v) => setView(v as DiffView)}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-unq-text-2 text-xs font-medium">Granularity</span>
            <Segmented
              options={GRANULARITY_OPTIONS}
              value={diffOpts.granularity}
              onChange={(v) => updateOpts({ granularity: v as DiffGranularity })}
            />
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-unq-text-2 text-xs font-medium">Options</span>
            <div class="flex flex-wrap gap-3">
              <Switch
                checked={diffOpts.ignoreWhitespace}
                onChange={(v) => updateOpts({ ignoreWhitespace: v })}
                label="Ignore whitespace"
              />
              <Switch
                checked={diffOpts.ignoreCase}
                onChange={(v) => updateOpts({ ignoreCase: v })}
                label="Ignore case"
              />
              <Switch
                checked={diffOpts.trimLines}
                onChange={(v) => updateOpts({ trimLines: v })}
                label="Trim lines"
              />
            </div>
          </div>
          <Button variant="ghost" onClick={swap} class="ml-auto">
            ⇄ Swap
          </Button>
        </div>
      </Card>

      <div class="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={loadSample}>
          Load sample
        </Button>
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>

      {urlTooLarge && (
        <p class="text-unq-text-3 text-xs">
          ⚠ Input too large for shareable URL — copy the text manually to share.
        </p>
      )}

      {!hasInput ? (
        <EmptyState
          icon="🔍"
          title="Compare two texts"
          hint="Paste original and modified text above, or load two files. The diff updates instantly as you type."
        />
      ) : diffLines.length === 0 || diffLines.every((l) => l.type === "equal") ? (
        <Card class="!p-8 text-center">
          <p class="text-unq-success-strong text-sm font-medium">✓ Texts are identical</p>
          <p class="text-unq-text-3 mt-1 text-xs">No differences found.</p>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <div class="flex flex-wrap items-center gap-4 rounded-lg border border-unq-border-subtle px-4 py-2 text-sm">
            <span class="font-medium text-unq-text">Diff</span>
            <span class="text-unq-success-strong">+{stats.additions} added</span>
            <span class="text-unq-danger-strong">−{stats.deletions} removed</span>
            <span class="text-unq-text-3">{stats.changes} changed</span>
            <span class="text-unq-text-3 ml-auto text-xs">{stats.totalLines} lines</span>
            <CopyButton getText={() => patch} label="Copy .patch" />
            <DownloadButton filename="diff.patch" getText={() => patch} label="Download .patch" />
          </div>

          {/* Diff output */}
          <Card class="overflow-hidden !p-0">
            <div class="unq-scroll-x max-h-[600px] overflow-y-auto">
              {view === "unified" ? (
                <UnifiedView lines={diffLines} />
              ) : (
                <SplitView lines={diffLines} />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <table class="w-full border-collapse font-mono text-xs" style="table-layout: fixed;">
      <tbody>
        {lines.map((line, i) => (
          <tr
            key={i}
            style={{
              background:
                line.type === "add"
                  ? "rgba(48, 209, 88, 0.08)"
                  : line.type === "del"
                    ? "rgba(255, 59, 48, 0.08)"
                    : "transparent",
            }}
          >
            <td
              class="text-unq-text-3 w-10 select-none px-2 py-0.5 text-right"
              style="border-right: 1px solid var(--unq-border-subtle);"
            >
              {line.oldNumber ?? ""}
            </td>
            <td
              class="text-unq-text-3 w-10 select-none px-2 py-0.5 text-right"
              style="border-right: 1px solid var(--unq-border-subtle);"
            >
              {line.newNumber ?? ""}
            </td>
            <td
              class="w-4 select-none px-1 py-0.5 text-center"
              style={{
                color:
                  line.type === "add"
                    ? "var(--unq-success-strong)"
                    : line.type === "del"
                      ? "var(--unq-danger-strong)"
                      : "var(--unq-text-3)",
              }}
            >
              {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
            </td>
            <td
              class="whitespace-pre-wrap break-all px-2 py-0.5"
              style={{
                color:
                  line.type === "del"
                    ? "var(--unq-danger-strong)"
                    : line.type === "add"
                      ? "var(--unq-success-strong)"
                      : "inherit",
              }}
            >
              {line.inlineParts
                ? line.inlineParts.map((p, j) => (
                    <span
                      key={j}
                      style={{
                        background: p.type === "del" ? "rgba(255, 59, 48, 0.2)" : "transparent",
                        textDecoration: p.type === "del" ? "line-through" : "none",
                      }}
                    >
                      {p.text}
                    </span>
                  ))
                : line.content}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitView({ lines }: { lines: DiffLine[] }) {
  // Pair up del+add lines for side-by-side display
  const pairs: { left: DiffLine | null; right: DiffLine | null }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.type === "equal") {
      pairs.push({ left: line, right: line });
      i++;
    } else if (line.type === "del") {
      const next = lines[i + 1];
      if (next && next.type === "add") {
        pairs.push({ left: line, right: next });
        i += 2;
      } else {
        pairs.push({ left: line, right: null });
        i++;
      }
    } else {
      pairs.push({ left: null, right: line });
      i++;
    }
  }

  return (
    <table class="w-full border-collapse font-mono text-xs" style="table-layout: fixed;">
      <tbody>
        {pairs.map((pair, idx) => (
          <tr key={idx}>
            <td
              class="text-unq-text-3 w-8 select-none px-1 py-0.5 text-right"
              style="border-right: 1px solid var(--unq-border-subtle);"
            >
              {pair.left?.oldNumber ?? ""}
            </td>
            <td
              class="whitespace-pre-wrap break-all px-2 py-0.5"
              style={{
                width: "45%",
                background: pair.left?.type === "del" ? "rgba(255, 59, 48, 0.08)" : "transparent",
                color: pair.left?.type === "del" ? "var(--unq-danger-strong)" : "inherit",
                borderRight: "2px solid var(--unq-border)",
              }}
            >
              {pair.left
                ? pair.left.inlineParts
                  ? pair.left.inlineParts.map((p, j) => (
                      <span
                        key={j}
                        style={{
                          background: p.type === "del" ? "rgba(255, 59, 48, 0.2)" : "transparent",
                          textDecoration: p.type === "del" ? "line-through" : "none",
                        }}
                      >
                        {p.text}
                      </span>
                    ))
                  : pair.left.content
                : ""}
            </td>
            <td
              class="text-unq-text-3 w-8 select-none px-1 py-0.5 text-right"
              style="border-right: 1px solid var(--unq-border-subtle);"
            >
              {pair.right?.newNumber ?? ""}
            </td>
            <td
              class="whitespace-pre-wrap break-all px-2 py-0.5"
              style={{
                width: "45%",
                background: pair.right?.type === "add" ? "rgba(48, 209, 88, 0.08)" : "transparent",
                color: pair.right?.type === "add" ? "var(--unq-success-strong)" : "inherit",
              }}
            >
              {pair.right
                ? pair.right.inlineParts
                  ? pair.right.inlineParts.map((p, j) => (
                      <span
                        key={j}
                        style={{
                          background: p.type === "add" ? "rgba(48, 209, 88, 0.2)" : "transparent",
                        }}
                      >
                        {p.text}
                      </span>
                    ))
                  : pair.right.content
                : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
