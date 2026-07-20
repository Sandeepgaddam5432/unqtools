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
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  DEFAULT_SCHEMA,
  GENERATOR_COUNT,
  generateBatch,
  exportJson,
  exportCsv,
  exportNdjson,
  exportSql,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parseSchema,
  serializeSchema,
  type FieldType,
  type FieldSchema,
  type Schema,
  type HistoryEntry,
} from "./logic";
import { Database, History, Wand2, Plus, Trash2, Sparkles } from "lucide-react";

type ExportFormat = "json" | "csv" | "ndjson" | "sql";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  ndjson: "NDJSON",
  sql: "SQL",
};

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  json: "json",
  csv: "csv",
  ndjson: "ndjson",
  sql: "sql",
};

const FORMAT_MIMES: Record<ExportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  ndjson: "application/x-ndjson",
  sql: "application/sql",
};

export default function FakeDataGenerator() {
  const [seed, setSeed] = useState("demo-seed");
  const [count, setCount] = useState(10);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [fields, setFields] = useState<FieldSchema[]>(DEFAULT_SCHEMA.fields);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("firstName");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seed) setSeed(p.seed);
      if (p.count) setCount(p.count);
      if (p.format) setFormat(p.format as ExportFormat);
      if (p.schema) {
        const s = parseSchema(p.schema);
        if (s && s.fields.length > 0) setFields(s.fields);
      }
      if (p.seed || p.schema) toast.info("Loaded from share link");
    }
  }, []);

  const schema: Schema = useMemo(() => ({ fields }), [fields]);

  const records = useMemo(
    () => generateBatch(schema, Math.min(count, 100), seed),
    [schema, count, seed],
  );
  const preview = useMemo(() => records.slice(0, 5), [records]);

  const output = useMemo(() => {
    const full = generateBatch(schema, count, seed);
    switch (format) {
      case "json": return exportJson(full);
      case "csv": return exportCsv(full);
      case "ndjson": return exportNdjson(full);
      case "sql": return exportSql(full, "fake_data");
      default: return exportJson(full);
    }
  }, [schema, count, seed, format]);

  const handleAddField = useCallback(() => {
    const name = newFieldName.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!name) {
      toast.error("Field name is required");
      return;
    }
    if (fields.some((f) => f.name === name)) {
      toast.error(`Field "${name}" already exists`);
      return;
    }
    setFields((prev) => [...prev, { name, type: newFieldType }]);
    setNewFieldName("");
    toast.success(`Added field "${name}"`);
  }, [newFieldName, newFieldType, fields]);

  const handleRemoveField = useCallback((name: string) => {
    setFields((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleRandomSeed = useCallback(() => {
    const s = Math.random().toString(36).slice(2, 10);
    setSeed(s);
    toast.success(`New seed: ${s}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      seed,
      count,
      fieldCount: fields.length,
      format,
    });
    setHistory(loadHistory());
  }, [seed, count, fields.length, format]);

  const handleClear = useCallback(() => {
    setSeed("");
    setCount(10);
    setFields(DEFAULT_SCHEMA.fields);
    setFormat("json");
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleCopyOrDownload = useCallback(() => {
    handleSaveHistory();
  }, [handleSaveHistory]);

  const shareUrl = useMemo(
    () => buildShareUrl(seed, count, format, serializeSchema({ fields })),
    [seed, count, format, fields],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fdg-seed" className="text-xs">Seed (deterministic)</Label>
              <div className="flex gap-1">
                <Input
                  id="fdg-seed"
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
              <Label htmlFor="fdg-count" className="text-xs">Row count (max 100k)</Label>
              <Input
                id="fdg-count"
                type="number"
                min={1}
                max={100000}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fdg-format" className="text-xs">Export format</Label>
              <select
                id="fdg-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                  <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Schema ({fields.length} fields)
            </h3>
            <Badge variant="secondary" className="text-[10px]">{GENERATOR_COUNT} field types</Badge>
          </div>
          <div className="space-y-1">
            {fields.map((f) => (
              <div key={f.name} className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs">
                <span className="font-mono font-medium text-foreground flex-1">{f.name}</span>
                <Badge variant="outline" className="text-[10px]">{FIELD_TYPE_LABELS[f.type]}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveField(f.name)}
                  title={`Remove ${f.name}`}
                  className="h-7 w-7"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fdg-new-name" className="text-[11px] text-muted-foreground">New field name</Label>
              <Input
                id="fdg-new-name"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="user_id"
                className="h-8 w-40 text-xs font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleAddField()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fdg-new-type" className="text-[11px] text-muted-foreground">Type</Label>
              <select
                id="fdg-new-type"
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={handleAddField} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add field
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Live preview (5 of {Math.min(count, 100)} rows)
              </h3>
              <div className="overflow-auto max-h-[300px] rounded border bg-muted/30">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {fields.map((f) => (
                        <th key={f.name} className="text-left px-2 py-1 font-mono font-semibold">{f.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((rec, i) => (
                      <tr key={i} className="border-t">
                        {fields.map((f) => (
                          <td key={f.name} className="px-2 py-1 font-mono text-muted-foreground align-top">
                            {rec[f.name] === null ? <span className="italic opacity-50">null</span> : String(rec[f.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Output ({count} rows · {FORMAT_LABELS[format]})
                </h3>
                <Badge variant="outline" className="text-[10px]">{output.length.toLocaleString()} bytes</Badge>
              </div>
              <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                {output}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleCopyOrDownload(); return output; }} label="Copy output" />
                <DownloadButton
                  getText={() => { handleCopyOrDownload(); return output; }}
                  filename={`fake-data.${FORMAT_EXTENSIONS[format]}`}
                  mime={FORMAT_MIMES[format]}
                  label={`Download .${FORMAT_EXTENSIONS[format]}`}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {preview.length === 0 && (
        <EmptyState
          title="Add fields to your schema to generate data"
          hint="Pick a field type from the dropdown, name it, and click Add. Then set a seed and row count to generate."
          icon={<Database className="h-8 w-8" />}
        />
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
                  <Badge variant="outline" className="text-[10px]">{h.count} rows</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.fieldCount} fields</Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">{h.format}</Badge>
                  <span className="font-mono text-muted-foreground">seed: {h.seed}</span>
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
            <strong className="text-foreground">Privacy:</strong> All generation runs locally via a deterministic mulberry32 PRNG. Schema and seed never leave your device. History is stored in localStorage (max 20).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
