"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getAllStandards,
  getStandardById,
  gainChange,
  applyGain,
  lufsToRmsDb,
  recommendedTruePeakMargin,
  compareLoudness,
  validateLufs,
  interpretLRA,
  formatStandardCard,
  exportStandardsCSV,
  spotifyTurnDown,
  suggestMasterTarget,
  dynamicsPreservationScore,
  crestFactor,
  type LoudnessStandard,
} from "./logic";

export default function AudioLufsReference() {
  const standards = useMemo(() => getAllStandards(), []);
  const [selectedId, setSelectedId] = useState<string>("spotify");
  const [currentLufs, setCurrentLufs] = useState<string>("-10");
  const [lra, setLra] = useState<string>("7");
  const [peak, setPeak] = useState<string>("-0.5");
  const [error, setError] = useState<string>("");

  const current = getStandardById(selectedId);
  const lufsN = Number(currentLufs);
  const lraN = Number(lra);
  const peakN = Number(peak);

  if (!current) {
    return <ErrorBanner message="Selected standard not found." />;
  }

  const offset = gainChange(lufsN, current.targetLufs);
  const newLufs = applyGain(lufsN, offset);
  const rmsApprox = lufsToRmsDb(lufsN);
  const turnDown = spotifyTurnDown(lufsN);
  const warnings = validateLufs(lufsN);
  const lraInterp = interpretLRA(lraN);
  const dynScore = dynamicsPreservationScore(lraN);
  const crest = crestFactor(peakN, rmsApprox);
  const tpMargin = recommendedTruePeakMargin(current.targetLufs);
  const allOffsets = compareLoudness(lufsN);

  const summary = [
    { label: "Standard", value: current.name },
    { label: "Platform", value: current.platform },
    { label: "Target LUFS", value: `${current.targetLufs}` },
    { label: "True-peak limit", value: `${current.truePeakDbfs} dBFS` },
    { label: "LRA tolerance", value: current.lraRange },
    { label: "Region", value: current.region },
    { label: "Enforcement", value: current.enforcement },
    { label: "Recommended TP margin", value: `${tpMargin} dBFS` },
  ];

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Select a loudness standard</Label>
          <div className="flex flex-wrap gap-2">
            {standards.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`px-3 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                  selectedId === s.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {s.name}
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
              <p className="text-xs text-muted-foreground">{current.notes}</p>
            </div>
            <div className="flex gap-2">
              <CopyButton getText={() => formatStandardCard(current)} label="Copy card" />
              <DownloadButton getText={() => exportStandardsCSV()} filename="lufs-standards.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="space-y-1">
            {summary.map((r) => (
              <div key={r.label} className="grid grid-cols-[180px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <code className="font-mono">{r.value}</code>
                <CopyButton getText={() => String(r.value)} label="" size="icon-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Your master</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Integrated LUFS</Label>
              <input type="number" step="0.1" value={currentLufs} onChange={(e) => setCurrentLufs(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">LRA (LU)</Label>
              <input type="number" step="0.1" value={lra} onChange={(e) => setLra(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">True-peak (dBFS)</Label>
              <input type="number" step="0.1" value={peak} onChange={(e) => setPeak(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="text-xs space-y-1">
            <p>
              Required gain to hit {current.name}: <span className="font-mono">{offset > 0 ? "+" : ""}{offset.toFixed(2)} dB</span> → new LUFS <span className="font-mono">{newLufs.toFixed(2)}</span>
            </p>
            <p>
              RMS (approx): <span className="font-mono">{rmsApprox.toFixed(2)} dB</span> · Crest factor: <span className="font-mono">{crest.toFixed(2)} dB</span>
            </p>
            <p className="text-muted-foreground">
              LRA interpretation: <span className="text-foreground">{lraInterp}</span> (dynamics preserved {dynScore}%)
            </p>
            {turnDown.willTurnDown && (
              <p className="text-orange-700 dark:text-orange-400">
                ⚠ Spotify will turn your master down by {turnDown.amountDb.toFixed(1)} dB.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Loudness comparison across all standards</Label>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] uppercase text-muted-foreground pb-1 border-b border-border/40">
              <span>Standard</span>
              <span>Target</span>
              <span>Offset</span>
            </div>
            {allOffsets.map((o) => (
              <div key={o.standard} className="grid grid-cols-[1fr_80px_80px] gap-2 text-xs py-1 border-b border-border/40 last:border-0 items-center">
                <span>{o.standard}</span>
                <code className="font-mono">{o.target}</code>
                <Badge variant="outline" className={`text-[10px] justify-self-start ${o.offset < 0 ? "border-orange-500/30 bg-orange-500/10 text-orange-700" : ""}`}>
                  {o.offset > 0 ? "+" : ""}{o.offset.toFixed(1)}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Suggested targets — streaming: {suggestMasterTarget("streaming")} · EU broadcast: {suggestMasterTarget("broadcast-eu")} · club: {suggestMasterTarget("club")} LUFS
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
