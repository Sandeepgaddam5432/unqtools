"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  sheetToJson, sheetsToJson, groupByColumn, toJsonl, toJson,
  getStats, loadHistory, saveToHistory,
  type KeyNaming, type OutputFormat, type SheetData,
} from "./logic";
import { Upload, FileSpreadsheet } from "lucide-react";

// Reuse XLSX parsing from excel-to-csv-converter
import { convertXlsxToCsv, type SheetData as XlsxSheetData } from "../excel-to-csv-converter/logic";

export default function ExcelToJsonConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [keyNaming, setKeyNaming] = useState<KeyNaming>("original");
  const [format, setFormat] = useState<OutputFormat>("json");
  const [groupColumn, setGroupColumn] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const convert = useCallback(
    (ss: SheetData[], idx: number, naming: KeyNaming, fmt: OutputFormat, group: string, fname?: string) => {
      if (ss.length === 0) return;
      const sheet = ss[idx];
      let json: unknown;
      if (fmt === "jsonl") {
        const data = sheetToJson(sheet.rows, { keyNaming: naming });
        json = toJsonl(data);
      } else if (group) {
        const data = sheetToJson(sheet.rows, { keyNaming: naming });
        json = toJson(groupByColumn(data, group));
      } else if (ss.length > 1 && idx === -1) {
        json = toJson(sheetsToJson(ss, { keyNaming: naming }));
      } else {
        json = toJson(sheetToJson(sheet.rows, { keyNaming: naming }));
      }
      const result = String(json);
      setOutput(result);
      saveToHistory({
        filename: fname ?? file?.name ?? "unknown",
        sheetName: sheet.name,
        rowCount: sheet.rows.length - 1,
        convertedAt: new Date().toISOString(),
      });
    },
    [file],
  );

  const handleFile = useCallback(async (f: File) => {
    setWorking(true);
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      const result = await convertXlsxToCsv(
        { bytes: new Uint8Array(buf), fileName: f.name },
        ",",
        null, // convert all sheets
        true,
      );
      // Parse CSV output back to rows for JSON conversion
      const sheetData: SheetData[] = result.sheets.map((s) => {
        const rows = s.csv.split("\n").filter((r) => r).map((r) => {
          // Simple CSV split (handles basic quoting)
          const cells: string[] = [];
          let cur = "";
          let inQuote = false;
          for (let i = 0; i < r.length; i++) {
            const ch = r[i];
            if (ch === '"') { if (inQuote && r[i + 1] === '"') { cur += '"'; i++; } else { inQuote = !inQuote; } }
            else if (ch === "," && !inQuote) { cells.push(cur); cur = ""; }
            else { cur += ch; }
          }
          cells.push(cur);
          return cells;
        });
        return { name: s.sheetName, rows };
      });
      setSheets(sheetData);
      setFile(f);
      setSheetIndex(0);
      convert(sheetData, 0, "original", "json", "", f.name);
    } catch (e) {
      setError((e as Error).message || "Failed to parse XLSX");
    } finally {
      setWorking(false);
    }
  }, [convert]);

  const stats = output ? getStats(sheets, output, sheetIndex) : null;
  const headers = sheets[sheetIndex]?.rows[0] ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input type="file" accept=".xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} className="hidden" id="xlsx-json-input" />
          <button type="button" onClick={() => document.getElementById("xlsx-json-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop .xlsx file or click to browse</p>
          </button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {file && sheets.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sheet</Label>
                <select value={sheetIndex} onChange={(e) => { const idx = parseInt(e.target.value); setSheetIndex(idx); convert(sheets, idx, keyNaming, format, groupColumn); }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm cursor-pointer">
                  {sheets.map((s, i) => <option key={i} value={i}>{s.name} ({s.rows.length - 1} rows)</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Key naming</Label>
                <select value={keyNaming} onChange={(e) => { const v = e.target.value as KeyNaming; setKeyNaming(v); convert(sheets, sheetIndex, v, format, groupColumn); }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm cursor-pointer">
                  <option value="original">Original</option>
                  <option value="camelCase">camelCase</option>
                  <option value="snake_case">snake_case</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => { const v = e.target.value as OutputFormat; setFormat(v); convert(sheets, sheetIndex, keyNaming, v, groupColumn); }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm cursor-pointer">
                  <option value="json">JSON (pretty)</option>
                  <option value="jsonl">JSONL (lines)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Group by</Label>
                <select value={groupColumn} onChange={(e) => { const v = e.target.value; setGroupColumn(v); convert(sheets, sheetIndex, keyNaming, format, v); }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm cursor-pointer">
                  <option value="">None</option>
                  {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">JSON Output</Label>
              <div className="flex gap-1">
                <CopyButton getText={() => output} label="Copy" size="sm" />
                <DownloadButton getText={() => output} filename={`${file?.name?.replace(/\.xlsx$/, "") ?? "output"}.json`} label="Download" size="sm" />
              </div>
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all max-h-[500px]">{output}</pre>
            {stats && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px]">{stats.rowCount} rows</Badge>
                <Badge variant="outline" className="text-[10px]">{stats.columnCount} columns</Badge>
                <Badge variant="outline" className="text-[10px]">{stats.sheetCount} sheets</Badge>
                <Badge variant="outline" className="text-[10px]">{(stats.outputSize / 1024).toFixed(1)} KB output</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!file && !error && (
        <EmptyState title="Drop an XLSX file to convert" hint="First row becomes JSON keys. Supports multiple sheets, JSONL, and nested grouping." icon={<FileSpreadsheet className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all XLSX parsing is in-browser. Files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
