"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  estimate, tuneForTime, memoryTradeoff, toCliCommand, toOptionsObject,
  renderReport, getPresetLevels, presetComparisonTable,
  type Argon2Params, type Argon2Variant, type SecurityTier,
} from "./logic";

const VARIANTS: Argon2Variant[] = ["argon2id", "argon2i", "argon2d"];

const TIER_COLOR: Record<SecurityTier, string> = {
  low: "bg-red-500/15 text-red-700 dark:text-red-300",
  moderate: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  maximum: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

export default function Argon2ParamCalculator() {
  const [params, setParams] = useState<Argon2Params>({
    memoryKb: 19 * 1024, iterations: 2, parallelism: 1,
    variant: "argon2id", hashLength: 32,
  });
  const [targetMs, setTargetMs] = useState(500);

  const est = useMemo(() => estimate(params), [params]);
  const tradeoff = useMemo(() => memoryTradeoff(params), [params]);
  const cli = useMemo(() => toCliCommand(params), [params]);
  const opts = useMemo(() => toOptionsObject(params), [params]);
  const report = useMemo(() => renderReport(est), [est]);
  const presets = useMemo(() => getPresetLevels(), []);
  const presetTable = useMemo(() => presetComparisonTable(), []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Memory (KiB)</Label>
              <Input type="number" value={params.memoryKb}
                onChange={(e) => setParams({ ...params, memoryKb: Number(e.target.value) })}
                className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Iterations</Label>
              <Input type="number" value={params.iterations}
                onChange={(e) => setParams({ ...params, iterations: Number(e.target.value) })}
                className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Parallelism</Label>
              <Input type="number" value={params.parallelism}
                onChange={(e) => setParams({ ...params, parallelism: Number(e.target.value) })}
                className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hash length</Label>
              <Input type="number" value={params.hashLength}
                onChange={(e) => setParams({ ...params, hashLength: Number(e.target.value) })}
                className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Variant</Label>
              <select value={params.variant}
                onChange={(e) => setParams({ ...params, variant: e.target.value as Argon2Variant })}
                className="h-8 w-full text-xs rounded border bg-background px-2 cursor-pointer">
                {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Presets:</span>
            {presets.map((p) => (
              <button key={p.id} type="button"
                onClick={() => setParams({ ...p.params })}
                className="px-2 py-0.5 rounded-md text-[11px] border bg-background hover:bg-muted cursor-pointer">
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {est.warnings.length > 0 && (
        <ErrorBanner message={est.warnings.join(" ")} />
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[11px] ${TIER_COLOR[est.tier]}`}>{est.tier}</Badge>
            <Badge variant="outline" className="text-[11px]">Score: {est.securityScore}/100</Badge>
            <Badge variant="outline" className="text-[11px]">{est.estimatedMs.toFixed(1)} ms</Badge>
            <Badge variant="outline" className="text-[11px]">{est.memoryMb.toFixed(1)} MiB</Badge>
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => report} label="Copy report" />
              <DownloadButton getText={() => report} filename="argon2-report.txt" />
              <DownloadButton getText={() => presetTable} filename="argon2-presets.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Memory" value={`${params.memoryKb} KiB`} />
            <Cell label="Iterations" value={String(params.iterations)} />
            <Cell label="Parallelism" value={String(params.parallelism)} />
            <Cell label="Hash length" value={`${params.hashLength} B`} />
          </div>
          {est.notes.length > 0 && (
            <div className="text-[11px] text-muted-foreground border-t pt-2">
              {est.notes.map((n, i) => <div key={i}>• {n}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Tune for target time</Label>
          <div className="flex items-center gap-2">
            <Input type="number" value={targetMs}
              onChange={(e) => setTargetMs(Number(e.target.value))}
              className="text-xs h-8 w-32" />
            <span className="text-xs text-muted-foreground">ms</span>
            <button type="button"
              onClick={() => setParams(tuneForTime(targetMs, params.parallelism, params.memoryKb))}
              className="px-2 py-1 rounded-md text-xs border bg-background hover:bg-muted cursor-pointer">
              Tune
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Memory / time trade-off</Label>
          <div className="space-y-1 text-xs">
            {tradeoff.map((t, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 border-b last:border-0 py-1">
                <span className="font-mono">{(t.memoryKb / 1024).toFixed(1)} MiB</span>
                <span className="font-mono">{t.iterations} it</span>
                <span className="font-mono">{t.estimatedMs.toFixed(1)} ms</span>
                <span className="font-mono">score {t.securityScore}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">CLI command</Label>
          <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded overflow-x-auto">{cli}</pre>
          <CopyButton getText={() => cli} label="Copy CLI" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Options object (JSON)</Label>
          <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded overflow-x-auto">{opts}</pre>
          <CopyButton getText={() => opts} label="Copy JSON" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations are
            estimates based on a throughput model — no hashing is performed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}
