"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Binary, AlertTriangle, Settings2,
} from "lucide-react";
import {
  PRESETS,
  ROUNDING_LABELS,
  OVERFLOW_LABELS,
  isValidConfig,
  getFormatInfo,
  realToQ,
  qToReal,
  toggleBit,
  getBit,
  toHexString,
  toBinaryString,
  splitFieldBits,
  bitFieldLabel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QConfig,
  type RoundingMode,
  type OverflowMode,
  type HistoryEntry,
} from "./logic";

export default function FixedPointQFormatConverter() {
  const [inputStr, setInputStr] = useState("0.1");
  const [config, setConfig] = useState<QConfig>({ m: 1, n: 15, signed: true });
  const [rounding, setRounding] = useState<RoundingMode>("round-to-even");
  const [overflow, setOverflow] = useState<OverflowMode>("saturate");
  const [manualRaw, setManualRaw] = useState<bigint | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) setInputStr(p.input);
      setConfig(p.config);
      setRounding(p.rounding);
      setOverflow(p.overflow);
      if (p.input || p.rounding !== "round-to-even" || p.overflow !== "saturate") {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // When the input string or config changes, reset manual bit editing.
  useEffect(() => {
    setManualRaw(null);
  }, [inputStr, config, rounding, overflow]);

  const validConfig = isValidConfig(config);

  const result = useMemo(() => {
    if (!validConfig) return null;
    if (manualRaw !== null) {
      // Manual bit editing mode — rebuild display from raw bits.
      const info = getFormatInfo(config);
      const reconstructed = qToReal(manualRaw, config);
      return {
        config,
        rounding,
        overflow,
        rawInt: manualRaw,
        rawSigned: manualRaw, // for display only
        dec: manualRaw.toString(10),
        hex: toHexString(manualRaw, info.totalBits),
        bin: toBinaryString(manualRaw, info.totalBits),
        reconstructed,
        quantError: "0",
        overflowed: false,
        inputParsed: inputStr,
      };
    }
    if (!inputStr.trim()) return null;
    try {
      return realToQ(inputStr, config, rounding, overflow);
    } catch {
      return null;
    }
  }, [validConfig, manualRaw, inputStr, config, rounding, overflow]);

  const formatInfo = useMemo(() => validConfig ? getFormatInfo(config) : null, [validConfig, config]);

  const handleBitClick = useCallback((position: number) => {
    if (!result || !validConfig) return;
    const info = getFormatInfo(config);
    const current = result.rawInt & ((1n << BigInt(info.totalBits)) - 1n);
    const newRaw = toggleBit(current, position);
    setManualRaw(newRaw);
  }, [result, validConfig, config]);

  const handleSaveHistory = useCallback(() => {
    if (result && validConfig) {
      saveHistory({
        ts: Date.now(),
        input: inputStr,
        config,
        rounding,
        overflow,
        hex: result.hex,
        reconstructed: result.reconstructed,
      });
      setHistory(loadHistory());
    }
  }, [result, validConfig, inputStr, config, rounding, overflow]);

  const handleClear = useCallback(() => {
    setInputStr("");
    setManualRaw(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handlePreset = useCallback((preset: QConfig, label: string) => {
    setConfig(preset);
    setManualRaw(null);
    toast.info(`Switched to ${label}`);
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="q-input">Real value (decimal, e.g. 0.1 or -1.5 or 1.5e2)</Label>
            <Input
              id="q-input"
              value={inputStr}
              onChange={(e) => setInputStr(e.target.value)}
              placeholder="0.1"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handlePreset(p.config, p.label)}
                  title={p.description}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Integer bits (m)</Label>
              <Input
                type="number"
                min={1}
                max={255}
                value={config.m}
                onChange={(e) => setConfig((c) => ({ ...c, m: parseInt(e.target.value, 10) || 1 }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fraction bits (n)</Label>
              <Input
                type="number"
                min={0}
                max={255}
                value={config.n}
                onChange={(e) => setConfig((c) => ({ ...c, n: parseInt(e.target.value, 10) || 0 }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Signed</Label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer h-9">
                <input
                  type="checkbox"
                  checked={config.signed}
                  onChange={(e) => setConfig((c) => ({ ...c, signed: e.target.checked }))}
                />
                {config.signed ? "Qm.n (signed)" : "UQm.n (unsigned)"}
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total bits</Label>
              <div className="h-9 flex items-center font-mono text-sm text-muted-foreground">
                {config.m + config.n}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Rounding mode</Label>
              <select
                value={rounding}
                onChange={(e) => setRounding(e.target.value as RoundingMode)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(ROUNDING_LABELS) as RoundingMode[]).map((r) => (
                  <option key={r} value={r}>{ROUNDING_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Overflow mode</Label>
              <select
                value={overflow}
                onChange={(e) => setOverflow(e.target.value as OverflowMode)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(OVERFLOW_LABELS) as OverflowMode[]).map((o) => (
                  <option key={o} value={o}>{OVERFLOW_LABELS[o]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {formatInfo && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Settings2 className="h-4 w-4" /> Format info
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total bits" value={formatInfo.totalBits} />
              <Stat label="Resolution (2^-n)" value={formatInfo.resolution} mono />
              <Stat label="Min value" value={formatInfo.minValue} mono />
              <Stat label="Max value" value={formatInfo.maxValue} mono />
            </div>
          </CardContent>
        </Card>
      )}

      {result ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Binary className="h-4 w-4" /> {config.signed ? "Q" : "UQ"}{config.m}.{config.n}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{ROUNDING_LABELS[rounding].split(" (")[0]}</Badge>
                <Badge variant="outline" className="text-[10px]">{OVERFLOW_LABELS[overflow].split(" (")[0]}</Badge>
                {result.overflowed && (
                  <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1 inline" /> overflow
                  </Badge>
                )}
              </div>
            </div>

            {/* Bit grid */}
            <BitGrid
              raw={result.rawInt}
              config={config}
              onBitClick={handleBitClick}
            />

            {/* Output */}
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <DetailRow label="Raw integer (signed decimal)" value={result.dec} mono />
              <DetailRow label="Raw integer (hex)" value={`0x${result.hex}`} mono />
              <DetailRow label="Raw integer (binary)" value={result.bin} mono break />
              <DetailRow label="Reconstructed real value" value={result.reconstructed} mono break />
              <DetailRow label="Quantization error (input − reconstructed)" value={result.quantError} mono break />
              <DetailRow label="Input (as typed)" value={result.inputParsed} mono />
            </div>

            {manualRaw !== null && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                Bit-edit mode — the input box above is no longer the source of truth. Click a bit to toggle, or use Clear to reset.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <CopyButton getText={() => { handleSaveHistory(); return `0x${result.hex}`; }} label="Copy hex" />
              <CopyButton getText={() => result.bin} label="Copy binary" />
              <CopyButton getText={() => result.reconstructed} label="Copy reconstructed" />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputStr, config, rounding, overflow); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Enter a real value to convert to Qm.n fixed-point"
          hint="Pick a preset (Q15, UQ8.8, …) or configure m, n, signed/unsigned, rounding and overflow modes. The tool computes the stored raw integer in dec/hex/bin, the exact reconstructed value, and the quantization error."
          icon={<Binary className="h-8 w-8" />}
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
                <div
                  key={i}
                  className="rounded border bg-background px-3 py-2 text-xs cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => {
                    setInputStr(h.input);
                    setConfig(h.config);
                    setRounding(h.rounding);
                    setOverflow(h.overflow);
                    setManualRaw(null);
                  }}
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {h.config.signed ? "Q" : "UQ"}{h.config.m}.{h.config.n}
                  </Badge>
                  <span className="font-mono text-foreground">{h.input}</span>
                  <span className="font-mono text-muted-foreground ml-2">→ 0x{h.hex}</span>
                  <span className="font-mono text-muted-foreground ml-2">= {h.reconstructed}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All conversion runs locally with BigInt math (exact, no float round-off). History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BitGrid({
  raw,
  config,
  onBitClick,
}: {
  raw: bigint;
  config: QConfig;
  onBitClick: (position: number) => void;
}) {
  const info = getFormatInfo(config);
  const cells = [];
  // MSB first (left to right): sign + integer bits, then fractional bits.
  for (let i = info.totalBits - 1; i >= 0; i--) {
    const field = bitFieldLabel(i, config);
    const colorClass =
      field === "sign"
        ? "bg-rose-500/15 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border-rose-500/40"
        : field === "integer"
          ? "bg-amber-500/15 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border-amber-500/40"
          : "bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
    cells.push(
      <button
        key={i}
        type="button"
        onClick={() => onBitClick(i)}
        title={`Bit ${i} (${field})`}
        className={`h-7 w-7 sm:h-6 sm:w-6 rounded border font-mono text-xs flex items-center justify-center transition-colors ${colorClass}`}
      >
        {getBit(raw, i)}
      </button>,
    );
  }
  const fields = splitFieldBits(raw, config);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {cells}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {config.signed && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-rose-500/30 border border-rose-500/40" />
            sign (1 bit)
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-500/30 border border-amber-500/40" />
          integer ({config.signed ? config.m - 1 : config.m} bits)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-500/30 border border-emerald-500/40" />
          fraction ({config.n} bits)
        </span>
        <span className="font-mono">
          int: {fields.integer}{fields.fraction ? ` | frac: ${fields.fraction}` : ""}
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  break: breakLine,
}: {
  label: string;
  value: string;
  mono?: boolean;
  break?: boolean;
}) {
  return (
    <div className={`rounded border bg-background px-3 py-2 ${breakLine ? "break-all" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""} ${breakLine ? "break-all" : ""}`}>{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
