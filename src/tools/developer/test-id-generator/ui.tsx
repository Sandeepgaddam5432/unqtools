"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ID_SPECS,
  ID_TYPE_LIST,
  HONESTY_BANNER,
  DEFAULT_COUNT,
  MAX_COUNT,
  MAX_VALIDATE_ROWS,
  generateBulk,
  validateBulk,
  summarizeBulkValidation,
  idsToJson,
  idsToCsv,
  idsToText,
  resultsToCsv,
  resultsToJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IdType,
  type HistoryEntry,
} from "./logic";
import {
  Fingerprint,
  History,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Database,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type ExportFormat = "json" | "csv" | "text";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  text: "Text",
};

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  json: "json",
  csv: "csv",
  text: "txt",
};

const FORMAT_MIMES: Record<ExportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  text: "text/plain",
};

type Mode = "generate" | "validate";

export default function TestIdGenerator() {
  const [mode, setMode] = useState<Mode>("generate");
  const [seed, setSeed] = useState("test-seed");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [selectedTypes, setSelectedTypes] = useState<IdType[]>(["us-ssn"]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [validateType, setValidateType] = useState<IdType>("us-ssn");
  const [validateInput, setValidateInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seed) setSeed(p.seed);
      if (p.count) setCount(p.count);
      if (p.types.length > 0) setSelectedTypes(p.types);
      if (p.seed || p.types.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const ids = useMemo(
    () => generateBulk({
      count,
      seed: seed || "default",
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
    }),
    [count, seed, selectedTypes],
  );

  const generateOutput = useMemo(() => {
    if (ids.length === 0) return "";
    switch (exportFormat) {
      case "json": return idsToJson(ids);
      case "csv": return idsToCsv(ids);
      case "text": return idsToText(ids);
      default: return idsToJson(ids);
    }
  }, [ids, exportFormat]);

  const validateLines = useMemo(
    () => validateInput.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0),
    [validateInput],
  );

  const validateSummary = useMemo(() => {
    if (validateLines.length === 0) return null;
    return summarizeBulkValidation({ type: validateType, inputs: validateLines });
  }, [validateType, validateLines]);

  const validateOutput = useMemo(() => {
    if (!validateSummary) return "";
    switch (exportFormat) {
      case "json": return resultsToJson(validateSummary.sample);
      case "csv": return resultsToCsv(validateSummary.sample);
      case "text":
        // Text shows all sample rows
        return validateSummary.sample.map((r) =>
          `${r.valid ? "OK" : "FAIL"}\t${r.type}\t${r.input}\t${r.reason}`
        ).join("\n");
      default: return resultsToJson(validateSummary.sample);
    }
  }, [validateSummary, exportFormat]);

  const toggleType = (t: IdType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const handleRandomSeed = useCallback(() => {
    const s = Math.random().toString(36).slice(2, 10);
    setSeed(s);
    toast.success(`New seed: ${s}`);
  }, []);

  const handleSaveHistory = useCallback(
    (action: "generate" | "validate") => {
      saveHistory({
        ts: Date.now(),
        seed,
        count: action === "generate" ? count : validateLines.length,
        types: action === "generate" ? selectedTypes : [validateType],
        action,
      });
      setHistory(loadHistory());
    },
    [seed, count, selectedTypes, validateType, validateLines.length],
  );

  const handleClear = useCallback(() => {
    setSeed("test-seed");
    setCount(DEFAULT_COUNT);
    setSelectedTypes(["us-ssn"]);
    setExportFormat("json");
    setValidateType("us-ssn");
    setValidateInput("");
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl(seed, count, selectedTypes),
    [seed, count, selectedTypes],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Honesty banner */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs">{HONESTY_BANNER}</span>
      </div>

      {/* Mode toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === "generate" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("generate")}
              className="gap-1.5"
            >
              <Database className="h-3.5 w-3.5" /> Generate
            </Button>
            <Button
              variant={mode === "validate" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("validate")}
              className="gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Validate
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === "generate" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tid-seed" className="text-xs">Seed (deterministic)</Label>
                  <div className="flex gap-1">
                    <Input
                      id="tid-seed"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      className="font-mono text-xs"
                      placeholder="my-seed"
                    />
                    <Button variant="outline" size="sm" onClick={handleRandomSeed} title="Random seed">
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tid-count" className="text-xs">
                    Count (max {MAX_COUNT.toLocaleString()})
                  </Label>
                  <Input
                    id="tid-count"
                    type="number"
                    min={1}
                    max={MAX_COUNT}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  ID types (pick at least one — empty = random across all 12)
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                  {ID_TYPE_LIST.map((t) => {
                    const spec = ID_SPECS[t];
                    return (
                      <label
                        key={t}
                        className="flex items-start gap-1.5 text-xs cursor-pointer rounded border px-2 py-1.5 hover:bg-muted/40"
                        title={spec.description}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(t)}
                          onChange={() => toggleType(t)}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-foreground flex items-center gap-1">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{spec.countryFlag}</Badge>
                            {spec.label}
                          </span>
                          {spec.reservedRange && (
                            <span className="text-[9px] text-emerald-700 dark:text-emerald-400 truncate">
                              reserved: {spec.reservedRange.split("(")[0]}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px] w-fit h-4 px-1">{spec.checksumAlgorithm}</Badge>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {ids.length > 0 ? (
            <>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Fingerprint className="h-4 w-4" /> Generated test IDs ({ids.length.toLocaleString()})
                  </h3>
                  <div className="space-y-1 max-h-[400px] overflow-auto">
                    {ids.slice(0, 100).map((id, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{id.label}</Badge>
                          <span className="font-mono text-foreground">{id.formatted}</span>
                          {ID_SPECS[id.type].reservedRange && (
                            <Badge variant="outline" className="text-[9px] text-emerald-700 dark:text-emerald-400">
                              reserved
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {ids.length > 100 && (
                      <div className="text-[11px] text-muted-foreground text-center pt-1">
                        Showing first 100 of {ids.length.toLocaleString()} — see export below for full output.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Database className="h-4 w-4" /> Export ({FORMAT_LABELS[exportFormat]})
                    </h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                        className="h-8 text-xs rounded border bg-background px-2"
                      >
                        {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                          <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                        ))}
                      </select>
                      <Badge variant="outline" className="text-[10px]">{generateOutput.length.toLocaleString()} bytes</Badge>
                    </div>
                  </div>
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                    {generateOutput}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton
                      getText={() => { handleSaveHistory("generate"); return generateOutput; }}
                      label="Copy output"
                    />
                    <DownloadButton
                      getText={() => { handleSaveHistory("generate"); return generateOutput; }}
                      filename={`test-ids.${FORMAT_EXTENSIONS[exportFormat]}`}
                      mime={FORMAT_MIMES[exportFormat]}
                      label={`Download .${FORMAT_EXTENSIONS[exportFormat]}`}
                    />
                    <ShareButton getUrl={() => { handleSaveHistory("generate"); return shareUrl; }} />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState
              title="No IDs generated yet"
              hint="Select at least one ID type and click Generate, or use the count input to produce a batch."
              icon={<Fingerprint className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {mode === "validate" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label htmlFor="tid-vtype" className="text-xs">ID type to validate against</Label>
                <select
                  id="tid-vtype"
                  value={validateType}
                  onChange={(e) => setValidateType(e.target.value as IdType)}
                  className="h-9 w-full sm:w-72 mt-1 text-xs rounded border bg-background px-2"
                >
                  {ID_TYPE_LIST.map((t) => (
                    <option key={t} value={t}>
                      {ID_SPECS[t].countryFlag} — {ID_SPECS[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tid-vinput" className="text-xs">
                  IDs to validate — one per line (max {MAX_VALIDATE_ROWS.toLocaleString()} rows)
                </Label>
                <Textarea
                  id="tid-vinput"
                  value={validateInput}
                  onChange={(e) => setValidateInput(e.target.value)}
                  placeholder={"900-12-3456\n666-12-3456\n999-99-9999"}
                  className="min-h-[120px] resize-y font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                <strong className="text-foreground">{ID_SPECS[validateType].label}:</strong> {ID_SPECS[validateType].description}
              </p>
            </CardContent>
          </Card>

          {validateSummary ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Validation results
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Total: {validateSummary.total.toLocaleString()}
                    </Badge>
                    <Badge variant="default" className="bg-emerald-600 text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Valid: {validateSummary.valid.toLocaleString()}
                    </Badge>
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" /> Invalid: {validateSummary.invalid.toLocaleString()}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {validateSummary.sample.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded border px-3 py-1.5 text-xs ${r.valid ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {r.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className="font-mono text-foreground">{r.input}</span>
                        <span className="text-[10px] text-muted-foreground">→ {r.normalized}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{r.reason}</span>
                      </div>
                    </div>
                  ))}
                  {validateSummary.total > validateSummary.sample.length && (
                    <div className="text-[11px] text-muted-foreground text-center pt-1">
                      Showing first {validateSummary.sample.length} of {validateSummary.total.toLocaleString()} — see export below for full sample.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                      <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                  <CopyButton
                    getText={() => { handleSaveHistory("validate"); return validateOutput; }}
                    label="Copy results"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory("validate"); return validateOutput; }}
                    filename={`id-validation.${FORMAT_EXTENSIONS[exportFormat]}`}
                    mime={FORMAT_MIMES[exportFormat]}
                    label={`Download .${FORMAT_EXTENSIONS[exportFormat]}`}
                  />
                  <ClearButton onClick={() => setValidateInput("")} label="Clear input" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Paste IDs to validate"
              hint={`Enter one ID per line. Each will be checked against the ${ID_SPECS[validateType].label} format and ${ID_SPECS[validateType].checksumAlgorithm} checksum.`}
              icon={<ShieldCheck className="h-8 w-8" />}
            />
          )}
        </>
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant={h.action === "generate" ? "default" : "secondary"} className="text-[10px]">
                    {h.action}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{h.count.toLocaleString()} IDs</Badge>
                  {h.action === "generate" && (
                    <span className="font-mono text-muted-foreground">seed: {h.seed}</span>
                  )}
                  <span className="text-muted-foreground">
                    {h.types.map((t) => ID_SPECS[t].label).join(", ") || "all types"}
                  </span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Test-only:</strong> Every ID generated here is format-valid but UNASSIGNED, using reserved or never-issued ranges where defined. Generated locally via a seeded mulberry32 PRNG. History stored in localStorage (max 20, metadata only — never the IDs themselves).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
