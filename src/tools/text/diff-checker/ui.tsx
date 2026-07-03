"use client";

import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import { toast } from "sonner";
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
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [view, setView] = useState<DiffView>("unified");
  const [diffOpts, setDiffOpts] = useState<DiffOptions>(DEFAULT_OPTIONS);
  const oldFileRef = useRef<HTMLInputElement>(null);
  const newFileRef = useRef<HTMLInputElement>(null);

  const diffLines = useMemo(
    () => computeDiff(oldText, newText, diffOpts),
    [oldText, newText, diffOpts],
  );
  const stats = useMemo(() => getDiffStats(diffLines), [diffLines]);
  const patch = useMemo(
    () => toUnifiedPatch(oldText, newText, diffOpts),
    [oldText, newText, diffOpts],
  );
  const hasInput = oldText || newText;

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    const text = await file.text();
    setter(text);
    toast.success(`Loaded ${file.name}`);
  }

  function swap() {
    const tmp = oldText;
    setOldText(newText);
    setNewText(tmp);
    toast.info("Swapped left ↔ right");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="dc-old">Original</Label>
            <Button variant="ghost" size="sm" onClick={() => oldFileRef.current?.click()}>
              Load file
            </Button>
            <input
              ref={oldFileRef}
              type="file"
              accept=".txt,.md,.json,.csv,.js,.ts,.html,.css,.xml,.yaml,.yml"
              className="hidden"
              onChange={(e) => handleFileInput(e, setOldText)}
            />
          </div>
          <Textarea
            id="dc-old"
            placeholder="Paste original text or load a file…"
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            className="min-h-[180px] resize-y font-mono text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="dc-new">Modified</Label>
            <Button variant="ghost" size="sm" onClick={() => newFileRef.current?.click()}>
              Load file
            </Button>
            <input
              ref={newFileRef}
              type="file"
              accept=".txt,.md,.json,.csv,.js,.ts,.html,.css,.xml,.yaml,.yml"
              className="hidden"
              onChange={(e) => handleFileInput(e, setNewText)}
            />
          </div>
          <Textarea
            id="dc-new"
            placeholder="Paste modified text or load a file…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="min-h-[180px] resize-y font-mono text-sm"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">View</Label>
              <div className="flex gap-2">
                <Button variant={view === "unified" ? "default" : "outline"} size="sm" onClick={() => setView("unified")}>
                  Unified
                </Button>
                <Button variant={view === "split" ? "default" : "outline"} size="sm" onClick={() => setView("split")}>
                  Side-by-side
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Granularity</Label>
              <div className="flex gap-2">
                {(["line", "word", "char"] as DiffGranularity[]).map((g) => (
                  <Button
                    key={g}
                    variant={diffOpts.granularity === g ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDiffOpts({ ...diffOpts, granularity: g })}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Options</Label>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={diffOpts.ignoreWhitespace} onCheckedChange={(c) => setDiffOpts({ ...diffOpts, ignoreWhitespace: c })} id="dc-iw" />
                  <Label htmlFor="dc-iw" className="text-sm cursor-pointer">Ignore whitespace</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={diffOpts.ignoreCase} onCheckedChange={(c) => setDiffOpts({ ...diffOpts, ignoreCase: c })} id="dc-ic" />
                  <Label htmlFor="dc-ic" className="text-sm cursor-pointer">Ignore case</Label>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={swap} className="ml-auto">Swap</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setOldText(SAMPLE_OLD); setNewText(SAMPLE_NEW); toast.info("Sample loaded"); }}>
          Load sample
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setOldText(""); setNewText(""); }} disabled={!hasInput}>
          Clear
        </Button>
      </div>

      {!hasInput ? (
        <EmptyState
          title="Compare two texts"
          hint="Paste original and modified text above, or load two files. The diff updates instantly as you type."
        />
      ) : diffLines.length === 0 || diffLines.every((l) => l.type === "equal") ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-emerald-500">Texts are identical</p>
            <p className="text-xs text-muted-foreground mt-1">No differences found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Diff:</span>
                <span className="text-emerald-500">+{stats.additions} added</span>
                <span className="text-destructive">−{stats.deletions} removed</span>
                <span className="text-muted-foreground">{stats.changes} changed</span>
                <span className="text-muted-foreground ml-auto text-xs">{stats.totalLines} lines</span>
                <CopyButton getText={() => patch} label="Copy .patch" />
                <DownloadButton getText={() => patch} filename="diff.patch" label="Download .patch" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto min-h-[120px]">
                {view === "unified" ? (
                  <UnifiedView lines={diffLines} />
                ) : (
                  <SplitView lines={diffLines} />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all diffing runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <table className="w-full border-collapse font-mono text-xs" style={{ tableLayout: "fixed" }}>
      <tbody>
        {lines.map((line, i) => (
          <tr
            key={i}
            style={{
              background:
                line.type === "add"
                  ? "color-mix(in oklch, var(--primary) 8%, transparent)"
                  : line.type === "del"
                    ? "color-mix(in oklch, var(--destructive) 8%, transparent)"
                    : "transparent",
            }}
          >
            <td className="w-10 select-none px-2 py-0.5 text-right text-muted-foreground border-r border-border/50">
              {line.oldNumber ?? ""}
            </td>
            <td className="w-10 select-none px-2 py-0.5 text-right text-muted-foreground border-r border-border/50">
              {line.newNumber ?? ""}
            </td>
            <td
              className="w-4 select-none px-1 py-0.5 text-center"
              style={{
                color:
                  line.type === "add"
                    ? "var(--primary)"
                    : line.type === "del"
                      ? "var(--destructive)"
                      : "var(--muted-foreground)",
              }}
            >
              {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
            </td>
            <td
              className="whitespace-pre-wrap break-all px-2 py-0.5"
              style={{
                color:
                  line.type === "del"
                    ? "var(--destructive)"
                    : line.type === "add"
                      ? "var(--primary)"
                      : "inherit",
              }}
            >
              {line.content}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitView({ lines }: { lines: DiffLine[] }) {
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
    <table className="w-full border-collapse font-mono text-xs" style={{ tableLayout: "fixed" }}>
      <tbody>
        {pairs.map((pair, idx) => (
          <tr key={idx}>
            <td className="w-8 select-none px-1 py-0.5 text-right text-muted-foreground border-r border-border/50">
              {pair.left?.oldNumber ?? ""}
            </td>
            <td
              className="whitespace-pre-wrap break-all px-2 py-0.5"
              style={{
                width: "45%",
                background: pair.left?.type === "del" ? "color-mix(in oklch, var(--destructive) 8%, transparent)" : "transparent",
                color: pair.left?.type === "del" ? "var(--destructive)" : "inherit",
                borderRight: "2px solid var(--border)",
              }}
            >
              {pair.left?.content ?? ""}
            </td>
            <td className="w-8 select-none px-1 py-0.5 text-right text-muted-foreground border-r border-border/50">
              {pair.right?.newNumber ?? ""}
            </td>
            <td
              className="whitespace-pre-wrap break-all px-2 py-0.5"
              style={{
                width: "45%",
                background: pair.right?.type === "add" ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent",
                color: pair.right?.type === "add" ? "var(--primary)" : "inherit",
              }}
            >
              {pair.right?.content ?? ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
