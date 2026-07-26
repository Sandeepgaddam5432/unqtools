"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllFormats,
  getFormatById,
  calculateSNR,
  classifySNR,
  dbfsToLinear,
  recommendDither,
  recommendBitDepth,
  validateSNRInputs,
  exportFormatsAsCSV,
  formatCard,
  findFormatsForSNR,
} from "./logic";

export default function AudioNoiseFloorRef() {
  const formats = useMemo(() => getAllFormats(), []);
  const [signalDbfs, setSignalDbfs] = useState<string>("-20");
  const [floorDbfs, setFloorDbfs] = useState<string>("-90");
  const [targetSNR, setTargetSNR] = useState<string>("96");
  const [fromBit, setFromBit] = useState<string>("24");
  const [toBit, setToBit] = useState<string>("16");
  const [error, setError] = useState<string>("");

  const sig = Number(signalDbfs);
  const floor = Number(floorDbfs);
  const snr = Number.isNaN(sig) || Number.isNaN(floor) ? null : calculateSNR(sig, floor);
  const cls = snr !== null ? classifySNR(snr) : null;
  const warnings = snr !== null ? validateSNRInputs(sig, floor) : [];
  const bitRec = useMemo(() => {
    const t = Number(targetSNR);
    if (Number.isNaN(t)) return null;
    return recommendBitDepth(t);
  }, [targetSNR]);
  const dither = recommendDither(Number(fromBit) || 0, Number(toBit) || 0);
  const candidates = useMemo(() => {
    const t = Number(targetSNR);
    if (Number.isNaN(t)) return [];
    return findFormatsForSNR(t);
  }, [targetSNR]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-semibold">SNR calculator</Label>
            <DownloadButton getText={() => exportFormatsAsCSV()} filename="noise-floor-formats.csv" mime="text/csv" label="CSV" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Signal level (dBFS)</Label>
              <input
                type="number"
                step="0.1"
                value={signalDbfs}
                onChange={(e) => setSignalDbfs(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Noise floor (dBFS)</Label>
              <input
                type="number"
                step="0.1"
                value={floorDbfs}
                onChange={(e) => setFloorDbfs(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
            </div>
          </div>
          {snr !== null && cls && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                SNR: {snr.toFixed(1)} dB
              </Badge>
              <Badge variant="outline" className={`text-xs border-${cls.color}-500/30 bg-${cls.color}-500/10 text-${cls.color}-700`}>
                {cls.rating}
              </Badge>
              {warnings.map((w, i) => (
                <span key={i} className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠ {w}
                </span>
              ))}
            </div>
          )}
          {snr !== null && (
            <p className="text-xs text-muted-foreground">
              Linear signal amplitude: {dbfsToLinear(sig).toFixed(4)} · Linear noise: {dbfsToLinear(floor).toFixed(6)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Format noise floor table</Label>
          <div className="space-y-1">
            {formats.map((f) => (
              <div key={f.id} className="grid grid-cols-[1fr_80px_80px_80px_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="font-medium">{f.name}</span>
                <code className="font-mono text-muted-foreground">{f.theoreticalFloorDbfs.toFixed(1)}</code>
                <code className="font-mono text-muted-foreground">{f.typicalFloorDbfs.toFixed(1)}</code>
                <code className="font-mono">{f.dynamicRangeDb} dB</code>
                <CopyButton getText={() => formatCard(f)} label="" size="icon-sm" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Columns: theoretical floor · typical floor · dynamic range (dBFS / dBFS / dB)</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Bit depth recommendation</Label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Target SNR (dB)</Label>
            <input
              type="number"
              value={targetSNR}
              onChange={(e) => setTargetSNR(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
            />
          </div>
          {bitRec && (
            <div className="text-xs space-y-1">
              <p>
                Recommend: <span className="font-medium">{bitRec.bitDepth}-bit</span> ({bitRec.format})
              </p>
              <p className="text-muted-foreground">{bitRec.reason}</p>
              {candidates.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {candidates.map((c) => (
                    <Badge key={c.id} variant="outline" className="text-[10px]">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Dither recommendation</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From bit depth</Label>
              <input
                type="number"
                value={fromBit}
                onChange={(e) => setFromBit(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To bit depth</Label>
              <input
                type="number"
                value={toBit}
                onChange={(e) => setToBit(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
            </div>
          </div>
          <p className="text-xs">{dither}</p>
        </CardContent>
      </Card>
    </div>
  );
}
