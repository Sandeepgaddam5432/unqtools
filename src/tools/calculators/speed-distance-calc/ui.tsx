"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  solveSdt,
  validateSdtInput,
  computeAcceleration,
  formatValue,
  historyToCsv,
  solveSdtBatch,
  SPEED_UNITS,
  DISTANCE_UNITS,
  TIME_UNITS,
  type SolveFor,
  type SpeedUnit,
  type DistanceUnit,
  type TimeUnit,
  type HistoryEntry,
} from "./logic";

export default function SpeedDistanceCalc() {
  const [solveFor, setSolveFor] = useState<SolveFor>("speed");
  const [speed, setSpeed] = useState<string>("");
  const [distance, setDistance] = useState<string>("100");
  const [time, setTime] = useState<string>("2");
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>("ms");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("m");
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("s");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Acceleration helper
  const [v0, setV0] = useState("0");
  const [v1, setV1] = useState("30");
  const [accTime, setAccTime] = useState("6");
  const [accResult, setAccResult] = useState<ReturnType<typeof computeAcceleration> | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("sdt-history");
      if (s) setHistory(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);

  const { result, error } = useMemo(() => {
    const input = {
      solveFor,
      speed: speed === "" ? undefined : Number(speed),
      distance: distance === "" ? undefined : Number(distance),
      time: time === "" ? undefined : Number(time),
      speedUnit,
      distanceUnit,
      timeUnit,
    };
    const v = validateSdtInput(input);
    if ("error" in v) return { result: null, error: v.error };
    const r = solveSdt(input);
    if ("error" in r) return { result: null, error: r.error };
    return { result: r, error: null as string | null };
  }, [solveFor, speed, distance, time, speedUnit, distanceUnit, timeUnit]);

  const onSave = useCallback(() => {
    if (!result || "error" in result) return;
    const entry: HistoryEntry = {
      ts: Date.now(),
      solveFor,
      speed: result.speed,
      distance: result.distance,
      time: result.time,
      formula: result.formula,
    };
    const next = [entry, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem("sdt-history", JSON.stringify(next)); } catch { /* ignore */ }
  }, [result, solveFor, history]);

  const runAcc = useCallback(() => {
    const r = computeAcceleration({
      initialSpeed: Number(v0),
      finalSpeed: Number(v1),
      time: Number(accTime),
      speedUnit,
      timeUnit,
    });
    setAccResult(r);
  }, [v0, v1, accTime, speedUnit, timeUnit]);

  const batchResult = useMemo(() => {
    const lines = (distance + "\n" + time).split("\n");
    if (lines.length < 2) return null;
    return null; // (placeholder for batch UI - omitted for brevity)
  }, [distance, time]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Solve for</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={solveFor === "speed" ? "default" : "outline"} onClick={() => setSolveFor("speed")}>Speed</Button>
            <Button size="sm" variant={solveFor === "distance" ? "default" : "outline"} onClick={() => setSolveFor("distance")}>Distance</Button>
            <Button size="sm" variant={solveFor === "time" ? "default" : "outline"} onClick={() => setSolveFor("time")}>Time</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Speed</Label>
              <Input type="number" disabled={solveFor === "speed"} value={speed} onChange={(e) => setSpeed(e.target.value)} />
              <select className="mt-1 h-8 w-full rounded-md border px-2 text-xs" value={speedUnit} onChange={(e) => setSpeedUnit(e.target.value as SpeedUnit)} disabled={solveFor === "speed"}>
                {SPEED_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Distance</Label>
              <Input type="number" disabled={solveFor === "distance"} value={distance} onChange={(e) => setDistance(e.target.value)} />
              <select className="mt-1 h-8 w-full rounded-md border px-2 text-xs" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value as DistanceUnit)} disabled={solveFor === "distance"}>
                {DISTANCE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input type="number" disabled={solveFor === "time"} value={time} onChange={(e) => setTime(e.target.value)} />
              <select className="mt-1 h-8 w-full rounded-md border px-2 text-xs" value={timeUnit} onChange={(e) => setTimeUnit(e.target.value as TimeUnit)} disabled={solveFor === "time"}>
                {TIME_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{result.formula}</p>
                <p className="text-2xl font-bold">
                  {solveFor === "speed" && formatValue(result.speed, result.speedUnit)}
                  {solveFor === "distance" && formatValue(result.distance, result.distanceUnit)}
                  {solveFor === "time" && formatValue(result.time, result.timeUnit)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{result.explanation}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={onSave}>Save</Button>
                <CopyButton getText={() => JSON.stringify(result, null, 2)} />
                <DownloadButton getText={() => JSON.stringify(result, null, 2)} filename="sdt-result.json" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">Speed: {formatValue(result.speed, result.speedUnit)}</Badge>
              <Badge variant="secondary">Distance: {formatValue(result.distance, result.distanceUnit)}</Badge>
              <Badge variant="secondary">Time: {formatValue(result.time, result.timeUnit)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Acceleration helper: a = (v₁ - v₀) / t</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground">v₀ (initial)</Label><Input type="number" value={v0} onChange={(e) => setV0(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">v₁ (final)</Label><Input type="number" value={v1} onChange={(e) => setV1(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Time</Label><Input type="number" value={accTime} onChange={(e) => setAccTime(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={runAcc}>Compute acceleration</Button>
          {accResult && !("error" in accResult) && (
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-xs text-muted-foreground">m/s²</p><p className="text-sm font-bold">{accResult.acceleration}</p></div>
              <div><p className="text-xs text-muted-foreground">km/h/s</p><p className="text-sm font-bold">{accResult.accelerationKmhPerS}</p></div>
              <div><p className="text-xs text-muted-foreground">mph/s</p><p className="text-sm font-bold">{accResult.accelerationMphPerS}</p></div>
            </div>
          )}
          {accResult && "error" in accResult && <ErrorBanner message={accResult.error} />}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History ({history.length})</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="sdt-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => { setHistory([]); try { localStorage.removeItem("sdt-history"); } catch { /* ignore */ } }}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.slice(0, 8).map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <Badge variant="outline">{h.solveFor}</Badge>
                  <span className="font-mono">{h.speed} / {h.distance} / {h.time}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser. History stored in localStorage only.</p></CardContent></Card>
    </div>
  );
}
