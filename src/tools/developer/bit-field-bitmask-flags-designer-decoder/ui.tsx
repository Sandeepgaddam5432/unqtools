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
  History, Cpu, ArrowRight, AlertTriangle, CheckCircle2, Plus, Trash2,
  Save, FolderOpen, Code2, Flag, Layers,
} from "lucide-react";
import {
  BIT_WIDTHS,
  FIELD_COLORS,
  PRESETS,
  fieldColor,
  validateLayout,
  reservedBits,
  encodeFields,
  decodeValue,
  buildBitStrip,
  formatInBases,
  parseInteger,
  generateCode,
  cloneLayout,
  loadHistory,
  saveHistory,
  clearHistory,
  loadSavedLayouts,
  saveSavedLayout,
  deleteSavedLayout,
  buildShareUrl,
  parseShareUrl,
  type BitWidth,
  type BitNumbering,
  type Layout,
  type BitField,
  type CodeLang,
  type HistoryEntry,
} from "./logic";

let _uiIdCounter = 0;
function newFieldId(): string {
  _uiIdCounter += 1;
  return `f_${Date.now().toString(36)}_${_uiIdCounter}`;
}

function emptyField(startBit: number = 0, width: number = 1): BitField {
  return { id: newFieldId(), name: `FIELD_${_uiIdCounter}`, startBit, width };
}

function defaultLayout(): Layout {
  return {
    name: "My Register",
    width: 16,
    numbering: "LSB0",
    fields: [
      { id: newFieldId(), name: "ENABLE", startBit: 0, width: 1 },
      { id: newFieldId(), name: "MODE", startBit: 1, width: 2, enums: [
        { value: 0, label: "OFF" },
        { value: 1, label: "AUTO" },
        { value: 2, label: "ON" },
        { value: 3, label: "MAX" },
      ] },
    ],
  };
}

const LANGS: { id: CodeLang; label: string }[] = [
  { id: "c", label: "C / C++" },
  { id: "rust", label: "Rust" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "typescript", label: "TypeScript" },
];

export default function BitFieldBitmaskFlagsDesignerDecoder() {
  const [layout, setLayout] = useState<Layout>(defaultLayout());
  const [fieldValues, setFieldValues] = useState<Record<string, number>>({});
  const [decodeInput, setDecodeInput] = useState("");
  const [lang, setLang] = useState<CodeLang>("c");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedLayouts, setSavedLayouts] = useState<{ name: string; layout: Layout }[]>([]);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    setSavedLayouts(loadSavedLayouts());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setLayout(parsed.layout);
        if (parsed.value) {
          try {
            const v = parseInteger("0x" + parsed.value);
            setDecodeInput("0x" + parsed.value);
            void v;
          } catch {
            // ignore
          }
        }
        toast.info("Loaded layout from share link");
      }
    }
  }, []);

  const validationErrors = useMemo(() => validateLayout(layout), [layout]);
  const reserved = useMemo(() => reservedBits(layout), [layout]);

  // Encode result from current field values
  const encodeResult = useMemo(() => {
    const inputs = layout.fields.map((f) => ({
      fieldId: f.id,
      value: fieldValues[f.id] ?? 0,
    }));
    return encodeFields(layout, inputs);
  }, [layout, fieldValues]);

  // Decode result from decode input
  const decodeResult = useMemo(() => {
    if (!decodeInput.trim()) return null;
    try {
      const value = parseInteger(decodeInput);
      return { value, result: decodeValue(layout, value) };
    } catch (e) {
      return { value: 0n, result: null, error: e instanceof Error ? e.message : "parse error" };
    }
  }, [decodeInput, layout]);

  const codeOutput = useMemo(() => generateCode(layout, lang), [layout, lang]);
  const bitStrip = useMemo(() => buildBitStrip(layout, encodeResult.value), [layout, encodeResult.value]);

  // Field editing helpers
  const updateField = useCallback((id: string, patch: Partial<BitField>) => {
    setLayout((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const addField = useCallback(() => {
    setLayout((prev) => {
      // Default new field to start at next available bit
      const maxEnd = prev.fields.reduce((m, f) => Math.max(m, f.startBit + f.width), 0);
      return { ...prev, fields: [...prev.fields, emptyField(maxEnd, 1)] };
    });
  }, []);

  const removeField = useCallback((id: string) => {
    setLayout((prev) => ({ ...prev, fields: prev.fields.filter((f) => f.id !== id) }));
    setFieldValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setLayout(cloneLayout(preset.layout));
    setFieldValues({});
    setDecodeInput("");
    toast.success(`Loaded preset: ${preset.name}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      layoutName: layout.name,
      width: layout.width,
      value: encodeResult.bases.dec,
      hex: encodeResult.bases.hex,
    });
    setHistory(loadHistory());
  }, [layout, encodeResult]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLayout = useCallback(() => {
    if (!saveName.trim()) {
      toast.error("Enter a name for the layout");
      return;
    }
    setSavedLayouts(saveSavedLayout(saveName.trim(), layout));
    toast.success(`Saved layout: ${saveName.trim()}`);
  }, [saveName, layout]);

  const handleLoadLayout = useCallback((name: string) => {
    const found = loadSavedLayouts().find((l) => l.name === name);
    if (!found) return;
    setLayout(cloneLayout(found.layout));
    setFieldValues({});
    toast.success(`Loaded: ${name}`);
  }, []);

  const handleDeleteLayout = useCallback((name: string) => {
    setSavedLayouts(deleteSavedLayout(name));
    toast.success(`Deleted: ${name}`);
  }, []);

  const handleClear = useCallback(() => {
    setFieldValues({});
    setDecodeInput("");
    toast.info("Cleared values");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Top controls: presets + width + numbering + name */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Preset:</Label>
            <select
              onChange={(e) => { if (e.target.value) loadPreset(e.target.value); }}
              className="h-8 text-xs rounded border bg-background px-2"
              defaultValue=""
            >
              <option value="">— choose —</option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Label className="text-xs">Width:</Label>
              <select
                value={layout.width}
                onChange={(e) => setLayout((prev) => ({ ...prev, width: Number(e.target.value) as BitWidth }))}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {BIT_WIDTHS.map((w) => (
                  <option key={w} value={w}>{w}-bit</option>
                ))}
              </select>
              <Label className="text-xs">Numbering:</Label>
              <select
                value={layout.numbering}
                onChange={(e) => setLayout((prev) => ({ ...prev, numbering: e.target.value as BitNumbering }))}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="LSB0">LSB0 (bit 0 = rightmost)</option>
                <option value="MSB0">MSB0 (bit 0 = leftmost)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs" htmlFor="bfmd-name">Layout name:</Label>
            <Input
              id="bfmd-name"
              value={layout.name}
              onChange={(e) => setLayout((prev) => ({ ...prev, name: e.target.value }))}
              className="h-8 w-48 text-xs"
            />
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="layout name"
                className="h-8 w-32 text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleSaveLayout} className="gap-1">
                <Save className="h-3 w-3" /> Save
              </Button>
            </div>
          </div>
          {savedLayouts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {savedLayouts.map((s) => (
                <Badge key={s.name} variant="outline" className="text-[10px] gap-1">
                  <button onClick={() => handleLoadLayout(s.name)} className="hover:underline">{s.name}</button>
                  <button onClick={() => handleDeleteLayout(s.name)} className="ml-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Field editor */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Fields ({layout.fields.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addField} className="gap-1">
              <Plus className="h-3 w-3" /> Add field
            </Button>
          </div>
          {validationErrors.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 space-y-1">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-px flex-shrink-0" />
                  {e.message}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {layout.fields.map((f, idx) => {
              const color = f.color ?? fieldColor(idx);
              return (
                <div key={f.id} className="grid grid-cols-12 gap-1.5 items-center rounded border bg-background px-2 py-1.5">
                  <div className="col-span-1 flex items-center justify-center">
                    <span className="inline-block w-4 h-4 rounded" style={{ background: color }} />
                  </div>
                  <Input
                    value={f.name}
                    onChange={(e) => updateField(f.id, { name: e.target.value })}
                    className="col-span-3 h-7 text-xs font-mono"
                    placeholder="name"
                  />
                  <Input
                    type="number"
                    value={f.startBit}
                    onChange={(e) => updateField(f.id, { startBit: Number(e.target.value) })}
                    className="col-span-2 h-7 text-xs font-mono"
                    placeholder="start"
                  />
                  <Input
                    type="number"
                    value={f.width}
                    min={1}
                    onChange={(e) => updateField(f.id, { width: Math.max(1, Number(e.target.value)) })}
                    className="col-span-2 h-7 text-xs font-mono"
                    placeholder="width"
                  />
                  <div className="col-span-3 flex items-center gap-1">
                    <Input
                      type="number"
                      value={fieldValues[f.id] ?? 0}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.id]: Number(e.target.value) }))}
                      className="h-7 text-xs font-mono"
                      placeholder="value"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      bits {f.startBit}-{f.startBit + f.width - 1}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeField(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {layout.fields.length === 0 && (
              <p className="text-xs text-muted-foreground p-4 text-center">
                No fields yet — click "Add field" or load a preset.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visual bit strip + encoded result */}
      {validationErrors.length === 0 && layout.fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Flag className="h-4 w-4" /> Bit layout ({layout.width}-bit, MSB-first display)
            </h3>
            <div className="overflow-x-auto">
              <div className="inline-flex flex-col gap-1 font-mono text-[10px]">
                <div className="flex">
                  {bitStrip.map((c, i) => (
                    <div key={i} className="w-7 text-center text-muted-foreground">
                      {layout.numbering === "LSB0" ? c.bitIndex : (layout.width - 1 - c.bitIndex)}
                    </div>
                  ))}
                </div>
                <div className="flex">
                  {bitStrip.map((c, i) => (
                    <div
                      key={i}
                      title={c.fieldName ?? (c.reserved ? "reserved" : "unused")}
                      className="w-7 h-7 flex items-center justify-center border border-border"
                      style={{
                        background: c.fieldName ? (c.fieldColor ?? "#3b82f6") + "33" : (c.reserved ? "repeating-linear-gradient(45deg,#88833,#88822 4px)" : "transparent"),
                        color: c.value === 1 ? "#10b981" : "#9ca3af",
                        fontWeight: c.value === 1 ? "bold" : "normal",
                      }}
                    >
                      {c.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Colored cells = fields, dashed = reserved, white = unused. Bit numbers shown in {layout.numbering} convention.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Encode / decode results */}
      {validationErrors.length === 0 && layout.fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="h-4 w-4" /> Encode result
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <BaseRow label="BIN" value={encodeResult.bases.bin} />
              <BaseRow label="HEX" value={"0x" + encodeResult.bases.hex} />
              <BaseRow label="DEC" value={encodeResult.bases.dec} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton
                getText={() => { handleSaveHistory(); return "0x" + encodeResult.bases.hex; }}
                label="Copy hex"
              />
              <CopyButton getText={() => encodeResult.bases.bin} label="Copy bin" />
              <CopyButton getText={() => encodeResult.bases.dec} label="Copy dec" />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ layout, value: encodeResult.bases.hex }); }} />
              <ClearButton onClick={handleClear} />
            </div>

            <div className="pt-3 border-t">
              <Label htmlFor="bfmd-decode" className="text-xs">Decode a packed value (paste hex/bin/dec):</Label>
              <Input
                id="bfmd-decode"
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value)}
                placeholder="e.g. 0x09 or 0b1001 or 9"
                className="font-mono text-xs"
              />
              {decodeResult && "error" in decodeResult && decodeResult.error && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {decodeResult.error}
                </p>
              )}
              {decodeResult && decodeResult.result && (
                <div className="mt-2 space-y-1">
                  {decodeResult.result.errors.length > 0 && (
                    <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
                      {decodeResult.result.errors.map((e, i) => (
                        <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300">{e}</p>
                      ))}
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="py-1 text-left">Field</th>
                        <th className="py-1 text-right">Value</th>
                        <th className="py-1 text-left pl-3">Label / State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decodeResult.result.fields.map((df, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1 font-mono">
                            <span className="inline-block w-3 h-3 rounded mr-1.5 align-middle" style={{ background: fieldColor(layout.fields.findIndex((f) => f.id === df.field.id)) }} />
                            {df.field.name}
                          </td>
                          <td className="py-1 text-right font-mono">{df.rawValue}</td>
                          <td className="py-1 pl-3 text-muted-foreground">
                            {df.field.width === 1
                              ? (df.isSet ? <span className="text-emerald-600 dark:text-emerald-400">SET</span> : <span>clear</span>)
                              : (df.label ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {decodeResult.result.reserved.length > 0 && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      ⚠ Reserved bits set: {decodeResult.result.reserved.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code generation */}
      {validationErrors.length === 0 && layout.fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> Code generation
              </h3>
              <div className="ml-auto flex gap-1">
                {LANGS.map((l) => (
                  <Button
                    key={l.id}
                    variant={lang === l.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLang(l.id)}
                  >{l.label}</Button>
                ))}
              </div>
            </div>
            <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-x-auto max-h-96">
{codeOutput}
            </pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => codeOutput} label="Copy code" />
              <DownloadButton
                getText={() => codeOutput}
                filename={`${layout.name.toLowerCase().replace(/\s+/g, "-")}.${lang === "typescript" ? "ts" : lang === "python" ? "py" : lang === "rust" ? "rs" : lang === "go" ? "go" : "h"}`}
                label="Download"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {validationErrors.length === 0 && layout.fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Color legend</h3>
            <div className="flex flex-wrap gap-2">
              {layout.fields.map((f, idx) => (
                <Badge key={f.id} variant="outline" className="text-[10px] gap-1.5">
                  <span className="inline-block w-3 h-3 rounded" style={{ background: f.color ?? fieldColor(idx) }} />
                  {f.name}
                </Badge>
              ))}
              {reserved.length > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1.5">
                  <span className="inline-block w-3 h-3 rounded" style={{ background: "repeating-linear-gradient(45deg,#88833,#88822 4px)" }} />
                  reserved ({reserved.length} bits)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {layout.fields.length === 0 && (
        <EmptyState
          title="Define bit fields or load a preset"
          hint="Click 'Add field' to define your first flag/field, or pick a preset (POSIX file mode, TCP flags, FAT, ARM CPSR, x86 EFLAGS) above to start from a real-world layout."
          icon={<Cpu className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent encodes ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.width}-bit</Badge>
                  <span className="font-mono text-muted-foreground">{h.layoutName}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground">0x{h.hex}</span>
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
            <strong className="text-foreground">Privacy:</strong> All encoding, decoding and code generation runs locally with BigInt precision. Layouts & history are stored in localStorage on this device only — nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BaseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5">
      <Badge variant="outline" className="text-[10px] w-12">{label}</Badge>
      <span className="break-all font-mono text-xs">{value}</span>
    </div>
  );
}
