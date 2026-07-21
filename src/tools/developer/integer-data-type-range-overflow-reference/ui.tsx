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
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Binary, Search, AlertTriangle, CheckCircle2,
  TableProperties, Languages, Calculator,
} from "lucide-react";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  TYPE_FAMILIES,
  FAMILY_LABELS,
  BUILD_MODES,
  BUILD_MODE_LABELS,
  OVERFLOW_BEHAVIOR_LABELS,
  INTEGER_TYPES,
  OVERFLOW_PRESETS,
  getTypeById,
  filterTypes,
  compareAcrossLanguages,
  formatBigint,
  toDecimal,
  toHex,
  toBinary,
  parseInput,
  simulateOverflow,
  buildBitGrid,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Language,
  type BuildMode,
  type TypeFamily,
  type OverflowResult,
  type HistoryEntry,
} from "./logic";

export default function IntegerDataTypeRangeOverflowReference() {
  // --- Reference table state ---
  const [query, setQuery] = useState("");
  const [langFilter, setLangFilter] = useState<Language | "">("");
  const [compareFamily, setCompareFamily] = useState<TypeFamily>("int32");

  // --- Overflow calculator state ---
  const [inputStr, setInputStr] = useState("300");
  const [typeId, setTypeId] = useState("c-uint8_t");
  const [mode, setMode] = useState<BuildMode>("default");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) setInputStr(p.input);
      if (p.typeId) setTypeId(p.typeId);
      if (p.mode) setMode(p.mode);
      if (p.input || p.typeId) toast.info("Loaded from share link");
    }
  }, []);

  const filtered = useMemo(() => filterTypes(query, langFilter), [query, langFilter]);
  const compareList = useMemo(() => compareAcrossLanguages(compareFamily), [compareFamily]);

  const parsed = useMemo(() => parseInput(inputStr), [inputStr]);
  const result: OverflowResult | null = useMemo(() => {
    if (!parsed.ok || parsed.value === undefined) return null;
    try {
      return simulateOverflow(parsed.value, typeId, mode);
    } catch {
      return null;
    }
  }, [parsed, typeId, mode]);

  const handleSaveHistory = useCallback(() => {
    if (result) {
      saveHistory({
        ts: Date.now(),
        input: inputStr,
        typeId,
        mode,
        fits: result.fits,
        wrappedDec: result.wrappedDec,
      });
      setHistory(loadHistory());
    }
  }, [result, inputStr, typeId, mode]);

  const handleClear = useCallback(() => {
    setInputStr("");
    setTypeId("c-int32_t");
    setMode("default");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyPreset = (i: number) => {
    const p = OVERFLOW_PRESETS[i];
    setInputStr(p.value);
    setTypeId(p.typeId);
    setMode(p.mode);
    toast.info(`Loaded preset: ${p.label}`);
  };

  const bitGrid = useMemo(() => {
    if (!result || result.unbounded || result.bits > 128) return null;
    return buildBitGrid(result.stored, result.bits);
  }, [result]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* ============= Overflow Calculator ============= */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calculator className="h-4 w-4" /> Overflow Simulator
          </h3>
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ov-input" className="text-xs">Value (dec / 0x hex / 0b bin / 0o oct)</Label>
              <Input
                id="ov-input"
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                placeholder="300"
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-type" className="text-xs">Type</Label>
              <select
                id="ov-type"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {LANGUAGES.map((lang) => (
                  <optgroup key={lang} label={LANGUAGE_LABELS[lang]}>
                    {INTEGER_TYPES.filter((t) => t.language === lang).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.bits === 0 ? "∞" : `${t.bits}-bit`} {t.signed ? "signed" : "unsigned"})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-mode" className="text-xs">Build mode (Rust/C#)</Label>
              <select
                id="ov-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as BuildMode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {BUILD_MODES.map((m) => (
                  <option key={m} value={m}>{BUILD_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {OVERFLOW_PRESETS.map((p, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => applyPreset(i)}
                title={p.description}
              >{p.label}</Button>
            ))}
          </div>

          {parsed.ok === false && inputStr.trim() !== "" && (
            <ErrorBanner message={parsed.error ?? "Invalid input."} />
          )}

          {result && (
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {result.fits ? (
                  <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Fits in {result.typeName}</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Overflow</Badge>
                )}
                <Badge variant="outline" className="text-[10px]">{LANGUAGE_LABELS[result.language]}</Badge>
                <Badge variant="outline" className="text-[10px]">{result.bits === 0 ? "∞ bits" : `${result.bits}-bit`}</Badge>
                <Badge variant="outline" className="text-[10px]">{result.signed ? "signed" : "unsigned"}</Badge>
                <Badge variant="outline" className="text-[10px]">{result.behaviorLabel}</Badge>
                {result.unbounded && <Badge variant="secondary" className="text-[10px]">unbounded</Badge>}
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded border bg-card p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Input</div>
                  <div className="font-mono text-foreground">{result.inputDec}</div>
                  <div className="font-mono text-muted-foreground text-[10px]">{result.inputHex} · {result.inputBin}</div>
                </div>
                <div className="rounded border bg-card p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {result.unbounded ? "Stored (unbounded)" : result.fits ? "Stored" : "After wrap"}
                  </div>
                  <div className="font-mono text-foreground">{result.wrappedDec}</div>
                  <div className="font-mono text-muted-foreground text-[10px]">{result.wrappedHex} · {result.wrappedBin}</div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded border bg-card p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Type range</div>
                  <div className="font-mono text-foreground text-[11px]">min: {result.minDec}</div>
                  <div className="font-mono text-foreground text-[11px]">max: {result.maxDec}</div>
                </div>
                <div className="rounded border bg-card p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Overflow behavior</div>
                  <div className="text-foreground text-[11px]">{result.note}</div>
                </div>
              </div>

              {bitGrid && (
                <div className="rounded border bg-card p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Stored bit pattern (MSB → LSB), {result.bits} bits
                  </div>
                  <div className="flex flex-wrap gap-0.5 font-mono text-[10px]">
                    {bitGrid.map((c, i) => (
                      <span
                        key={i}
                        title={`bit ${c.position} (weight ${c.weight.toString()})${c.isSign ? " — sign bit" : ""}`}
                        className={
                          c.value
                            ? c.isSign
                              ? "px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        }
                      >{c.value}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => { handleSaveHistory(); return result.wrappedDec; }} label="Copy result" />
                <CopyButton getText={() => toHex(result.wrapped)} label="Copy hex" />
                <CopyButton getText={() => toBinary(result.wrapped)} label="Copy binary" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputStr, typeId, mode); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============= Reference Table ============= */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TableProperties className="h-4 w-4" /> Reference Table ({filtered.length} types)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search types…"
                  className="pl-7 h-8 text-xs w-44"
                />
              </div>
              <select
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value as Language | "")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">All languages</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Type</th>
                  <th className="text-left px-2 py-1.5 font-medium">Lang</th>
                  <th className="text-left px-2 py-1.5 font-medium">Bits</th>
                  <th className="text-left px-2 py-1.5 font-medium">Sign</th>
                  <th className="text-right px-2 py-1.5 font-medium">Min</th>
                  <th className="text-right px-2 py-1.5 font-medium">Max</th>
                  <th className="text-left px-2 py-1.5 font-medium">Constant</th>
                  <th className="text-left px-2 py-1.5 font-medium">Format</th>
                  <th className="text-left px-2 py-1.5 font-medium">Overflow</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => { setTypeId(t.id); toast.info(`Calculator → ${t.name}`); }}
                        className="font-mono text-foreground hover:text-primary hover:underline"
                      >{t.name}</button>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{LANGUAGE_LABELS[t.language]}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{t.bits === 0 ? "∞" : t.bits}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline" className="text-[10px]">{t.signed ? "signed" : "unsigned"}</Badge>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground text-[10px]">
                      {t.bits === 0 ? "−∞" : formatBigint(t.min)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-foreground text-[10px]">
                      {t.bits === 0 ? "+∞" : formatBigint(t.max)}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {t.constantMax && (
                        <button
                          onClick={() => { void navigator.clipboard?.writeText(t.constantMax ?? ""); toast.success(`Copied ${t.constantMax}`); }}
                          className="hover:text-primary hover:underline"
                          title="Click to copy"
                        >{t.constantMax}</button>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{t.formatSpec ?? "—"}</td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground max-w-[200px] truncate" title={t.overflowNote}>
                      {t.overflowNote ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <p className="text-[11px] text-muted-foreground">Showing first 100 of {filtered.length}. Refine your search to narrow.</p>
          )}
        </CardContent>
      </Card>

      {/* ============= Cross-language Comparison ============= */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Languages className="h-4 w-4" /> Cross-language Comparison
            </h3>
            <select
              value={compareFamily}
              onChange={(e) => setCompareFamily(e.target.value as TypeFamily)}
              className="h-8 text-xs rounded border bg-background px-2"
            >
              {TYPE_FAMILIES.map((f) => (
                <option key={f} value={f}>{FAMILY_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {compareList.map((t) => (
              <div key={t.id} className="rounded border bg-background p-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-foreground">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">{LANGUAGE_LABELS[t.language]}</Badge>
                </div>
                <div className="text-muted-foreground text-[10px]">{t.bits === 0 ? "∞" : `${t.bits}-bit`} · {t.signed ? "signed" : "unsigned"}</div>
                <div className="font-mono text-[10px] text-foreground">
                  min: {t.bits === 0 ? "−∞" : formatBigint(t.min)}
                </div>
                <div className="font-mono text-[10px] text-foreground">
                  max: {t.bits === 0 ? "+∞" : formatBigint(t.max)}
                </div>
                {t.constantMax && (
                  <button
                    onClick={() => { void navigator.clipboard?.writeText(t.constantMax ?? ""); toast.success(`Copied ${t.constantMax}`); }}
                    className="font-mono text-[10px] text-primary hover:underline"
                  >{t.constantMax}</button>
                )}
                <button
                  onClick={() => { setTypeId(t.id); toast.info(`Calculator → ${t.name}`); }}
                  className="block text-[10px] text-muted-foreground hover:text-primary hover:underline"
                >→ use in calculator</button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============= History ============= */}
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
                <button
                  key={i}
                  onClick={() => { setInputStr(h.input); setTypeId(h.typeId); setMode(h.mode); toast.info("Loaded from history"); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={h.fits ? "secondary" : "destructive"} className="text-[10px]">{h.fits ? "fits" : "overflow"}</Badge>
                    <span className="font-mono text-foreground">{h.input}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-foreground">{h.wrappedDec}</span>
                    <Badge variant="outline" className="text-[10px]">{h.typeId}</Badge>
                    {h.mode !== "default" && <Badge variant="outline" className="text-[10px]">{BUILD_MODE_LABELS[h.mode]}</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============= Behavior Cheatsheet ============= */}
      <Card>
        <CardContent className="p-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
            <Binary className="h-4 w-4" /> Overflow Semantics Cheatsheet
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {LANGUAGES.map((l) => {
              const t = INTEGER_TYPES.find((x) => x.language === l);
              const note = t?.overflowNote ?? "";
              return (
                <div key={l} className="rounded border bg-background p-2">
                  <div className="font-medium text-foreground">{LANGUAGE_LABELS[l]}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{note}</div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            <strong className="text-foreground">Honesty note:</strong> Reflects documented semantics. Compiler flags, optimization levels, and UB mean real programs can still differ — always test on your target.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
