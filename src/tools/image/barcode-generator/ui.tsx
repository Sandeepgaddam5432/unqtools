"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Barcode,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  Grid3x3,
  Info,
  ListOrdered,
  Plus,
  Printer,
  ScanLine,
  Settings2,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  BarcodeFormat,
  BarcodeOptions,
  BarcodeResult,
  BulkBarcodeRow,
  LabelSheetSpec,
  FORMAT_REGISTRY,
  FORMATS_BY_GROUP,
  BUILTIN_LABEL_SHEETS,
  FormatGroup,
  validateInput,
  computeChecksum,
  computeQuietZone,
  checkColorContrast,
  buildGs1String,
  parseBulkCsv,
  generateSequence,
  csvManifestExport,
  jsonManifestExport,
  renderToCanvas,
  renderToSvg,
  renderToPngBlob,
  renderToPdf,
  blobToDataUrl,
  buildBarcodeFilename,
  pixelsToMm,
  analyzeCode128Subsets,
} from "./logic";

/* ------------------------------------------------------------------ */
/* Local-storage helpers (extras: label template library)              */
/* ------------------------------------------------------------------ */

const LS_KEY = "unqtools:barcode-generator:label-templates";
const SCAN_HISTORY_KEY = "unqtools:barcode-generator:scan-history";
const MAX_HISTORY = 10;

function loadCustomSheets(): LabelSheetSpec[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LabelSheetSpec[]) : [];
  } catch {
    return [];
  }
}

function saveCustomSheet(spec: LabelSheetSpec) {
  const existing = loadCustomSheets();
  const without = existing.filter((s) => s.id !== spec.id);
  without.push(spec);
  window.localStorage.setItem(LS_KEY, JSON.stringify(without));
}

function deleteCustomSheet(id: string) {
  const existing = loadCustomSheets();
  window.localStorage.setItem(
    LS_KEY,
    JSON.stringify(existing.filter((s) => s.id !== id)),
  );
}

interface ScanHistoryEntry {
  value: string;
  format: string;
  timestamp: number;
  decoded: boolean;
  decodedText?: string;
}

function loadScanHistory(): ScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCAN_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScanHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveScanHistory(entries: ScanHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

type Mode = "single" | "bulk" | "sequence";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}

function TabButton({ active, onClick, label, icon }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted hover:bg-muted/70 text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface GroupTabProps {
  group: FormatGroup;
  active: boolean;
  onClick: () => void;
}

function GroupTab({ group, active, onClick }: GroupTabProps) {
  const labels: Record<FormatGroup, string> = {
    retail: "Retail",
    logistics: "Logistics",
    generic: "Generic",
    "2d": "2D Bonus",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted hover:bg-muted/70 text-foreground"
      }`}
    >
      {labels[group]}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cheat-sheet tooltip                                                 */
/* ------------------------------------------------------------------ */

function CheatSheet({ format }: { format: BarcodeFormat }) {
  const [open, setOpen] = useState(false);
  const meta = FORMAT_REGISTRY[format];
  if (!meta) return null;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Cheat sheet for ${meta.label}`}
        aria-expanded={open}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${meta.label} cheat sheet`}
          className="absolute z-20 mt-1 w-72 rounded-md border border-border bg-popover p-3 text-xs shadow-md"
        >
          <p className="font-semibold text-foreground">{meta.label}</p>
          <p className="mt-1 text-muted-foreground">{meta.description}</p>
          <p className="mt-2">
            <span className="font-medium">Best for:</span>{" "}
            <span className="text-muted-foreground">{meta.bestFor}</span>
          </p>
          <p className="mt-2">
            <span className="font-medium">Sample:</span>{" "}
            <code className="rounded bg-muted px-1 py-0.5">{meta.sample}</code>
          </p>
          <p className="mt-2">
            <span className="font-medium">Length:</span>{" "}
            <span className="text-muted-foreground">
              {typeof meta.length === "number"
                ? `${meta.length} data digits (+1 check)`
                : "variable"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsible panel                                                   */
/* ------------------------------------------------------------------ */

function Collapsible({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {open && <div className="mt-3">{children}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* GS1 helper panel                                                    */
/* ------------------------------------------------------------------ */

interface Gs1AiRow {
  ai: string;
  value: string;
}

function Gs1HelperPanel({
  onApply,
}: {
  onApply: (built: string) => void;
}) {
  const [rows, setRows] = useState<Gs1AiRow[]>([
    { ai: "01", value: "15412345678905" },
    { ai: "17", value: "251231" },
  ]);

  const built = useMemo(() => buildGs1String(rows), [rows]);

  const update = (i: number, patch: Partial<Gs1AiRow>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const addRow = () => setRows((r) => [...r, { ai: "", value: "" }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Build a GS1-128 string with application identifiers. Common AIs:
        <strong> (01)</strong> GTIN · <strong>(17)</strong> Expiry YYMMDD · <strong>(10)</strong> Batch · <strong>(21)</strong> Serial · <strong>(30)</strong> Count.
      </p>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            <Input
              aria-label={`AI ${i + 1}`}
              value={row.ai}
              onChange={(e) => update(i, { ai: e.target.value })}
              placeholder="01"
              className="w-16 font-mono text-xs"
            />
            <Input
              aria-label={`Value ${i + 1}`}
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="15412345678905"
              className="flex-1 font-mono text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRow(i)}
              aria-label={`Remove AI row ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> Add AI
        </Button>
        <code className="flex-1 min-w-[200px] rounded bg-muted px-2 py-1 text-xs font-mono">
          {built || "(empty)"}
        </code>
        <Button size="sm" onClick={() => onApply(built)}>
          Apply
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sequence generator panel                                            */
/* ------------------------------------------------------------------ */

function SequencePanel({
  onGenerate,
}: {
  onGenerate: (rows: BulkBarcodeRow[]) => void;
}) {
  const [seqFormat, setSeqFormat] = useState<BarcodeFormat>("ean13");
  const [start, setStart] = useState("400638133393");
  const [step, setStep] = useState("1");
  const [count, setCount] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);
    try {
      const values = generateSequence(seqFormat, start, Number(step), Number(count));
      onGenerate(values.map((v) => ({ format: seqFormat, value: v })));
      toast.success(`Generated ${values.length} barcode values`);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [seqFormat, start, step, count, onGenerate]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Auto-batch EAN-13 / UPC-A / ITF-14 from a start value, step and count. Useful for product runs.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Format</Label>
          <select
            aria-label="Sequence format"
            value={seqFormat}
            onChange={(e) => setSeqFormat(e.target.value as BarcodeFormat)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="ean13">EAN-13</option>
            <option value="ean8">EAN-8</option>
            <option value="upca">UPC-A</option>
            <option value="itf14">ITF-14</option>
            <option value="code128">Code 128</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Start value</Label>
          <Input
            aria-label="Start value"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Step</Label>
          <Input
            type="number"
            min={1}
            aria-label="Step"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Count</Label>
          <Input
            type="number"
            min={1}
            max={100000}
            aria-label="Count"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}
      <Button size="sm" onClick={generate}>
        <ListOrdered className="h-3.5 w-3.5" /> Add sequence to bulk list
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Print preview modal                                                 */
/* ------------------------------------------------------------------ */

function PrintPreviewModal({
  spec,
  barcodes,
  onClose,
}: {
  spec: LabelSheetSpec;
  barcodes: BulkBarcodeRow[];
  onClose: () => void;
}) {
  const cells = spec.columns * spec.rows;
  const visible = barcodes.slice(0, cells);
  return (
    <div
      role="dialog"
      aria-label="Print preview"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Print preview — {spec.name}</p>
            <p className="text-xs text-muted-foreground">
              {spec.paper} · {spec.columns}×{spec.rows} = {cells} labels · {barcodes.length} barcodes
              {barcodes.length > cells ? ` (only first ${cells} shown per page)` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="mx-auto bg-white shadow-inner"
          style={{
            width: `${(spec.paperWidthMm / spec.paperHeightMm) * 400}px`,
            height: `400px`,
            padding: `${(spec.marginMm.top / spec.paperHeightMm) * 400}px ${
              (spec.marginMm.right / spec.paperWidthMm) * ((spec.paperWidthMm / spec.paperHeightMm) * 400)
            }px ${(spec.marginMm.bottom / spec.paperHeightMm) * 400}px ${
              (spec.marginMm.left / spec.paperWidthMm) * ((spec.paperWidthMm / spec.paperHeightMm) * 400)
            }px`,
            display: "grid",
            gridTemplateColumns: `repeat(${spec.columns}, 1fr)`,
            gridTemplateRows: `repeat(${spec.rows}, 1fr)`,
            gap: `${(spec.gapMm.vertical / spec.paperHeightMm) * 400}px ${(spec.gapMm.horizontal / spec.paperWidthMm) * ((spec.paperWidthMm / spec.paperHeightMm) * 400)}px`,
          }}
        >
          {Array.from({ length: cells }).map((_, i) => (
            <div
              key={i}
              className="border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-500"
            >
              {visible[i] ? visible[i]!.value.slice(0, 12) : i + 1}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: choose &quot;Export PDF&quot; on the bulk panel to download the print-ready file with crop marks.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Label template editor                                               */
/* ------------------------------------------------------------------ */

function LabelTemplateEditor({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const [name, setName] = useState("My Custom Template");
  const [paper, setPaper] = useState<"A4" | "Letter" | "Legal">("A4");
  const [columns, setColumns] = useState("3");
  const [rows, setRows] = useState("8");
  const [labelW, setLabelW] = useState("70");
  const [labelH, setLabelH] = useState("35");
  const [mt, setMt] = useState("10");
  const [ml, setMl] = useState("10");

  const paperDims = {
    A4: { w: 210, h: 297 },
    Letter: { w: 215.9, h: 279.4 },
    Legal: { w: 215.9, h: 355.6 },
  };

  const save = () => {
    const dims = paperDims[paper];
    const spec: LabelSheetSpec = {
      id: `custom-${Date.now()}`,
      name,
      paper,
      paperWidthMm: dims.w,
      paperHeightMm: dims.h,
      marginMm: { top: Number(mt), bottom: Number(mt), left: Number(ml), right: Number(ml) },
      columns: Number(columns),
      rows: Number(rows),
      labelWidthMm: Number(labelW),
      labelHeightMm: Number(labelH),
      gapMm: { horizontal: 2, vertical: 0 },
      cropMarks: false,
    };
    saveCustomSheet(spec);
    toast.success(`Saved template "${name}"`);
    onSaved();
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Save a custom label sheet spec to localStorage (extra #4). Templates are kept between sessions on this device only.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Template name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Paper</Label>
          <select
            aria-label="Paper size"
            value={paper}
            onChange={(e) => setPaper(e.target.value as "A4" | "Letter" | "Legal")}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="A4">A4 (210×297)</option>
            <option value="Letter">Letter (216×279)</option>
            <option value="Legal">Legal (216×356)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Cols</Label>
          <Input type="number" value={columns} onChange={(e) => setColumns(e.target.value)} className="text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Rows</Label>
          <Input type="number" value={rows} onChange={(e) => setRows(e.target.value)} className="text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Label W (mm)</Label>
          <Input type="number" value={labelW} onChange={(e) => setLabelW(e.target.value)} className="text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Label H (mm)</Label>
          <Input type="number" value={labelH} onChange={(e) => setLabelH(e.target.value)} className="text-xs" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Margin top (mm)</Label>
          <Input type="number" value={mt} onChange={(e) => setMt(e.target.value)} className="text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Margin left (mm)</Label>
          <Input type="number" value={ml} onChange={(e) => setMl(e.target.value)} className="text-xs" />
        </div>
      </div>
      <Button size="sm" onClick={save}>
        <Plus className="h-3.5 w-3.5" /> Save template
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scan test panel                                                     */
/* ------------------------------------------------------------------ */

function ScanTestPanel({
  currentValue,
  currentFormat,
  history,
  setHistory,
}: {
  currentValue: string;
  currentFormat: BarcodeFormat;
  history: ScanHistoryEntry[];
  setHistory: (h: ScanHistoryEntry[]) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const startScan = useCallback(async () => {
    setResult(null);
    setScanning(true);
    try {
      const zxingBrowser = await import("@zxing/browser");
      const codeReader = new zxingBrowser.BrowserMultiFormatReader();
      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready");
      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        video,
        (result, err) => {
          if (result) {
            const decodedText = result.getText();
            const matches = decodedText.replace(/\s/g, "") === currentValue.replace(/\s/g, "");
            const entry: ScanHistoryEntry = {
              value: currentValue,
              format: currentFormat,
              timestamp: Date.now(),
              decoded: true,
              decodedText,
            };
            const newHistory = [entry, ...history].slice(0, MAX_HISTORY);
            setHistory(newHistory);
            saveScanHistory(newHistory);
            setResult(`Decoded: "${decodedText}" — ${matches ? "matches your barcode" : "different value"}`);
            controls.stop();
            setScanning(false);
          }
        },
      );
      stopRef.current = () => controls.stop();
    } catch (e) {
      setResult(`Scan failed: ${(e as Error).message}. Camera requires HTTPS + permission.`);
      setScanning(false);
    }
  }, [currentValue, currentFormat, history, setHistory]);

  const stopScan = useCallback(() => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Decode the on-screen or printed barcode with your device camera (extra #10). Uses <code>@zxing/browser</code> — frames stay on your device. Requires HTTPS + camera permission.
      </p>
      <div className="flex flex-wrap gap-2">
        {!scanning ? (
          <Button size="sm" onClick={startScan} disabled={!currentValue}>
            <Camera className="h-3.5 w-3.5" /> Start scan-test
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stopScan}>
            <X className="h-3.5 w-3.5" /> Stop
          </Button>
        )}
      </div>
      <div className="aspect-video max-w-md overflow-hidden rounded-md border bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Camera preview" />
      </div>
      {result && (
        <p className="text-xs">
          <Badge variant={result.startsWith("Decoded") ? "default" : "destructive"} className="mr-2">
            {result.startsWith("Decoded") ? "OK" : "ERR"}
          </Badge>
          {result}
        </p>
      )}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Scan-test history (last {history.length}):</p>
          <ul className="space-y-1 text-xs">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1">
                <Badge variant={h.decoded ? "default" : "destructive"} className="text-[10px]">
                  {h.decoded ? "OK" : "FAIL"}
                </Badge>
                <code className="flex-1 truncate font-mono">{h.value}</code>
                <span className="text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setHistory([]);
              saveScanHistory([]);
            }}
          >
            <Trash2 className="h-3 w-3" /> Clear history
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function BarcodeGenerator() {
  const [mode, setMode] = useState<Mode>("single");
  const [group, setGroup] = useState<FormatGroup>("retail");
  const [format, setFormat] = useState<BarcodeFormat>("ean13");
  const [value, setValue] = useState("400638133393");
  const [scale, setScale] = useState(2);
  const [height, setHeight] = useState(10);
  const [paddingX, setPaddingX] = useState(10);
  const [paddingY, setPaddingY] = useState(5);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [showText, setShowText] = useState(true);
  const [textSize, setTextSize] = useState(9);
  const [textPos, setTextPos] = useState<"below" | "above" | "center">("below");
  const [dpi, setDpi] = useState(300);
  const [code128Subset, setCode128Subset] = useState<"A" | "B" | "C" | "auto">("auto");

  const [bulkText, setBulkText] = useState("ean13,400638133393\nean13,400638133394\ncode128,ABC-1234");
  const [bulkRows, setBulkRows] = useState<BulkBarcodeRow[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BarcodeResult[]>([]);

  const [labelSpec, setLabelSpec] = useState<LabelSheetSpec>(BUILTIN_LABEL_SHEETS[0]!);
  const [customSheets, setCustomSheets] = useState<LabelSheetSpec[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Load custom sheets + scan history on mount
  useEffect(() => {
    setCustomSheets(loadCustomSheets());
    setScanHistory(loadScanHistory());
  }, []);

  const refreshCustomSheets = useCallback(() => {
    setCustomSheets(loadCustomSheets());
  }, []);

  const allSheets = useMemo(() => [...BUILTIN_LABEL_SHEETS, ...customSheets], [customSheets]);

  // Live validity check
  const validation = useMemo(() => validateInput(format, value), [format, value]);
  const contrast = useMemo(
    () => checkColorContrast(fg, transparent ? "transparent" : bg),
    [fg, bg, transparent],
  );
  const quietZone = useMemo(() => computeQuietZone(0.33, format), [format]);
  const code128Segs = useMemo(
    () => (format === "code128" ? analyzeCode128Subsets(value) : []),
    [format, value],
  );
  const checkDigitInfo = useMemo(() => {
    if (!validation.ok) return null;
    const cleaned = validation.output.cleaned;
    if (["ean13", "ean8", "upca", "upce", "itf14", "msi"].includes(format)) {
      const check = cleaned.slice(-1);
      return `Check digit: ${check}`;
    }
    return null;
  }, [validation, format]);

  const options: BarcodeOptions = useMemo(
    () => ({
      scale,
      height,
      paddingX,
      paddingY,
      foreground: fg,
      background: transparent ? "transparent" : bg,
      showText,
      textSize,
      textYAlign: textPos,
      code128Subset,
      dpi,
    }),
    [scale, height, paddingX, paddingY, fg, bg, transparent, showText, textSize, textPos, code128Subset, dpi],
  );

  // Live preview render
  useEffect(() => {
    let cancelled = false;
    setPreviewError(null);
    if (!validation.ok) {
      setPreviewUrl(null);
      setPreviewError(validation.error);
      return;
    }
    (async () => {
      const result = await renderToCanvas(format, value, options);
      if (cancelled) return;
      if (!result.ok) {
        setPreviewUrl(null);
        setPreviewError(result.error);
        return;
      }
      const canvas = result.output;
      const url = canvas.toDataURL("image/png");
      if (!cancelled) {
        setPreviewUrl(url);
        setPreviewError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, value, options, validation]);

  /* ----- Single-mode exports ----- */

  const downloadPng = useCallback(async () => {
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setBusy(true);
    const blob = await renderToPngBlob(format, value, options);
    setBusy(false);
    if (!blob.ok) {
      toast.error(blob.error);
      return;
    }
    const url = URL.createObjectURL(blob.output);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildBarcodeFilename(format, value, "png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded PNG");
  }, [validation, format, value, options]);

  const downloadSvg = useCallback(async () => {
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setBusy(true);
    const svg = await renderToSvg(format, value, options);
    setBusy(false);
    if (!svg.ok) {
      toast.error(svg.error);
      return;
    }
    const blob = new Blob([svg.output], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildBarcodeFilename(format, value, "svg");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded SVG");
  }, [validation, format, value, options]);

  const copyDataUri = useCallback(async () => {
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setBusy(true);
    const blob = await renderToPngBlob(format, value, options);
    setBusy(false);
    if (!blob.ok) {
      toast.error(blob.error);
      return;
    }
    const dataUrl = await blobToDataUrl(blob.output);
    await navigator.clipboard.writeText(`<img src="${dataUrl}" alt="barcode">`);
    toast.success("Copied <img> tag with data URI to clipboard");
  }, [validation, format, value, options]);

  const handleEnter = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        downloadPng();
      }
    },
    [downloadPng],
  );

  /* ----- Bulk mode ----- */

  const parseBulk = useCallback(() => {
    setBulkError(null);
    const parsed = parseBulkCsv(bulkText);
    if (!parsed.ok) {
      setBulkError(parsed.error);
      setBulkRows([]);
      return;
    }
    setBulkRows(parsed.output);
    toast.success(`Parsed ${parsed.output.length} rows`);
  }, [bulkText]);

  const onBulkFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkText(String(reader.result ?? ""));
    reader.readAsText(file);
  }, []);

  const processBulk = useCallback(async () => {
    if (bulkRows.length === 0) {
      toast.error("No rows to process — parse the CSV first");
      return;
    }
    setBulkBusy(true);
    setResults([]);
    const out: BarcodeResult[] = [];
    const chunkSize = 10;
    const jszip = await import("jszip");
    const zip = new jszip.default();
    for (let i = 0; i < bulkRows.length; i += chunkSize) {
      const chunk = bulkRows.slice(i, i + chunkSize);
      // Yield to the UI thread between chunks so large batches stay responsive.
      await new Promise((r) => setTimeout(r, 0));
      for (const row of chunk) {
        const png = await renderToPngBlob(row.format, row.value, options);
        const validation = validateInput(row.format, row.value);
        if (!png.ok || !validation.ok) {
          out.push({
            format: row.format,
            value: row.value,
            checksum: "",
            widthPx: 0,
            heightPx: 0,
            widthMm: 0,
            heightMm: 0,
            filename: buildBarcodeFilename(row.format, row.value, "png"),
          });
          continue;
        }
        const dataUrl = await blobToDataUrl(png.output);
        const safeName = buildBarcodeFilename(row.format, row.value, "png");
        zip.file(safeName, png.output);
        out.push({
          format: row.format,
          value: row.value,
          checksum: validation.output.cleaned.slice(-1) || computeChecksum(row.format, row.value),
          widthPx: 200 * scale,
          heightPx: 50 * scale,
          widthMm: pixelsToMm(200 * scale, dpi),
          heightMm: pixelsToMm(50 * scale, dpi),
          filename: safeName,
          dataUrl,
        });
      }
    }
    setResults(out);
    // Build ZIP of PNGs.
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barcodes-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBulkBusy(false);
    toast.success(`Generated ${out.length} barcodes + ZIP`);
  }, [bulkRows, options, scale, dpi]);

  const downloadPdf = useCallback(async () => {
    if (bulkRows.length === 0) {
      toast.error("Parse the CSV first");
      return;
    }
    setBulkBusy(true);
    const pdf = await renderToPdf(bulkRows, labelSpec);
    setBulkBusy(false);
    if (!pdf.ok) {
      toast.error(pdf.error);
      return;
    }
    const url = URL.createObjectURL(pdf.output);
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-sheet-${labelSpec.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded label sheet PDF (${labelSpec.name})`);
  }, [bulkRows, labelSpec]);

  const downloadManifest = useCallback(
    (kind: "csv" | "json") => {
      if (results.length === 0) {
        toast.error("Generate barcodes first");
        return;
      }
      const text = kind === "csv" ? csvManifestExport(results) : jsonManifestExport(results);
      const blob = new Blob([text], { type: kind === "csv" ? "text/csv" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barcode-manifest.${kind}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${kind.toUpperCase()} manifest`);
    },
    [results],
  );

  /* ----- Format / group switching with sample data ----- */

  const switchFormat = useCallback((f: BarcodeFormat) => {
    const meta = FORMAT_REGISTRY[f];
    setFormat(f);
    setValue(meta?.sample ?? "");
  }, []);

  /* ----- Render ----- */

  const groupFormats = FORMATS_BY_GROUP[group];

  return (
    <div className="space-y-4" onKeyDown={handleEnter}>
      {/* Mode tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Mode">
            <TabButton
              active={mode === "single"}
              onClick={() => setMode("single")}
              label="Single"
              icon={<Barcode className="h-4 w-4" />}
            />
            <TabButton
              active={mode === "bulk"}
              onClick={() => setMode("bulk")}
              label="Bulk CSV"
              icon={<Grid3x3 className="h-4 w-4" />}
            />
            <TabButton
              active={mode === "sequence"}
              onClick={() => setMode("sequence")}
              label="Sequence"
              icon={<ListOrdered className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Format picker */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["retail", "logistics", "generic", "2d"] as FormatGroup[]).map((g) => (
              <GroupTab key={g} group={g} active={group === g} onClick={() => setGroup(g)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Barcode format">
            {groupFormats.map((f) => {
              const meta = FORMAT_REGISTRY[f];
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={format === f}
                  onClick={() => switchFormat(f)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    format === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {meta?.label}
                  <CheatSheet format={f} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {mode === "single" && (
        <>
          {/* Input + validity */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="bc-value" className="text-xs text-muted-foreground">
                  Value
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bc-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={FORMAT_REGISTRY[format]?.sample}
                    className="font-mono"
                    aria-invalid={!validation.ok}
                    aria-describedby="bc-validity"
                  />
                  <Badge
                    id="bc-validity"
                    variant={validation.ok ? "default" : "destructive"}
                    className="whitespace-nowrap"
                  >
                    {validation.ok ? (
                      <>
                        <Check className="h-3 w-3 mr-1" /> Valid
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3 mr-1" /> Invalid
                      </>
                    )}
                  </Badge>
                </div>
                {validation.ok ? (
                  <p className="text-xs text-muted-foreground">
                    {checkDigitInfo && <span>{checkDigitInfo} · </span>}
                    Cleaned: <code className="font-mono">{validation.output.cleaned}</code>
                  </p>
                ) : (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {validation.error}
                  </p>
                )}
                {format === "code128" && code128Segs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Code128 auto-subsets:{" "}
                    {code128Segs.map((s, i) => (
                      <code key={i} className="font-mono mr-1">
                        {s.subset}({s.chars.length})
                      </code>
                    ))}
                  </p>
                )}
              </div>

              {/* Options panel */}
              <Collapsible title="Options" icon={<Settings2 className="h-4 w-4" />} defaultOpen>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Bar scale (X): {scale}×</Label>
                    <Slider
                      aria-label="Bar scale"
                      value={[scale]}
                      onValueChange={(v) => setScale(v[0]!)}
                      min={1}
                      max={8}
                      step={1}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Height (mm): {height}</Label>
                    <Slider
                      aria-label="Bar height"
                      value={[height]}
                      onValueChange={(v) => setHeight(v[0]!)}
                      min={5}
                      max={50}
                      step={1}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Padding X: {paddingX}px</Label>
                    <Slider
                      aria-label="Padding X"
                      value={[paddingX]}
                      onValueChange={(v) => setPaddingX(v[0]!)}
                      min={0}
                      max={40}
                      step={1}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Padding Y: {paddingY}px</Label>
                    <Slider
                      aria-label="Padding Y"
                      value={[paddingY]}
                      onValueChange={(v) => setPaddingY(v[0]!)}
                      min={0}
                      max={40}
                      step={1}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Text size: {textSize}pt</Label>
                    <Slider
                      aria-label="Text size"
                      value={[textSize]}
                      onValueChange={(v) => setTextSize(v[0]!)}
                      min={6}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">PNG DPI: {dpi}</Label>
                    <select
                      aria-label="PNG DPI"
                      value={dpi}
                      onChange={(e) => setDpi(Number(e.target.value))}
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value={96}>96 (screen)</option>
                      <option value={150}>150 (draft print)</option>
                      <option value={300}>300 (standard print)</option>
                      <option value={600}>600 (high-quality print)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Foreground</Label>
                    <input
                      type="color"
                      aria-label="Foreground color"
                      value={fg}
                      onChange={(e) => setFg(e.target.value)}
                      className="h-9 w-full rounded-md border cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Background</Label>
                    <input
                      type="color"
                      aria-label="Background color"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      disabled={transparent}
                      className="h-9 w-full rounded-md border cursor-pointer disabled:opacity-40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Text position</Label>
                    <select
                      aria-label="Text position"
                      value={textPos}
                      onChange={(e) => setTextPos(e.target.value as "below" | "above" | "center")}
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="below">Below bars</option>
                      <option value="above">Above bars</option>
                      <option value="center">Centered</option>
                    </select>
                  </div>
                  {format === "code128" && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Code128 subset</Label>
                      <select
                        aria-label="Code 128 subset"
                        value={code128Subset}
                        onChange={(e) => setCode128Subset(e.target.value as "A" | "B" | "C" | "auto")}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="auto">Auto (A/B/C)</option>
                        <option value="A">A (control chars)</option>
                        <option value="B">B (printable ASCII)</option>
                        <option value="C">C (digit pairs)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={showText} onCheckedChange={setShowText} id="bc-show-text" />
                    <span>Show human-readable text</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={transparent} onCheckedChange={setTransparent} id="bc-transparent" />
                    <span>Transparent background</span>
                  </label>
                </div>
                {/* Contrast warning (extra #7) */}
                <div className="mt-3 rounded-md border border-border p-2 text-xs">
                  <p>
                    <span className="font-medium">Scanner contrast: </span>
                    <Badge variant={contrast.passes ? "default" : "destructive"} className="ml-1">
                      {contrast.passes ? "OK" : "LOW"}
                    </Badge>
                    <span className="ml-2 text-muted-foreground">
                      Δ {contrast.delta.toFixed(2)} · {contrast.reason}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Quiet-zone recommendation: ≥ {quietZone.toFixed(2)} mm each side at X=0.33mm.
                  </p>
                </div>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Live preview</p>
                {previewUrl && (
                  <p className="text-xs text-muted-foreground">
                    {scale * 200}px × {scale * 50}px · {pixelsToMm(scale * 200, dpi)}mm × {pixelsToMm(scale * 50, dpi)}mm @ {dpi} DPI
                  </p>
                )}
              </div>
              <div
                ref={canvasContainerRef}
                className="rounded-md border border-dashed border-border p-4 min-h-[120px] flex items-center justify-center bg-[repeating-conic-gradient(#f5f5f5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]"
                aria-live="polite"
              >
                {previewError ? (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {previewError}
                  </p>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Barcode preview for ${value}`}
                    className="max-w-full h-auto max-h-[280px]"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading preview…</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={downloadPng} disabled={busy || !validation.ok}>
                  <Download className="h-3.5 w-3.5" /> PNG
                </Button>
                <Button size="sm" variant="outline" onClick={downloadSvg} disabled={busy || !validation.ok}>
                  <Download className="h-3.5 w-3.5" /> SVG
                </Button>
                <Button size="sm" variant="outline" onClick={copyDataUri} disabled={busy || !validation.ok}>
                  <Copy className="h-3.5 w-3.5" /> Copy as &lt;img&gt;
                </Button>
                <span className="text-xs text-muted-foreground self-center ml-2">
                  Tip: Ctrl/Cmd + Enter to download PNG
                </span>
              </div>
            </CardContent>
          </Card>

          {/* GS1 helper (only for gs1-128) */}
          {format === "gs1-128" && (
            <Collapsible title="GS1 Application-Identifier helper" icon={<Info className="h-4 w-4" />} defaultOpen>
              <Gs1HelperPanel onApply={(built) => setValue(built)} />
            </Collapsible>
          )}

          {/* Scan test */}
          <Collapsible title="Scan-test (camera)" icon={<ScanLine className="h-4 w-4" />}>
            <ScanTestPanel
              currentValue={validation.ok ? validation.output.cleaned : value}
              currentFormat={format}
              history={scanHistory}
              setHistory={setScanHistory}
            />
          </Collapsible>
        </>
      )}

      {mode === "bulk" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="bc-bulk" className="text-sm font-medium">
                  Bulk CSV (one per line, or <code>format,value[,label]</code>)
                </Label>
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => onBulkFile(e.target.files?.[0] ?? null)}
                />
                <Button size="sm" variant="outline" onClick={() => bulkFileRef.current?.click()}>
                  <FileText className="h-3.5 w-3.5" /> Upload CSV
                </Button>
              </div>
              <Textarea
                id="bc-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                aria-describedby="bc-bulk-help"
              />
              <p id="bc-bulk-help" className="text-xs text-muted-foreground">
                Single-column rows default to Code 128. Multi-column rows must use a valid format id from the picker above.
              </p>
              {bulkError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {bulkError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={parseBulk}>
                  Parse CSV
                </Button>
                <Button size="sm" onClick={processBulk} disabled={bulkBusy || bulkRows.length === 0}>
                  {bulkBusy ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" /> Generate + ZIP ({bulkRows.length})
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadPdf}
                  disabled={bulkBusy || bulkRows.length === 0}
                >
                  <Printer className="h-3.5 w-3.5" /> Label sheet PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  disabled={bulkRows.length === 0}
                >
                  <Eye className="h-3.5 w-3.5" /> Print preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadManifest("csv")}
                  disabled={results.length === 0}
                >
                  <FileText className="h-3.5 w-3.5" /> Manifest CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadManifest("json")}
                  disabled={results.length === 0}
                >
                  <FileText className="h-3.5 w-3.5" /> Manifest JSON
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Label sheet selector */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-medium">Label sheet template</Label>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Label sheet"
                  value={labelSpec.id}
                  onChange={(e) => {
                    const s = allSheets.find((x) => x.id === e.target.value);
                    if (s) setLabelSpec(s);
                  }}
                  className="h-9 flex-1 min-w-[200px] rounded-md border bg-background px-2 text-sm"
                >
                  <optgroup label="Built-in">
                    {BUILTIN_LABEL_SHEETS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.columns}×{s.rows}
                      </option>
                    ))}
                  </optgroup>
                  {customSheets.length > 0 && (
                    <optgroup label="My custom templates">
                      {customSheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.columns}×{s.rows}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (labelSpec.id.startsWith("custom-")) {
                      deleteCustomSheet(labelSpec.id);
                      refreshCustomSheets();
                      setLabelSpec(BUILTIN_LABEL_SHEETS[0]!);
                      toast.success("Template deleted");
                    }
                  }}
                  disabled={!labelSpec.id.startsWith("custom-")}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {labelSpec.paper} · {labelSpec.columns}×{labelSpec.rows} = {labelSpec.columns * labelSpec.rows} labels per page · {labelSpec.labelWidthMm}×{labelSpec.labelHeightMm}mm
              </p>
            </CardContent>
          </Card>

          {/* Custom label template editor (extra #4) */}
          <Collapsible title="Custom label-template library" icon={<Plus className="h-4 w-4" />}>
            <LabelTemplateEditor onSaved={refreshCustomSheets} />
          </Collapsible>

          {showPreview && (
            <PrintPreviewModal
              spec={labelSpec}
              barcodes={bulkRows}
              onClose={() => setShowPreview(false)}
            />
          )}

          {results.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">
                  Generated {results.length} barcodes — manifest preview
                </p>
                <div className="max-h-[300px] overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">File</th>
                        <th className="p-2 text-left">Format</th>
                        <th className="p-2 text-left">Value</th>
                        <th className="p-2 text-left">Check</th>
                        <th className="p-2 text-left">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.slice(0, 100).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono truncate max-w-[200px]">{r.filename}</td>
                          <td className="p-2">{r.format}</td>
                          <td className="p-2 font-mono truncate max-w-[160px]">{r.value}</td>
                          <td className="p-2 font-mono">{r.checksum}</td>
                          <td className="p-2 text-muted-foreground">
                            {r.widthPx}×{r.heightPx}px
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.length > 100 && (
                    <p className="p-2 text-xs text-muted-foreground">
                      Showing first 100 of {results.length} — download the manifest CSV/JSON for the full list.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "sequence" && (
        <>
          <Collapsible title="Sequence generator" icon={<ListOrdered className="h-4 w-4" />} defaultOpen>
            <SequencePanel
              onGenerate={(rows) => {
                setBulkRows(rows);
                setBulkText(rows.map((r) => `${r.format},${r.value}`).join("\n"));
                setMode("bulk");
                toast.success(`Generated ${rows.length} values — switched to Bulk mode`);
              }}
            />
          </Collapsible>
        </>
      )}

      {/* Privacy note */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> rendering uses bwip-js entirely in your browser. The scan-test feature uses your device camera via getUserMedia and processes frames locally with @zxing/browser — no frame ever leaves your device. Nothing is uploaded; works fully offline after first load.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
