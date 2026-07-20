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
} from "../../_shared";
import { toast } from "sonner";
import {
  ISBN_GROUPS,
  HONESTY_BANNER,
  validateIsbn,
  parseIsbn,
  hyphenateIsbn,
  generateBatch,
  convertIsbn,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  renderEan13Text,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IsbnVersion,
  type IsbnFormat,
  type HistoryEntry,
} from "./logic";
import {
  BookOpen,
  History,
  ShieldCheck,
  AlertTriangle,
  Wand2,
  ListChecks,
  ArrowLeftRight,
  Barcode,
} from "lucide-react";

type Mode = "generate" | "validate" | "convert" | "batch";

const SEGMENT_COLORS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-blue-600 dark:text-blue-400",
  "text-amber-600 dark:text-amber-400",
  "text-purple-600 dark:text-purple-400",
  "text-rose-600 dark:text-rose-400",
];

export default function IsbnGeneratorValidator() {
  const [mode, setMode] = useState<Mode>("generate");
  const [version, setVersion] = useState<IsbnVersion>("isbn13");
  const [prefix, setPrefix] = useState<"978" | "979">("978");
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState("isbn-seed-1");
  const [groupHint, setGroupHint] = useState<string>("");
  const [format, setFormat] = useState<IsbnFormat>("hyphenated");

  const [validateInput, setValidateInput] = useState("");
  const [convertInput, setConvertInput] = useState("");
  const [convertTarget, setConvertTarget] = useState<IsbnVersion>("isbn13");
  const [batchInput, setBatchInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setMode(p.mode);
      if (p.params.version === "isbn10" || p.params.version === "isbn13") {
        setVersion(p.params.version);
      }
      if (p.params.prefix === "978" || p.params.prefix === "979") {
        setPrefix(p.params.prefix);
      }
      if (p.params.count) {
        const n = parseInt(p.params.count, 10);
        if (!Number.isNaN(n)) setCount(Math.max(1, Math.min(1000, n)));
      }
      if (p.params.seed) setSeed(p.params.seed);
      if (p.params.group) setGroupHint(p.params.group);
      if (p.params.fmt === "raw" || p.params.fmt === "hyphenated") {
        setFormat(p.params.fmt);
      }
      if (p.params.isbn) setValidateInput(p.params.isbn);
      if (Object.keys(p.params).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  // ---- Generate ----
  const generated = useMemo(() => {
    if (mode !== "generate") return [];
    return generateBatch({
      version,
      count,
      seed,
      prefix,
      groupHint: groupHint || undefined,
    });
  }, [mode, version, count, seed, prefix, groupHint]);

  const generatedText = useMemo(
    () => generated.map((g) => (format === "hyphenated" ? g.hyphenated : g.isbn)).join("\n"),
    [generated, format],
  );

  const handleGenerateHistory = useCallback(() => {
    if (generated.length > 0) {
      saveHistory({
        ts: Date.now(),
        action: "generate",
        version,
        generateCount: generated.length,
        batchTotal: 0,
        batchValid: 0,
        batchInvalid: 0,
      });
      setHistory(loadHistory());
    }
  }, [generated, version]);

  // ---- Validate ----
  const validateResult = useMemo(() => {
    if (mode !== "validate" || !validateInput.trim()) return null;
    return validateIsbn(validateInput);
  }, [mode, validateInput]);

  const parsedIsbn = useMemo(() => {
    if (!validateResult?.valid) return null;
    return parseIsbn(validateResult.normalized);
  }, [validateResult]);

  const eanArt = useMemo(() => {
    if (!validateResult?.valid || validateResult.version !== "isbn13") return "";
    return renderEan13Text(validateResult.normalized);
  }, [validateResult]);

  const handleValidateHistory = useCallback(() => {
    if (validateResult) {
      saveHistory({
        ts: Date.now(),
        action: "validate_single",
        version: validateResult.version,
        generateCount: 0,
        batchTotal: 1,
        batchValid: validateResult.valid ? 1 : 0,
        batchInvalid: validateResult.valid ? 0 : 1,
      });
      setHistory(loadHistory());
    }
  }, [validateResult]);

  // ---- Convert ----
  const convertResult = useMemo(() => {
    if (mode !== "convert" || !convertInput.trim()) return null;
    return convertIsbn(convertInput, convertTarget);
  }, [mode, convertInput, convertTarget]);

  const handleConvertHistory = useCallback(() => {
    if (convertResult) {
      saveHistory({
        ts: Date.now(),
        action: "convert",
        version: convertTarget,
        generateCount: 0,
        batchTotal: 1,
        batchValid: convertResult.ok ? 1 : 0,
        batchInvalid: convertResult.ok ? 0 : 1,
      });
      setHistory(loadHistory());
    }
  }, [convertResult, convertTarget]);

  // ---- Batch ----
  const batchRows = useMemo(() => {
    if (mode !== "batch") return [];
    return validateBatch(parseBatchInput(batchInput));
  }, [mode, batchInput]);

  const batchSummary = useMemo(() => summarizeBatch(batchRows), [batchRows]);
  const batchCsv = useMemo(() => renderBatchCsv(batchRows), [batchRows]);

  const handleBatchHistory = useCallback(() => {
    if (batchRows.length > 0) {
      saveHistory({
        ts: Date.now(),
        action: "validate_batch",
        version: null,
        generateCount: 0,
        batchTotal: batchSummary.total,
        batchValid: batchSummary.valid,
        batchInvalid: batchSummary.invalid,
      });
      setHistory(loadHistory());
    }
  }, [batchRows, batchSummary]);

  const handleClear = useCallback(() => {
    setValidateInput("");
    setConvertInput("");
    setBatchInput("");
    setSeed(`isbn-seed-${Date.now()}`);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const buildShare = useCallback(() => {
    const params: Record<string, string> = {
      version,
      count: String(count),
      seed,
      prefix,
      fmt: format,
    };
    if (groupHint) params.group = groupHint;
    if (validateInput) params.isbn = validateInput;
    return buildShareUrl(mode, params);
  }, [mode, version, count, seed, prefix, format, groupHint, validateInput]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Mode tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "generate", label: "Generate", icon: Wand2 },
              { id: "validate", label: "Validate", icon: ShieldCheck },
              { id: "convert", label: "Convert", icon: ArrowLeftRight },
              { id: "batch", label: "Batch", icon: ListChecks },
            ] as { id: Mode; label: string; icon: React.ElementType }[]).map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  variant={mode === t.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode(t.id)}
                  className="gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Honesty banner */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>{HONESTY_BANNER}</span>
      </div>

      {mode === "generate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Version</Label>
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value as IsbnVersion)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="isbn10">ISBN-10 (mod-11)</option>
                  <option value="isbn13">ISBN-13 (mod-10)</option>
                </select>
              </div>
              {version === "isbn13" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">GS1 Prefix</Label>
                  <select
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value as "978" | "979")}
                    className="h-9 w-full text-xs rounded border bg-background px-2"
                  >
                    <option value="978">978 (convertible to ISBN-10)</option>
                    <option value="979">979 (no ISBN-10 form)</option>
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Count (1–1000)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as IsbnFormat)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="hyphenated">Hyphenated</option>
                  <option value="raw">Raw digits</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seed (deterministic)</Label>
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Group hint (optional)</Label>
                <select
                  value={groupHint}
                  onChange={(e) => setGroupHint(e.target.value)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="">Any group</option>
                  {ISBN_GROUPS.map((g) => (
                    <option key={g.group} value={g.group}>
                      {g.group} — {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {generated.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" /> {generated.length} ISBNs
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {version === "isbn10" ? "ISBN-10 / mod-11" : `ISBN-13 / ${prefix} / mod-10`}
                  </Badge>
                </div>
                <Textarea
                  readOnly
                  value={generatedText}
                  className="min-h-[200px] resize-y font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton getText={() => { handleGenerateHistory(); return generatedText; }} label="Copy all" />
                  <DownloadButton
                    getText={() => generatedText}
                    filename="isbns.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => "index,version,isbn,hyphenated\n" +
                      generated.map((g) => `${g.index + 1},${g.version},${g.isbn},${g.hyphenated}`).join("\n")}
                    filename="isbns.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton getUrl={() => { handleGenerateHistory(); return buildShare(); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <EmptyState
                title="Pick options and generate ISBNs"
                hint="Choose ISBN-10 or ISBN-13, set the count, and click generate. Same seed → same ISBNs (deterministic for test fixtures)."
                icon={<Wand2 className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mode === "validate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="isbn-validate">ISBN to validate</Label>
              <Input
                id="isbn-validate"
                value={validateInput}
                onChange={(e) => setValidateInput(e.target.value)}
                placeholder="e.g. 978-0-306-40615-7 or 0306406152"
                className="font-mono text-sm"
              />
            </div>
            {validateResult && (
              <div className={`rounded-lg border p-3 text-sm ${validateResult.valid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {validateResult.valid ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {validateResult.valid ? "Valid" : "Invalid"}
                  {validateResult.version && (
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {validateResult.version === "isbn10" ? "ISBN-10" : "ISBN-13"}
                    </Badge>
                  )}
                  {validateResult.checkDigit && (
                    <Badge variant="outline" className="text-[10px]">
                      check: {validateResult.checkDigit}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs opacity-90">{validateResult.message}</p>
              </div>
            )}
            {parsedIsbn && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Structural breakdown</div>
                <div className="font-mono text-sm flex flex-wrap items-center gap-1">
                  {parsedIsbn.prefix && (
                    <Segment color={SEGMENT_COLORS[0]!} label="Prefix" value={parsedIsbn.prefix} />
                  )}
                  {parsedIsbn.group && (
                    <Segment color={SEGMENT_COLORS[1]!} label="Group" value={parsedIsbn.group} />
                  )}
                  {parsedIsbn.publisher && (
                    <Segment color={SEGMENT_COLORS[2]!} label="Publisher" value={parsedIsbn.publisher} />
                  )}
                  {parsedIsbn.title && (
                    <Segment color={SEGMENT_COLORS[3]!} label="Title" value={parsedIsbn.title} />
                  )}
                  <Segment color={SEGMENT_COLORS[4]!} label="Check" value={parsedIsbn.check} />
                </div>
                {parsedIsbn.hyphenated && (
                  <div className="text-xs text-muted-foreground">
                    Hyphenated: <span className="font-mono text-foreground">{parsedIsbn.hyphenated}</span>
                  </div>
                )}
              </div>
            )}
            {eanArt && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Barcode className="h-3.5 w-3.5" /> EAN-13 text art
                </div>
                <pre className="font-mono text-[10px] leading-tight overflow-x-auto bg-muted/30 p-2 rounded">
                  {eanArt}
                </pre>
              </div>
            )}
            {validateResult && (
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleValidateHistory(); return validateResult.normalized; }}
                  label="Copy normalized"
                />
                {parsedIsbn?.hyphenated && (
                  <CopyButton
                    getText={() => { handleValidateHistory(); return parsedIsbn.hyphenated!; }}
                    label="Copy hyphenated"
                  />
                )}
                <ShareButton getUrl={() => { handleValidateHistory(); return buildShare(); }} />
                <ClearButton onClick={() => setValidateInput("")} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "convert" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="isbn-convert-in">Input ISBN</Label>
                <Input
                  id="isbn-convert-in"
                  value={convertInput}
                  onChange={(e) => setConvertInput(e.target.value)}
                  placeholder="ISBN-10 or ISBN-13"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target version</Label>
                <div className="flex gap-2">
                  <Button
                    variant={convertTarget === "isbn10" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConvertTarget("isbn10")}
                  >ISBN-10</Button>
                  <Button
                    variant={convertTarget === "isbn13" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConvertTarget("isbn13")}
                  >ISBN-13</Button>
                </div>
              </div>
            </div>
            {convertResult && (
              <div className={`rounded-lg border p-3 text-sm ${convertResult.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {convertResult.ok ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {convertResult.ok ? "Converted" : "Not converted"}
                </div>
                <p className="mt-1 text-xs opacity-90">{convertResult.message}</p>
                {convertResult.output && (
                  <div className="mt-2 font-mono text-base font-semibold">
                    {hyphenateIsbn(convertResult.output)}
                  </div>
                )}
              </div>
            )}
            {convertResult?.output && (
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleConvertHistory(); return convertResult.output!; }}
                  label="Copy output"
                />
                <ShareButton getUrl={() => { handleConvertHistory(); return buildShare(); }} />
                <ClearButton onClick={() => setConvertInput("")} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="isbn-batch">Bulk ISBNs (one per line, comma, or semicolon)</Label>
              <Textarea
                id="isbn-batch"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={"9780306406157\n0306406152\n978-0-13-235088-4"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
            </div>
            {batchRows.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Total" value={batchSummary.total} />
                  <Stat label="Valid" value={batchSummary.valid} highlight="good" />
                  <Stat label="Invalid" value={batchSummary.invalid} highlight="bad" />
                  <Stat label="ISBN-10 / ISBN-13" value={`${batchSummary.isbn10Count} / ${batchSummary.isbn13Count}`} />
                </div>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {batchRows.map((r) => (
                    <div
                      key={r.index}
                      className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${r.valid ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"}`}
                    >
                      <Badge variant="outline" className="text-[10px] w-6 justify-center">{r.index}</Badge>
                      {r.version && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.version === "isbn10" ? "10" : "13"}
                        </Badge>
                      )}
                      <span className="font-mono text-foreground truncate flex-1">{r.normalized || r.raw}</span>
                      <span className={`text-[10px] ${r.valid ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                        {r.valid ? "valid" : r.code}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleBatchHistory(); return batchRows.filter((r) => r.valid).map((r) => r.normalized).join("\n"); }}
                    label="Copy valid only"
                  />
                  <DownloadButton
                    getText={() => { handleBatchHistory(); return batchCsv; }}
                    filename="isbn-batch.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton getUrl={() => { handleBatchHistory(); return buildShare(); }} />
                  <ClearButton onClick={() => setBatchInput("")} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.action}</Badge>
                  {h.version && <Badge variant="outline" className="mr-2">{h.version}</Badge>}
                  {h.generateCount > 0 && <Badge variant="outline" className="mr-2">{h.generateCount} generated</Badge>}
                  {h.batchTotal > 0 && (
                    <Badge variant="outline" className="mr-2">
                      {h.batchValid}/{h.batchTotal} valid
                    </Badge>
                  )}
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All ISBN generation, validation, conversion, and parsing runs locally. History stores only metadata (counts + timestamps) in localStorage on this device — never the ISBNs themselves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Segment({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <span className="font-semibold">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
