"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState } from "../../_shared";
import { getAllRates, getRateByHz, planConversion } from "./logic";

const QUALITY_COLOR: Record<string, string> = {
  low: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  studio: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default function SampleRateConverter() {
  const rates = useMemo(() => getAllRates(), []);
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<number>(44100);

  const current = useMemo(() => (selected !== null ? getRateByHz(selected) : null), [selected]);
  const conversion = useMemo(() => (selected ? planConversion(selected, target) : null), [selected, target]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Pick a source sample rate</Label>
          <div className="flex flex-wrap gap-2">
            {rates.map((r) => (
              <button
                key={r.hz}
                type="button"
                onClick={() => setSelected(r.hz)}
                className={`px-3 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                  selected === r.hz ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                <span className="font-medium">{r.khz}</span>
                <span className="text-muted-foreground ml-1">— {r.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{current.khz}</Badge>
              <Badge variant="outline" className={`text-xs ${QUALITY_COLOR[current.quality]}`}>{current.quality}</Badge>
              <Badge variant="outline" className="text-xs">Nyquist: {current.nyquist} Hz</Badge>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40">
                <span className="text-muted-foreground">Sample rate</span>
                <code className="font-mono">{current.hz} Hz</code>
                <CopyButton getText={() => String(current.hz)} label="" size="icon-sm" />
              </div>
              <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40">
                <span className="text-muted-foreground">Bit depths</span>
                <code className="font-mono">{current.bitsPerSample.join(", ")}-bit</code>
                <CopyButton getText={() => current.bitsPerSample.join(", ")} label="" size="icon-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Common use cases</Label>
              <div className="flex flex-wrap gap-1">
                {current.useCases.map((u) => (
                  <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {current && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Resample to target</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Target sample rate (Hz)</Label>
                <Input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(parseInt(e.target.value, 10) || 0)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {[8000, 16000, 22050, 44100, 48000, 96000, 192000].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="text-xs text-primary hover:underline cursor-pointer"
                    onClick={() => setTarget(h)}
                  >
                    {h / 1000}k
                  </button>
                ))}
              </div>
            </div>
            {conversion && (
              <div className="space-y-1">
                <div className="grid grid-cols-[140px_1fr] gap-2 items-center text-xs py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Ratio</span>
                  <code className="font-mono">{conversion.ratio.toFixed(4)}</code>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2 items-center text-xs py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Operation</span>
                  <Badge variant="outline" className="text-xs">{conversion.resampleQuality}</Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-1">{conversion.qualityNote}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!current && (
        <EmptyState
          title="Pick a sample rate to explore"
          hint="Reference table for telephony, CD, DVD, and studio-grade audio sample rates, plus a resampling planner."
        />
      )}
    </div>
  );
}
