"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { applyTimestampMode, generatePowerShellScript, generateBashScript, entriesToCsv, formatTimestamp, type FileTimestampEntry, type Mode } from "./logic";

export default function BulkFileTimestampChanger() {
  const [entries, setEntries] = useState<FileTimestampEntry[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: "touch" });
  const [result, setResult] = useState<ReturnType<typeof applyTimestampMode> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptFormat, setScriptFormat] = useState<"powershell" | "bash">("bash");

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newEntries: FileTimestampEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      newEntries.push({
        fileName: f.name,
        originalMtime: f.lastModified,
        originalSize: f.size,
        warnings: [],
      });
    }
    setEntries(newEntries);
    setResult(null);
    setError(null);
  }, []);

  const apply = useCallback(() => {
    if (entries.length === 0) {
      setError("Pick files first.");
      return;
    }
    try {
      const r = applyTimestampMode(entries, mode);
      setResult(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [entries, mode]);

  const getScript = useCallback((): string => {
    if (!result) return "";
    return scriptFormat === "powershell" ? generatePowerShellScript(result.entries) : generateBashScript(result.entries);
  }, [result, scriptFormat]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" id="file-input" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick files</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEntries([]); setResult(null); setError(null); }}>Clear</Button>
            <Badge variant="outline">{entries.length} file(s)</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["touch", "absolute", "relative", "sequence", "random", "filenameRegex"] as const).map((k) => (
              <Button key={k} size="sm" variant={mode.kind === k ? "default" : "outline"} onClick={() => {
                if (k === "touch") setMode({ kind: "touch" });
                if (k === "absolute") setMode({ kind: "absolute", date: "2025-01-01T00:00" });
                if (k === "relative") setMode({ kind: "relative", days: 0, hours: 0, minutes: 0 });
                if (k === "sequence") setMode({ kind: "sequence", startISO: "2025-01-01T00:00", incrementMinutes: 10 });
                if (k === "random") setMode({ kind: "random", fromISO: "2024-01-01", toISO: "2024-12-31" });
                if (k === "filenameRegex") setMode({ kind: "filenameRegex", pattern: "(\\d{4}-\\d{2}-\\d{2})", dateFormat: "YYYY-MM-DD" });
              }}>{k}</Button>
            ))}
          </div>

          {mode.kind === "absolute" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target date (YYYY-MM-DDTHH:mm)</Label>
              <Input type="datetime-local" value={mode.date} onChange={(e) => setMode({ ...mode, date: e.target.value })} />
            </div>
          )}
          {mode.kind === "relative" && (
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs text-muted-foreground">+ Days</Label><Input type="number" value={mode.days} onChange={(e) => setMode({ ...mode, days: Number(e.target.value) })} /></div>
              <div><Label className="text-xs text-muted-foreground">+ Hours</Label><Input type="number" value={mode.hours} onChange={(e) => setMode({ ...mode, hours: Number(e.target.value) })} /></div>
              <div><Label className="text-xs text-muted-foreground">+ Minutes</Label><Input type="number" value={mode.minutes} onChange={(e) => setMode({ ...mode, minutes: Number(e.target.value) })} /></div>
            </div>
          )}
          {mode.kind === "sequence" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Start datetime</Label><Input type="datetime-local" value={mode.startISO} onChange={(e) => setMode({ ...mode, startISO: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Increment (minutes per file)</Label><Input type="number" value={mode.incrementMinutes} onChange={(e) => setMode({ ...mode, incrementMinutes: Number(e.target.value) })} /></div>
            </div>
          )}
          {mode.kind === "random" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={mode.fromISO} onChange={(e) => setMode({ ...mode, fromISO: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={mode.toISO} onChange={(e) => setMode({ ...mode, toISO: e.target.value })} /></div>
            </div>
          )}
          {mode.kind === "filenameRegex" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Filename regex (capture group 1 = date)</Label><Input value={mode.pattern} onChange={(e) => setMode({ ...mode, pattern: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Date format</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={mode.dateFormat} onChange={(e) => setMode({ ...mode, dateFormat: e.target.value as "YYYY-MM-DD" | "YYYYMMDD" | "DD-MM-YYYY" | "MM-DD-YYYY" })}>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2024-06-15)</option>
                  <option value="YYYYMMDD">YYYYMMDD (20240615)</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY (15-06-2024)</option>
                  <option value="MM-DD-YYYY">MM-DD-YYYY (06-15-2024)</option>
                </select>
              </div>
            </div>
          )}

          <Button size="sm" onClick={apply} disabled={entries.length === 0}>Apply mode → preview</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{result.summary.total}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Changed</p><p className="text-lg font-bold text-emerald-500">{result.summary.changed}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Unchanged</p><p className="text-lg font-bold">{result.summary.unchanged}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Failed</p><p className="text-lg font-bold text-red-500">{result.summary.failed}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Files preview (before → after)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80 sticky top-0">
                    <tr><th className="p-2 text-left">File</th><th className="p-2 text-left">Original</th><th className="p-2 text-left">New</th></tr>
                  </thead>
                  <tbody>
                    {result.entries.map((e, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{e.fileName}</td>
                        <td className="p-2 text-muted-foreground">{formatTimestamp(e.originalMtime)}</td>
                        <td className="p-2 font-bold">{e.newMtime ? formatTimestamp(e.newMtime) : "(unchanged)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-xs text-muted-foreground">Export script:</Label>
                <Button size="sm" variant={scriptFormat === "bash" ? "default" : "outline"} onClick={() => setScriptFormat("bash")}>Bash (touch)</Button>
                <Button size="sm" variant={scriptFormat === "powershell" ? "default" : "outline"} onClick={() => setScriptFormat("powershell")}>PowerShell</Button>
                <CopyButton getText={getScript} />
                <DownloadButton getText={getScript} filename={scriptFormat === "bash" ? "set-timestamps.sh" : "set-timestamps.ps1"} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Export CSV:</Label>
                <DownloadButton getText={() => entriesToCsv(result.entries)} filename="timestamps.csv" mime="text/csv" />
              </div>
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md max-h-[200px] overflow-auto"><code>{getScript()}</code></pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally. The tool generates a script you can run on your machine — files are NOT modified in-browser (browser security prevents this for most files).</p></CardContent></Card>
    </div>
  );
}
