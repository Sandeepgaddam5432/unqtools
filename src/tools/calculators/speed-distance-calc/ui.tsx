"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { solveSdt, validateSdtInput, type SolveFor } from "./logic";

export default function SpeedDistanceCalc() {
  const [solveFor, setSolveFor] = useState<SolveFor>("speed");
  const [speed, setSpeed] = useState<string>("");
  const [distance, setDistance] = useState<string>("100");
  const [time, setTime] = useState<string>("2");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const input = {
      solveFor,
      speed: speed === "" ? undefined : Number(speed),
      distance: distance === "" ? undefined : Number(distance),
      time: time === "" ? undefined : Number(time),
    };
    const v = validateSdtInput(input);
    if ("error" in v) { setError(v.error); return null; }
    const r = solveSdt(input);
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [solveFor, speed, distance, time]);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Speed (units/hr)</Label>
              <input type="number" disabled={solveFor === "speed"} className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50" value={speed} onChange={(e) => setSpeed(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Distance (units)</Label>
              <input type="number" disabled={solveFor === "distance"} className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Time (hours)</Label>
              <input type="number" disabled={solveFor === "time"} className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{result.formula}</p>
                <p className="text-2xl font-bold">
                  {solveFor === "speed" && `${result.speed.toFixed(4)} units/hr`}
                  {solveFor === "distance" && `${result.distance.toFixed(4)} units`}
                  {solveFor === "time" && `${result.time.toFixed(4)} hours`}
                </p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => JSON.stringify(result, null, 2)} />
                <DownloadButton getText={() => JSON.stringify(result, null, 2)} filename="sdt-result.json" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
