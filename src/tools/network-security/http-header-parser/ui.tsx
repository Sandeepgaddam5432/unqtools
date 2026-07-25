"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { parseHeaders, analyzeHeaders, formatReport } from "./logic";

const SAMPLE = `Server: nginx/1.21.0
Content-Type: text/html
Content-Length: 1024
Date: Mon, 01 Jan 2024 00:00:00 GMT`;

export default function HttpHeaderParser() {
  const [raw, setRaw] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => {
    try { setError(null); return analyzeHeaders(parseHeaders(raw)); }
    catch (e) { setError((e as Error).message); return null; }
  }, [raw]);

  const report = analysis ? formatReport(analysis) : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">HTTP response headers</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[150px] font-mono" value={raw} onChange={(e) => setRaw(e.target.value)} />
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {analysis && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{analysis.headers.length} headers · {analysis.recommendationCount} recommendations</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="header-analysis.txt" />
              </div>
            </div>
            <div className="space-y-1">
              {analysis.issues.map((i, idx) => (
                <div key={idx} className={`text-xs rounded-md p-2 ${i.level === "critical" ? "bg-destructive/10 text-destructive" : i.level === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                  [{i.level.toUpperCase()}] {i.message}
                </div>
              ))}
              {analysis.issues.length === 0 && <p className="text-xs text-green-600">✅ No security recommendations</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
