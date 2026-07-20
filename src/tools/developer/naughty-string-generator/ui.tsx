"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_SAMPLE_OPTIONS,
  MAX_SAMPLE,
  NAUGHTY_STRINGS,
  applyFilter,
  countByCategory,
  librarySize,
  sampleStrings,
  sampleUniqueStrings,
  generateUnicodeRange,
  generateBoundaryValues,
  renderText,
  renderCsv,
  renderJson,
  renderPlaywrightFixture,
  renderJestFixture,
  renderPytestFixture,
  renderLoopSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type NaughtyCategory,
  type NaughtyString,
  type HistoryEntry,
} from "./logic";
import { History, ShieldAlert, Search, Dices, Copy, Download, AlertTriangle } from "lucide-react";

type ExportFormat = "text" | "csv" | "json" | "playwright" | "jest" | "pytest" | "loop";

export default function NaughtyStringGenerator() {
  const [selectedCats, setSelectedCats] = useState<NaughtyCategory[]>([]);
  const [search, setSearch] = useState("");
  const [seed, setSeed] = useState(DEFAULT_SAMPLE_OPTIONS.seed);
  const [sampleCount, setSampleCount] = useState(DEFAULT_SAMPLE_OPTIONS.count);
  const [uniqueSample, setUniqueSample] = useState(false);
  const [sampled, setSampled] = useState<NaughtyString[] | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("text");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Custom Unicode range generator
  const [unicodeStart, setUnicodeStart] = useState(0x0041); // 'A'
  const [unicodeEnd, setUnicodeEnd] = useState(0x005A); // 'Z'
  const [unicodeCount, setUnicodeCount] = useState(10);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setSeed(parsed.seed);
      setSampleCount(parsed.count);
      setSelectedCats(parsed.categories);
      toast.info("Loaded config from share link");
    }
  }, []);

  const categoryCounts = useMemo(() => countByCategory(NAUGHTY_STRINGS), []);
  const filtered = useMemo(
    () => applyFilter(NAUGHTY_STRINGS, selectedCats, search),
    [selectedCats, search],
  );

  const exportSource = sampled ?? filtered;

  const exportText = useMemo(() => {
    const list = exportSource;
    switch (exportFormat) {
      case "text": return renderText(list);
      case "csv": return renderCsv(list);
      case "json": return renderJson(list);
      case "playwright": return renderPlaywrightFixture(list);
      case "jest": return renderJestFixture(list);
      case "pytest": return renderPytestFixture(list);
      case "loop": return renderLoopSnippet(list);
      default: return renderText(list);
    }
  }, [exportSource, exportFormat]);

  const exportFilename = useMemo(() => {
    switch (exportFormat) {
      case "csv": return "naughty-strings.csv";
      case "json": return "naughty-strings.json";
      case "playwright": return "naughty-strings.spec.ts";
      case "jest": return "naughty-strings.spec.js";
      case "pytest": return "test_naughty_strings.py";
      case "loop": return "naughty-loop.js";
      default: return "naughty-strings.txt";
    }
  }, [exportFormat]);

  const exportMime = useMemo(() => {
    switch (exportFormat) {
      case "csv": return "text/csv";
      case "json": return "application/json";
      case "playwright":
      case "jest":
      case "loop": return "text/javascript";
      case "pytest": return "text/x-python";
      default: return "text/plain";
    }
  }, [exportFormat]);

  const toggleCat = useCallback((cat: NaughtyCategory) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const handleSample = useCallback(() => {
    setError(null);
    const opts = { seed, count: sampleCount, categories: selectedCats };
    try {
      const out = uniqueSample ? sampleUniqueStrings(opts) : sampleStrings(opts);
      setSampled(out);
      saveHistory({
        ts: Date.now(),
        seed,
        count: out.length,
        categories: selectedCats,
        preview: out.slice(0, 4).map((s) => s.value).join(", "),
      });
      setHistory(loadHistory());
      toast.success(`Sampled ${out.length} string(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error("Sampling failed");
    }
  }, [seed, sampleCount, selectedCats, uniqueSample]);

  const handleRandomSeed = useCallback(() => {
    const s = Math.floor(Math.random() * 0x100000000) >>> 0;
    setSeed(s);
    toast.info(`Seed: ${s}`);
  }, []);

  const handleUnicodeGenerate = useCallback(() => {
    setError(null);
    try {
      const out = generateUnicodeRange({
        startCodePoint: unicodeStart,
        endCodePoint: unicodeEnd,
        count: unicodeCount,
        seed,
      });
      setSampled(out);
      saveHistory({
        ts: Date.now(),
        seed,
        count: out.length,
        categories: ["unicode"],
        preview: `Unicode range U+${unicodeStart.toString(16).toUpperCase()}..U+${unicodeEnd.toString(16).toUpperCase()}`,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${out.length} Unicode character(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error("Unicode generation failed");
    }
  }, [unicodeStart, unicodeEnd, unicodeCount, seed]);

  const handleBoundaryGenerate = useCallback(() => {
    const out = generateBoundaryValues();
    setSampled(out);
    saveHistory({
      ts: Date.now(),
      seed: 0,
      count: out.length,
      categories: ["boundary"],
      preview: "Boundary-value preset",
    });
    setHistory(loadHistory());
    toast.success(`Loaded ${out.length} boundary-value presets`);
  }, []);

  const handleClear = useCallback(() => {
    setSampled(null);
    setError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleCopyOne = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Defensive-use banner */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Defensive QA use only.</strong> The injection payloads in this library are
          provided to help you test that your own forms, parsers, and APIs correctly escape,
          parameterize, and reject dangerous input. <strong>Never</strong> run these against
          systems you don&apos;t own or have explicit permission to test. 100% client-side —
          nothing is uploaded.
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Filter &amp; search the library
          </h3>
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search values & descriptions (e.g. 'DROP TABLE', 'BOM', 'surrogate')"
            className="h-9 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => (
              <label
                key={c}
                className="flex items-center gap-1.5 text-xs cursor-pointer rounded border bg-background px-2 py-1"
                title={CATEGORY_DESCRIPTIONS[c]}
              >
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c)}
                  onChange={() => toggleCat(c)}
                />
                <span className="font-medium">{CATEGORY_LABELS[c]}</span>
                <Badge variant="secondary" className="text-[10px]">{categoryCounts[c]}</Badge>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCats([])}
            >All categories</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCats([...ALL_CATEGORIES])}
            >Select all</Button>
            <Badge variant="outline" className="text-[10px]">
              {filtered.length} of {librarySize()} shown
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Dices className="h-4 w-4" /> Sample generator (seeded)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Seed (uint32)">
              <Input
                type="number"
                min={0}
                max={4294967295}
                value={seed}
                onChange={(e) => setSeed(Math.max(0, Math.min(4294967295, Number(e.target.value) || 0)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label={`Count (1..${MAX_SAMPLE})`}>
              <Input
                type="number"
                min={1}
                max={MAX_SAMPLE}
                value={sampleCount}
                onChange={(e) => setSampleCount(Math.max(1, Math.min(MAX_SAMPLE, Number(e.target.value) || 1)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Unique (no repeats)">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer h-8">
                <input
                  type="checkbox"
                  checked={uniqueSample}
                  onChange={(e) => setUniqueSample(e.target.checked)}
                />
                <span>Dedupe</span>
              </label>
            </Field>
            <Field label=" ">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomSeed}
                className="h-8 w-full gap-1.5"
              >
                <Dices className="h-3.5 w-3.5" /> Random seed
              </Button>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSample} className="gap-1.5">
              <Dices className="h-3.5 w-3.5" /> Sample {sampleCount} from {selectedCats.length === 0 ? "all categories" : `${selectedCats.length} categor${selectedCats.length === 1 ? "y" : "ies"}`}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBoundaryGenerate} className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Load boundary-value preset
            </Button>
            {sampled && <ClearButton onClick={handleClear} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Custom Unicode range generator
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Start code point (hex or decimal)">
              <Input
                type="number"
                min={0}
                max={0x10FFFF}
                value={unicodeStart}
                onChange={(e) => setUnicodeStart(Math.max(0, Math.min(0x10FFFF, Number(e.target.value) || 0)))}
                className="h-8 text-xs font-mono"
              />
            </Field>
            <Field label="End code point (hex or decimal)">
              <Input
                type="number"
                min={0}
                max={0x10FFFF}
                value={unicodeEnd}
                onChange={(e) => setUnicodeEnd(Math.max(0, Math.min(0x10FFFF, Number(e.target.value) || 0)))}
                className="h-8 text-xs font-mono"
              />
            </Field>
            <Field label="Count">
              <Input
                type="number"
                min={1}
                max={MAX_SAMPLE}
                value={unicodeCount}
                onChange={(e) => setUnicodeCount(Math.max(1, Math.min(MAX_SAMPLE, Number(e.target.value) || 1)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label={`Range preview`}>
              <code className="text-[11px] text-muted-foreground font-mono">
                U+{unicodeStart.toString(16).toUpperCase().padStart(4, "0")} .. U+{unicodeEnd.toString(16).toUpperCase().padStart(4, "0")}
              </code>
            </Field>
          </div>
          <Button size="sm" onClick={handleUnicodeGenerate} className="gap-1.5">
            <Dices className="h-3.5 w-3.5" /> Generate Unicode sample
          </Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Copy className="h-4 w-4" /> {sampled ? `Sampled (${exportSource.length})` : `Library results (${exportSource.length})`}
            </h3>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="h-8 text-xs rounded border bg-background px-2"
            >
              <option value="text">Plain text (values)</option>
              <option value="csv">CSV (category,value)</option>
              <option value="json">JSON array</option>
              <option value="playwright">Playwright fixture</option>
              <option value="jest">Jest fixture</option>
              <option value="pytest">pytest fixture</option>
              <option value="loop">Loop snippet (defensive)</option>
            </select>
          </div>

          {/* Inline list view */}
          <div className="space-y-1 max-h-[400px] overflow-auto rounded border bg-background p-2">
            {exportSource.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No strings match the current filter.</p>
            ) : (
              exportSource.slice(0, 200).map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1 text-xs">
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">{CATEGORY_LABELS[s.category]}</Badge>
                  <code className="flex-1 font-mono text-foreground truncate" title={s.description}>
                    {s.value === "" ? <span className="text-muted-foreground italic">(empty)</span> : JSON.stringify(s.value)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyOne(s.value)}
                    title="Copy value"
                    className="h-7 w-7"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
            {exportSource.length > 200 && (
              <p className="text-[10px] text-muted-foreground p-2 text-center">
                Showing first 200 of {exportSource.length}. Export for the full list.
              </p>
            )}
          </div>

          <Textarea
            readOnly
            value={exportText}
            className="min-h-[200px] resize-y font-mono text-xs"
          />

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => exportText} label="Copy" />
            <DownloadButton
              getText={() => exportText}
              filename={exportFilename}
              mime={exportMime}
              label={`Download ${exportFilename}`}
            />
            <ShareButton getUrl={() => buildShareUrl({ seed, count: sampleCount, categories: selectedCats })} />
          </div>
        </CardContent>
      </Card>

      {!sampled && filtered.length === 0 && !error && (
        <EmptyState
          title="No strings match the current filter"
          hint="Toggle category checkboxes or clear the search to see the full library of 200+ naughty test strings."
          icon={<Search className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">seed={h.seed}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.count} strings</Badge>
                    {h.categories.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">all categories</Badge>
                    ) : (
                      h.categories.slice(0, 3).map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">{CATEGORY_LABELS[c]}</Badge>
                      ))
                    )}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.preview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All filtering, sampling, and
            export run locally in your browser — nothing is uploaded. History (last 20) is
            stored in localStorage on this device only. The share URL encodes your config in
            the URL fragment, which browsers never send to servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}
