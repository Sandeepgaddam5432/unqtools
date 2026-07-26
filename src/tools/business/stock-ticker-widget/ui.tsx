"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { generateWidget, buildPreviewPage, listPopularSymbols, describeConfig, type StockWidgetConfig, type WidgetResult } from "./logic";

const POPULAR = listPopularSymbols();

export default function StockTickerWidget() {
  const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT"]);
  const [custom, setCustom] = useState("");
  const [refresh, setRefresh] = useState("60");
  const [width, setWidth] = useState("320");
  const [height, setHeight] = useState("220");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState("#0ea5e9");
  const [showChange, setShowChange] = useState(true);
  const [result, setResult] = useState<WidgetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback((sym: string) => {
    setSymbols((prev) => prev.includes(sym) ? prev.filter((x) => x !== sym) : prev.length < 10 ? [...prev, sym] : prev);
  }, []);

  const addCustom = useCallback(() => {
    const s = custom.trim().toUpperCase();
    if (!s) return;
    if (symbols.length >= 10) return;
    if (!symbols.includes(s)) setSymbols((prev) => [...prev, s]);
    setCustom("");
  }, [custom, symbols]);

  const run = useCallback(() => {
    const cfg: StockWidgetConfig = {
      symbols,
      refreshSeconds: Number(refresh) || 60,
      width: Number(width) || 320,
      height: Number(height) || 220,
      theme,
      accentColor: accent,
      showChange,
    };
    const r = generateWidget(cfg);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [symbols, refresh, width, height, theme, accent, showChange]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Symbols ({symbols.length}/10)</Label>
            <div className="flex flex-wrap gap-1">
              {POPULAR.map((s) => (
                <Button key={s} size="sm" variant={symbols.includes(s) ? "default" : "outline"} onClick={() => toggle(s)}>{s}</Button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <Input value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} placeholder="Add custom symbol (e.g. NVDA)" aria-label="Custom symbol" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
              <Button size="sm" variant="outline" onClick={addCustom}>Add</Button>
            </div>
            {symbols.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {symbols.map((s) => <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => toggle(s)}>{s} ×</Badge>)}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Refresh (sec)</Label>
              <Input type="number" min={30} max={3600} value={refresh} onChange={(e) => setRefresh(e.target.value)} aria-label="Refresh seconds" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Width (px)</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} aria-label="Width" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Height (px)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} aria-label="Height" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Theme:</Label>
              <Button size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>Light</Button>
              <Button size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>Dark</Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Accent:</Label>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-10 rounded border border-input" aria-label="Accent colour" />
            </div>
            <Button size="sm" variant={showChange ? "default" : "outline"} onClick={() => setShowChange((v) => !v)} aria-pressed={showChange}>Show change</Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Generate widget</Button>
            <Button size="sm" variant="ghost" onClick={() => { setSymbols(["AAPL", "MSFT", "GOOGL"]); setRefresh("60"); setTheme("light"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Symbols</p>
              <p className="text-lg font-bold">{result.config.symbols.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Snippet size</p>
              <p className="text-lg font-bold">{result.estimatedBytes.toLocaleString()} B</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Refresh</p>
              <p className="text-lg font-bold">{result.config.refreshSeconds}s</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Live preview</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex justify-center">
                <iframe
                  title="Stock widget preview"
                  className="rounded-md border border-border"
                  style={{ width: "100%", maxWidth: (result.config.width ?? 320) + 40, height: (result.config.height ?? 220) + 60 }}
                  srcDoc={buildPreviewPage(result)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Embed code</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3 max-h-80 overflow-auto">{result.html}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Copy or download the embed</p>
              <div className="flex gap-2">
                <CopyButton getText={() => result.html} label="Copy HTML" />
                <CopyButton getText={() => describeConfig(result.config)} label="Copy config" />
                <DownloadButton getText={() => result.html} filename="stock-widget.html" mime="text/html" />
                <DownloadButton getText={() => buildPreviewPage(result)} filename="stock-widget-preview.html" mime="text/html" label="Download preview" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
