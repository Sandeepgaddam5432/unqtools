"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFName,
  PDFBool,
  PDFField,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, FormInput, History, BarChart3, Wand2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  EmptyState,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { formatBytes, downloadBytes } from "../_shared/download";
import {
  DEFAULT_OPTIONS,
  FIELD_TYPE_LABELS,
  parseFormData,
  parseFieldMapping,
  buildLabelMap,
  detectFieldType,
  formatFieldValue,
  displayFieldValue,
  validateForm,
  computeSummaryStats,
  fieldTypeDistribution,
  suggestAllLabels,
  serializeLabelMapping,
  renderTextReport,
  renderCsv,
  renderJson,
  buildNeedAppearancesFlag,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  getOutputFilename,
  type FormField,
  type ConvertOptions,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// pdf-lib form field extraction
// ---------------------------------------------------------------------------

/**
 * Read all AcroForm fields from a loaded pdf-lib document and convert them to
 * our plain FormField shape. Returns an empty array if the PDF has no form.
 */
function extractFormFields(doc: PDFDocument): FormField[] {
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
    let name = "";
    try {
      name = f.getName();
    } catch {
      name = "(unnamed)";
    }
    const type = detectFieldType(f.constructor.name);
    let value = "";
    let options: string[] = [];
    try {
      if (f instanceof PDFTextField) {
        value = f.getText() ?? "";
      } else if (f instanceof PDFCheckBox) {
        value = f.isChecked() ? "Yes" : "Off";
      } else if (f instanceof PDFRadioGroup) {
        options = f.getOptions();
        // pdf-lib doesn't expose a getSelected(); use the underlying acroField
        try {
          const selected = (f as unknown as { acroField: { getValue?: () => unknown } }).acroField?.getValue?.();
          if (selected && typeof (selected as { toString?: () => string }).toString === "function") {
            value = (selected as { toString: () => string }).toString().replace(/[\/()]/g, "");
          }
        } catch {
          // ignore
        }
      } else if (f instanceof PDFDropdown) {
        options = f.getOptions();
        // No public getter for selected; default to empty
      } else if (f instanceof PDFOptionList) {
        options = f.getOptions();
      }
    } catch {
      // ignore per-field errors
    }
    let required = false;
    let readOnly = false;
    try {
      required = f.isRequired();
    } catch {
      // ignore
    }
    try {
      readOnly = f.isReadOnly();
    } catch {
      // ignore
    }
    out.push({
      name,
      type,
      value,
      required,
      readOnly,
      options,
      filled: !!value && value !== "Off",
    });
  }
  return out;
}

/**
 * Apply a list of FieldValues to the loaded pdf-lib form.
 * Returns a list of (fieldName, error) pairs for fields that failed.
 */
function applyValuesToForm(
  doc: PDFDocument,
  values: { name: string; rawValue: string; values: string[] }[],
  fields: FormField[],
): { name: string; error: string }[] {
  let form;
  try {
    form = doc.getForm();
  } catch {
    return [{ name: "*", error: "Document has no AcroForm" }];
  }
  const errors: { name: string; error: string }[] = [];
  const fieldMap = new Map(fields.map((f) => [f.name, f]));

  for (const v of values) {
    const fieldInfo = fieldMap.get(v.name);
    if (!fieldInfo) {
      // Unknown field — silently skip (validateForm will report it)
      continue;
    }
    try {
      const pdfField = form.getField(v.name);
      const fmt = formatFieldValue(fieldInfo.type, v.rawValue, fieldInfo.options);
      if (fmt.error) {
        errors.push({ name: v.name, error: fmt.error });
        continue;
      }
      if (pdfField instanceof PDFTextField && fmt.text !== undefined) {
        pdfField.setText(fmt.text);
      } else if (pdfField instanceof PDFCheckBox && fmt.checked !== undefined) {
        if (fmt.checked) pdfField.check();
        else pdfField.uncheck();
      } else if (pdfField instanceof PDFRadioGroup && fmt.selected && fmt.selected.length > 0) {
        pdfField.select(fmt.selected[0]);
      } else if (pdfField instanceof PDFDropdown && fmt.selected) {
        if (fmt.selected.length > 0) {
          pdfField.select(fmt.selected.length === 1 ? fmt.selected[0] : fmt.selected);
        }
      } else if (pdfField instanceof PDFOptionList && fmt.selected) {
        if (fmt.selected.length > 0) {
          pdfField.select(fmt.selected.length === 1 ? fmt.selected[0] : fmt.selected);
        }
      } else {
        errors.push({ name: v.name, error: `Field type ${fieldInfo.type} not fillable` });
      }
    } catch (e) {
      errors.push({
        name: v.name,
        error: e instanceof Error ? e.message : "Failed to apply value",
      });
    }
  }
  return errors;
}

/** Set the NeedAppearances flag on the AcroForm. */
function setNeedAppearances(doc: PDFDocument, value: boolean): void {
  try {
    const form = doc.getForm();
    const acroForm = form.acroForm;
    if (!acroForm || !acroForm.dict) return;
    acroForm.dict.set(PDFName.of("NeedAppearances"), value ? PDFBool.True : PDFBool.False);
  } catch {
    // ignore
  }
}

/** Strip XFA data from the form (forces readers to use standard AcroForm). */
function stripXfa(doc: PDFDocument): boolean {
  try {
    const form = doc.getForm();
    if (form.hasXFA()) {
      form.deleteXFA();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfFormFiller() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [filledBytes, setFilledBytes] = useState<Uint8Array | null>(null);
  const [applyErrors, setApplyErrors] = useState<{ name: string; error: string }[]>([]);
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
      // Extract fields immediately so the user can see what's available
      const extracted = extractFormFields(doc);
      setFields(extracted);
      setFilledBytes(null);
      setApplyErrors([]);
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
    setFilledBytes(null);
    setApplyErrors([]);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  async function run() {
    if (!file || !fields) return;
    setWorking(true);
    setError("");
    setFilledBytes(null);
    setApplyErrors([]);
    try {
      const v = validateOptions(opts);
      if (!v.ok) {
        setError(v.error);
        setWorking(false);
        return;
      }
      const parsed = parseFormData(opts.formData);
      // Validate
      const validation = validateForm(fields, parsed);
      // Don't block on missing-required / unknown — just warn via applyErrors list
      const warnings: { name: string; error: string }[] = [];
      for (const m of validation.missingRequired) {
        warnings.push({ name: m, error: "Required field not filled" });
      }
      for (const u of validation.unknownFields) {
        warnings.push({ name: u, error: "Field does not exist in PDF" });
      }
      for (const t of validation.typeMismatches) {
        warnings.push({ name: t, error: "Type mismatch" });
      }

      // Load fresh doc and apply values
      const doc = await PDFDocument.load(file.bytes);
      // Strip XFA if present
      if (stripXfa(doc)) {
        toast.info("XFA data detected and stripped — using standard AcroForm fields.");
      }
      const applyErrs = applyValuesToForm(doc, parsed.values, fields);
      // Set NeedAppearances flag
      const flag = buildNeedAppearancesFlag(opts.preserveAppearance);
      if (flag) setNeedAppearances(doc, flag.value);
      // Optionally flatten
      if (opts.flattenForm) {
        try {
          doc.getForm().flatten({ updateFieldAppearances: true });
        } catch (e) {
          warnings.push({ name: "*", error: `Flatten failed: ${e instanceof Error ? e.message : "unknown"}` });
        }
      }
      const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      setFilledBytes(bytes);
      setApplyErrors([...warnings, ...applyErrs]);
      const filledCount = fields.filter((f) => f.filled).length + parsed.values.length;
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        fieldCount: fields.length,
        filledCount: Math.min(filledCount, fields.length),
        flattened: opts.flattenForm,
      });
      setHistory(loadHistory());
      const ok = applyErrs.length === 0;
      if (ok) {
        toast.success(`Filled ${parsed.values.length} field${parsed.values.length === 1 ? "" : "s"} • PDF ready to download.`);
      } else {
        toast.warning(`Filled with ${applyErrs.length} warning${applyErrs.length === 1 ? "" : "s"} — see below.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while filling the form.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => fields ? computeSummaryStats(fields) : null, [fields]);
  const distribution = useMemo(() => fields ? fieldTypeDistribution(fields) : [], [fields]);
  const labelMap = useMemo(() => {
    if (!fields) return new Map<string, string>();
    const parsed = parseFieldMapping(opts.fieldMapping);
    return buildLabelMap(parsed.mappings);
  }, [fields, opts.fieldMapping]);
  const validation = useMemo(() => {
    if (!fields) return null;
    const parsed = parseFormData(opts.formData);
    return validateForm(fields, parsed);
  }, [fields, opts.formData]);
  const renderedReport = useMemo(() => fields ? renderTextReport(fields, labelMap) : "", [fields, labelMap]);
  const renderedCsv = useMemo(() => fields ? renderCsv(fields) : "", [fields]);
  const renderedJson = useMemo(() => fields ? renderJson(fields, file?.name ?? "") : "", [fields, file]);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function autoSuggestLabels() {
    if (!fields) return;
    const suggestions = suggestAllLabels(fields);
    const text = serializeLabelMapping(suggestions);
    update("fieldMapping", text);
    toast.success("Auto-generated friendly labels for all fields.");
  }

  function handleDownload() {
    if (!filledBytes || !file) return;
    const filename = getOutputFilename(file.name, opts.flattenForm ? "flattened" : "filled");
    downloadBytes(filledBytes, filename, "application/pdf");
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
          <p className="text-sm font-medium">Drop a PDF with form fields here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reads AcroForm fields (text, checkbox, radio, dropdown, list) and fills them with your data.
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
          hint="This PDF doesn't have an AcroForm. It may be a flat PDF (no fillable fields) or an XFA-only form (LiveCycle Designer) which pdf-lib cannot fill."
          icon={<FormInput className="h-8 w-8" />}
        />
      )}

      {fields && fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pff-formdata">Form data (one field per line, format: field_name=value)</Label>
                <span className="text-xs text-muted-foreground">
                  {fields.length} field{fields.length === 1 ? "" : "s"} available
                </span>
              </div>
              <Textarea
                id="pff-formdata"
                value={opts.formData}
                onChange={(e) => update("formData", e.target.value)}
                placeholder={`# Example:\nfirst_name=Alice\nlast_name=Smith\nagree=Yes\ncolor=red|blue\n# ^ pipe-separated for multi-value`}
                className="font-mono text-xs min-h-[140px]"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="font-mono">#</code> for comments. Multi-value fields (radio, dropdown, list)
                accept <code className="font-mono">opt1|opt2</code>. Checkbox values: yes/no, true/false, 1/0, ✓.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pff-mapping">Field display labels (optional)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={autoSuggestLabels}
                  className="gap-1.5 h-7"
                >
                  <Wand2 className="h-3 w-3" /> Auto-suggest
                </Button>
              </div>
              <Textarea
                id="pff-mapping"
                value={opts.fieldMapping}
                onChange={(e) => update("fieldMapping", e.target.value)}
                placeholder={`# Optional: rename fields in the report for readability\nfirst_name=First Name\nlast_name=Last Name`}
                className="font-mono text-xs min-h-[80px]"
              />
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={opts.flattenForm}
                  onChange={(e) => update("flattenForm", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Flatten after filling (fields become static content — can&apos;t be edited)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={opts.preserveAppearance}
                  onChange={(e) => update("preserveAppearance", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Set NeedAppearances flag (readers regenerate field visuals)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || !fields || fields.length === 0} loading={working} label="Fill & Save" />
        <ClearButton onClick={reset} disabled={!file && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {validation && !validation.ok && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-300">Validation warnings</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
            {validation.missingRequired.map((m) => (
              <li key={`m-${m}`}>Required field <code className="font-mono">{m}</code> is not filled.</li>
            ))}
            {validation.unknownFields.map((u) => (
              <li key={`u-${u}`}>Field <code className="font-mono">{u}</code> is not in this PDF (will be skipped).</li>
            ))}
            {validation.typeMismatches.map((t, i) => (
              <li key={`t-${i}`}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {applyErrors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-300">
            {applyErrors.length} warning{applyErrors.length === 1 ? "" : "s"} during fill
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300 max-h-[160px] overflow-auto">
            {applyErrors.map((e, i) => (
              <li key={i}><code className="font-mono">{e.name}</code>: {e.error}</li>
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
              <Stat label="Required empty" value={summary.requiredEmpty} highlight={summary.requiredEmpty > 0 ? "bad" : "good"} />
              <Stat label="Read-only" value={fields?.filter((f) => f.readOnly).length ?? 0} />
            </div>
            {distribution.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {distribution.map((d) => (
                  <Badge key={d.type} variant="outline" className="text-[10px]">
                    {FIELD_TYPE_LABELS[d.type]}: {d.count} ({d.percent}%)
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {fields && fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FormInput className="h-4 w-4" /> Field list ({fields.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderedReport} label="Copy report" />
                <CopyButton getText={() => renderedCsv} label="Copy CSV" />
                <CopyButton getText={() => renderedJson} label="Copy JSON" />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <div className="overflow-auto rounded border bg-background max-h-[360px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Name</th>
                    <th className="border-b px-2 py-1 text-left">Type</th>
                    <th className="border-b px-2 py-1 text-left">Current value</th>
                    <th className="border-b px-2 py-1 text-left">Options</th>
                    <th className="border-b px-2 py-1 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={i} className={f.required && !f.filled ? "bg-amber-500/5" : ""}>
                      <td className="border-b px-2 py-1 font-mono">
                        {labelMap.get(f.name) ?? f.name}
                        <span className="text-muted-foreground ml-1 text-[10px]">({f.name})</span>
                      </td>
                      <td className="border-b px-2 py-1">{FIELD_TYPE_LABELS[f.type]}</td>
                      <td className="border-b px-2 py-1 font-mono">
                        {displayFieldValue(f.type, f.value) || <span className="text-muted-foreground">(empty)</span>}
                      </td>
                      <td className="border-b px-2 py-1 font-mono text-[10px]">
                        {f.options.length > 0 ? f.options.join(" | ") : "—"}
                      </td>
                      <td className="border-b px-2 py-1">
                        {f.required && <Badge variant="outline" className="text-[10px] mr-1">required</Badge>}
                        {f.readOnly && <Badge variant="outline" className="text-[10px]">read-only</Badge>}
                        {!f.required && !f.readOnly && <span className="text-muted-foreground text-[10px]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View plain-text report
              </summary>
              <pre className="mt-2 max-h-[200px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
                {renderedReport}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {filledBytes && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Filled PDF ready
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(filledBytes.length)}
                  {opts.flattenForm && " • flattened (no longer editable)"}
                  {opts.preserveAppearance && " • NeedAppearances set"}
                </p>
              </div>
              <Button onClick={handleDownload} className="gap-1.5" size="sm">
                <Download className="h-3.5 w-3.5" /> Download filled PDF
              </Button>
            </div>
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
                  {h.flattened && <Badge variant="outline" className="mr-2 text-[10px]">flattened</Badge>}
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.fieldCount}F • {h.filledCount} filled
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Form filling runs 100% locally —
        your PDF and form data never leave your device. The PDF is processed entirely in your browser
        using pdf-lib&apos;s AcroForm API.
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
