"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFField,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  PDFButton,
  PDFSignature,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, ListChecks, History, BarChart3, Wand2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  DownloadButton,
  EmptyState,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { formatBytes } from "../_shared/download";
import {
  ALL_FIELD_TYPES,
  DEFAULT_OPTIONS,
  FIELD_TYPE_LABELS,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_MIME,
  GROUP_MODES,
  GROUP_MODE_LABELS,
  OUTPUT_FORMATS,
  detectFieldType,
  extractFieldProperties,
  formatFieldValueByType,
  parseFieldMapping,
  buildLabelMap,
  suggestAllLabels,
  serializeFormSchema,
  computeSummaryStats,
  validateFields,
  renderOutput,
  exportFormSchema,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type FormField,
  type ConvertOptions,
  type OutputFormat,
  type GroupMode,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// pdf-lib form field extraction
// ---------------------------------------------------------------------------

/**
 * Read all AcroForm fields from a loaded pdf-lib document and convert them
 * to our plain FormField shape. Returns an empty array if the PDF has no form.
 */
function extractAllFormFields(doc: PDFDocument): FormField[] {
  let form;
  try {
    form = doc.getForm();
  } catch {
    return [];
  }
  if (!form) return [];

  const rawFields: PDFField[] = form.getFields();
  const out: FormField[] = [];
  for (const f of rawFields) {
    const field = extractFieldProperties(f as unknown as Parameters<typeof extractFieldProperties>[0]);
    // Type-specific deep extraction (override what extractFieldProperties defaults)
    try {
      if (f instanceof PDFTextField) {
        // Already handled by extractFieldProperties via getText()
      } else if (f instanceof PDFCheckBox) {
        // Already handled
      } else if (f instanceof PDFRadioGroup) {
        // Selected value not in public API — read underlying /V
        try {
          const acroField = (f as unknown as { acroField: { getValue?: () => unknown } }).acroField;
          const selected = acroField?.getValue?.();
          if (selected && typeof (selected as { toString?: () => string }).toString === "function") {
            field.value = (selected as { toString: () => string }).toString().replace(/[\/()]/g, "");
          }
        } catch {
          // ignore
        }
      } else if (f instanceof PDFDropdown) {
        try {
          const acroField = (f as unknown as { acroField: { getValue?: () => unknown } }).acroField;
          const selected = acroField?.getValue?.();
          if (selected && typeof (selected as { toString?: () => string }).toString === "function") {
            const s = (selected as { toString: () => string }).toString().replace(/[\/()]/g, "");
            if (s) field.value = s;
          }
        } catch {
          // ignore
        }
      } else if (f instanceof PDFOptionList) {
        try {
          const acroField = (f as unknown as { acroField: { getValue?: () => unknown } }).acroField;
          const selected = acroField?.getValue?.();
          if (selected && typeof (selected as { toString?: () => string }).toString === "function") {
            const s = (selected as { toString: () => string }).toString().replace(/[\/()]/g, "");
            if (s) field.value = s;
          }
        } catch {
          // ignore
        }
      } else if (f instanceof PDFButton) {
        field.type = "button";
      } else if (f instanceof PDFSignature) {
        field.type = "signature";
      }
    } catch {
      // ignore per-field errors
    }
    // Recompute filled
    field.filled = !!field.value && field.value !== "Off";
    out.push(field);
  }
  return out;
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfFormFieldExtractor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts((prev) => ({ ...prev, ...p }));
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const pageCount = doc.getPageCount();
      setFile({ name: f.name, bytes, pageCount });
      const extracted = extractAllFormFields(doc);
      setFields(extracted);
      setError("");
      if (extracted.length === 0) {
        toast.info("No AcroForm fields detected in this PDF.");
      } else {
        toast.success(`Loaded ${extracted.length} form field${extracted.length === 1 ? "" : "s"}.`);
      }
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setFields(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  async function run() {
    if (!file || !fields) return;
    setWorking(true);
    setError("");
    try {
      const v = validateOptions(opts);
      if (!v.ok) {
        setError(v.error);
        setWorking(false);
        return;
      }
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: file.pageCount,
        fieldCount: fields.length,
        format: opts.outputFormat,
      });
      setHistory(loadHistory());
      toast.success(`Report ready — ${fields.length} field${fields.length === 1 ? "" : "s"} exported as ${FORMAT_LABELS[opts.outputFormat]}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while extracting fields.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => fields ? computeSummaryStats(fields) : null, [fields]);
  const validation = useMemo(() => fields ? validateFields(fields) : null, [fields]);
  const labelMap = useMemo(() => {
    if (!fields) return new Map<string, string>();
    const parsed = parseFieldMapping(opts.fieldMapping);
    return buildLabelMap(parsed.mappings);
  }, [fields, opts.fieldMapping]);

  const renderedOutput = useMemo(() => {
    if (!fields || fields.length === 0) return "";
    return renderOutput(fields, opts, labelMap, file?.name ?? "");
  }, [fields, opts, labelMap, file]);

  const schemaJson = useMemo(() => {
    if (!fields) return "";
    return serializeFormSchema(exportFormSchema(fields, file?.name ?? ""));
  }, [fields, file]);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function autoSuggestLabels() {
    if (!fields) return;
    const suggestions = suggestAllLabels(fields);
    const text = suggestions.map((m) => `${m.name}=${m.label}`).join("\n");
    update("fieldMapping", text);
    toast.success("Auto-generated friendly labels for all fields.");
  }

  function handleDownload() {
    if (!fields || fields.length === 0 || !file) return;
    const filename = getOutputFilename(opts.outputFormat, file.name);
    const text = renderedOutput;
    const blob = new Blob([text], { type: FORMAT_MIME[opts.outputFormat] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${filename}`);
  }

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
              {fields && fields.length > 0 && (
                <span className="ml-2">• {fields.length} form field{fields.length === 1 ? "" : "s"}</span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove file" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Extract every AcroForm field with full properties — text, checkbox, radio, dropdown, list, signature, button.
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {fields && fields.length === 0 && (
        <EmptyState
          title="No form fields detected"
          hint="This PDF doesn't have an AcroForm. It may be a flat PDF (no fillable fields) or an XFA-only form (LiveCycle Designer) which pdf-lib cannot enumerate."
          icon={<ListChecks className="h-8 w-8" />}
        />
      )}

      {fields && fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pfe-format">Output format</Label>
                <select
                  id="pfe-format"
                  value={opts.outputFormat}
                  onChange={(e) => update("outputFormat", e.target.value as OutputFormat)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {OUTPUT_FORMATS.map((f) => (
                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pfe-group">Group by</Label>
                <select
                  id="pfe-group"
                  value={opts.groupBy}
                  onChange={(e) => update("groupBy", e.target.value as GroupMode)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {GROUP_MODES.map((g) => (
                    <option key={g} value={g}>{GROUP_MODE_LABELS[g]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={opts.includeValues}
                  onChange={(e) => update("includeValues", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Include current values
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={opts.includeProperties}
                  onChange={(e) => update("includeProperties", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Include full properties (max length, options, multiline, etc.)
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pfe-mapping">Field display labels (optional)</Label>
                <Button variant="ghost" size="sm" onClick={autoSuggestLabels} className="gap-1.5 h-7">
                  <Wand2 className="h-3 w-3" /> Auto-suggest
                </Button>
              </div>
              <Textarea
                id="pfe-mapping"
                value={opts.fieldMapping}
                onChange={(e) => update("fieldMapping", e.target.value)}
                placeholder={`# Optional: rename fields in the report\nfirst_name=First Name\ncountry=Country`}
                className="font-mono text-xs min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || !fields || fields.length === 0} loading={working} label="Generate report" />
        <ClearButton onClick={reset} disabled={!file && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {validation && !validation.ok && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-300">Validation findings</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
            {validation.requiredEmpty.map((m) => (
              <li key={`r-${m}`}>Required field <code className="font-mono">{m}</code> is empty.</li>
            ))}
            {validation.duplicateNames.map((d) => (
              <li key={`d-${d}`}>Field <code className="font-mono">{d}</code> appears on multiple pages (shared value across widgets).</li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Form Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total fields" value={summary.totalFields} />
              <Stat label="Filled" value={summary.filledFields} highlight={summary.filledFields > 0 ? "good" : undefined} />
              <Stat label="Empty" value={summary.emptyFields} />
              <Stat label="Required" value={summary.requiredFields} />
              <Stat label="Required empty" value={validation?.requiredEmpty.length ?? 0} highlight={(validation?.requiredEmpty.length ?? 0) > 0 ? "bad" : "good"} />
              <Stat label="Read-only" value={summary.readOnlyFields} />
              <Stat label="Pages with fields" value={summary.pagesWithFields} />
              <Stat label="Duplicates" value={validation?.duplicateNames.length ?? 0} highlight={(validation?.duplicateNames.length ?? 0) > 0 ? "bad" : undefined} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_FIELD_TYPES.filter((t) => summary.byType[t] > 0).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {FIELD_TYPE_LABELS[t]}: {summary.byType[t]}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {fields && fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Field list ({fields.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderedOutput} label={`Copy ${FORMAT_LABELS[opts.outputFormat]}`} />
                <Button onClick={handleDownload} className="gap-1.5" size="sm">
                  <Download className="h-3.5 w-3.5" /> Download .{FORMAT_EXTENSIONS[opts.outputFormat]}
                </Button>
                <CopyButton getText={() => schemaJson} label="Copy schema JSON" />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <div className="overflow-auto rounded border bg-background max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">#</th>
                    <th className="border-b px-2 py-1 text-left">Name</th>
                    <th className="border-b px-2 py-1 text-left">Type</th>
                    <th className="border-b px-2 py-1 text-left">Page</th>
                    <th className="border-b px-2 py-1 text-left">Value</th>
                    {opts.includeProperties && <th className="border-b px-2 py-1 text-left">Properties</th>}
                    <th className="border-b px-2 py-1 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => {
                    const label = labelMap.get(f.name) ?? f.name;
                    const isDuplicate = validation?.duplicateNames.includes(f.name) ?? false;
                    return (
                      <tr key={i} className={f.required && !f.filled ? "bg-amber-500/5" : ""}>
                        <td className="border-b px-2 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="border-b px-2 py-1 font-mono">
                          {label}
                          {label !== f.name && <span className="text-muted-foreground ml-1 text-[10px]">({f.name})</span>}
                        </td>
                        <td className="border-b px-2 py-1">{FIELD_TYPE_LABELS[f.type]}</td>
                        <td className="border-b px-2 py-1">{f.page || "—"}</td>
                        <td className="border-b px-2 py-1 font-mono">
                          {opts.includeValues
                            ? formatFieldValueByType(f)
                            : <span className="text-muted-foreground">(hidden)</span>}
                        </td>
                        {opts.includeProperties && (
                          <td className="border-b px-2 py-1 font-mono text-[10px]">
                            {f.maxLength > 0 && <span>maxLen={f.maxLength} </span>}
                            {f.multiline && <span>multiline </span>}
                            {f.password && <span>password </span>}
                            {f.combo && <span>combo </span>}
                            {f.multiSelect && <span>multi </span>}
                            {f.options.length > 0 && <span>opts={f.options.join("|")}</span>}
                            {!f.maxLength && !f.multiline && !f.password && !f.combo && !f.multiSelect && f.options.length === 0 && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="border-b px-2 py-1">
                          {f.required && <Badge variant="outline" className="text-[10px] mr-1">required</Badge>}
                          {f.readOnly && <Badge variant="outline" className="text-[10px] mr-1">read-only</Badge>}
                          {isDuplicate && <Badge variant="outline" className="text-[10px]">duplicate</Badge>}
                          {!f.required && !f.readOnly && !isDuplicate && <span className="text-muted-foreground text-[10px]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View {FORMAT_LABELS[opts.outputFormat]} output
              </summary>
              <pre className="mt-2 max-h-[280px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
                {renderedOutput || "(empty)"}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {fields && fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Form schema (for PDF Form Filler)
              </h3>
              <DownloadButton
                getText={() => schemaJson}
                filename={getOutputFilename("json", file?.name ?? "output")}
                mime={FORMAT_MIME["json"]}
                label="Download schema"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Reuse this JSON with the PDF Form Filler tool to populate the same fields with different values.
            </p>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}
              >Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.format}</Badge>
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.pageCount}p • {h.fieldCount}F
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Field extraction runs 100% locally — your PDF never leaves your device.
        All enumeration and rendering happen in your browser using pdf-lib&apos;s AcroForm API.
      </p>
    </div>
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
