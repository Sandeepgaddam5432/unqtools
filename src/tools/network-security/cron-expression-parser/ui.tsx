"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { describeCron, nextRuns } from "./logic";

export default function CronExpressionParser() {
  const [expr, setExpr] = useState("0 9 * * 1-5");
  const [count, setCount] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const { description, runs } = useMemo(() => {
    const desc = describeCron(expr);
    const r = nextRuns(expr, new Date(), count);
    if ("error" in r) { setError(r.error); return { description: desc, runs: [] as Date[] }; }
    setError(null);
    return { description: desc, runs: r };
  }, [expr, count]);

  const formattedRuns = runs.map((d) => d.toISOString());

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Cron expression</Label>
          <input type="text" className="w-full rounded-md border px-2 py-2 text-sm font-mono" value={expr} onChange={(e) => setExpr(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setExpr("0 * * * *")}>Every hour</Button>
            <Button size="sm" variant="ghost" onClick={() => setExpr("*/15 * * * *")}>Every 15 min</Button>
            <Button size="sm" variant="ghost" onClick={() => setExpr("0 9 * * 1-5")}>Weekdays 9am</Button>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Next N runs: {count}</Label>
            <input type="range" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => description} />
              <DownloadButton getText={() => `${description}\n\nNext ${count} runs:\n${formattedRuns.join("\n")}`} filename="cron.txt" />
            </div>
          </div>
          <p className="text-sm font-mono">{description}</p>
        </CardContent>
      </Card>

      {runs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Next runs (UTC)</Label>
            <ul className="text-sm font-mono space-y-1">
              {formattedRuns.map((d, i) => (<li key={i}>{d}</li>))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
