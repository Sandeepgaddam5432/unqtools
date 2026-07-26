"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllPresets,
  getPresetById,
  getPresetsByCategory,
  calculateRT60,
  suggestMixLevel,
  msToSeconds,
  formatPresetAsText,
  exportPresetsAsCSV,
  recommendPluginChain,
  validateReverbParams,
  comparePresets,
  type ReverbPreset,
} from "./logic";

const CATEGORIES: ReverbPreset["category"][] = ["hall", "plate", "spring", "room", "chamber"];

export default function AudioReverbReference() {
  const presets = useMemo(() => getAllPresets(), []);
  const [selectedId, setSelectedId] = useState<string>("plate");
  const [compareId, setCompareId] = useState<string>("");
  const [decayOverride, setDecayOverride] = useState<string>("");
  const [error, setError] = useState<string>("");

  const current = useMemo(() => getPresetById(selectedId), [selectedId]);
  const compareTarget = useMemo(() => (compareId ? getPresetById(compareId) : null), [compareId]);
  const warnings = useMemo(() => {
    if (!decayOverride) return [];
    const n = Number(decayOverride);
    if (Number.isNaN(n)) return [];
    return validateReverbParams({ decayMs: n });
  }, [decayOverride]);

  if (!current) {
    return <ErrorBanner message="Selected preset not found." />;
  }

  const effectiveDecay = decayOverride && !Number.isNaN(Number(decayOverride)) ? Number(decayOverride) : current.decayMs;
  const rt60 = calculateRT60(effectiveDecay, current.highFreqDamping);

  const summary = [
    { label: "Decay (RT60)", value: msToSeconds(effectiveDecay) },
    { label: "Pre-delay", value: msToSeconds(current.preDelayMs) },
    { label: "Diffusion", value: `${Math.round(current.diffusion * 100)}%` },
    { label: "Density", value: `${Math.round(current.density * 100)}%` },
    { label: "HF Damping", value: `${Math.round(current.highFreqDamping * 100)}%` },
    { label: "Low Ratio", value: current.lowRatio.toFixed(2) },
    { label: "Suggested Mix", value: `${suggestMixLevel(current.category)}%` },
    { label: "Perceived RT60", value: msToSeconds(rt60) },
  ];

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Browse by category</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  const first = getPresetsByCategory(c)[0];
                  if (first) setSelectedId(first.id);
                }}
                className="px-3 py-1 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted cursor-pointer capitalize"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`px-3 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                  selectedId === p.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">{current.name}</h3>
              <p className="text-xs text-muted-foreground">{current.description}</p>
            </div>
            <div className="flex gap-2">
              <CopyButton getText={() => formatPresetAsText(current)} label="Copy card" />
              <DownloadButton
                getText={() => exportPresetsAsCSV()}
                filename="reverb-presets.csv"
                mime="text/csv"
                label="CSV"
              />
            </div>
          </div>

          <div className="space-y-1">
            {summary.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-[140px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0"
              >
                <span className="text-muted-foreground">{r.label}</span>
                <code className="font-mono">{r.value}</code>
                <CopyButton getText={() => r.value} label="" size="icon-sm" />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Override decay (ms) to test variations</Label>
            <input
              type="number"
              value={decayOverride}
              onChange={(e) => setDecayOverride(e.target.value)}
              placeholder={`default: ${current.decayMs}`}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
            />
            {warnings.length > 0 && (
              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <Label className="text-xs text-blue-700 dark:text-blue-400">Use cases</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {current.useCases.map((u) => (
                  <Badge key={u} variant="outline" className="text-[10px] border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    {u}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-emerald-700 dark:text-emerald-400">Instruments</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {current.instruments.map((i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {i}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-purple-700 dark:text-purple-400">Famous examples</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {current.famousExamples.map((e) => (
                  <Badge key={e} variant="outline" className="text-[10px] border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <Label className="text-xs text-muted-foreground">Recommended plugin chain</Label>
            <ol className="text-xs space-y-1 list-decimal pl-4">
              {recommendPluginChain(current.category).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Compare with another preset</Label>
          <select
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="">— pick a preset to compare —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {compareTarget && (
            <div className="space-y-1 mt-2">
              {comparePresets(current, compareTarget).map((row) => (
                <div
                  key={row.field}
                  className="grid grid-cols-[100px_1fr_1fr] gap-2 text-xs py-1 border-b border-border/40 last:border-0"
                >
                  <span className="text-muted-foreground">{row.field}</span>
                  <code className="font-mono text-foreground">{row.a}</code>
                  <code className="font-mono text-foreground">{row.b}</code>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
