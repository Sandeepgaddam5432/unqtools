"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { generateWidget, buildPreviewPage, listKnownCoins, type CryptoWidgetConfig, type WidgetResult } from "./logic";

const ALL_COINS = listKnownCoins();

export default function CryptoPriceWidget() {
  const [selected, setSelected] = useState<string[]>(["bitcoin", "ethereum"]);
  const [currency, setCurrency] = useState("usd");
  const [refresh, setRefresh] = useState("60");
  const [width, setWidth] = useState("320");
  const [height, setHeight] = useState("240");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState("#3b82f6");
  const [showChange, setShowChange] = useState(true);
  const [result, setResult] = useState<WidgetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 10 ? [...prev, id] : prev);
  }, []);

  const run = useCallback(() => {
    const cfg: CryptoWidgetConfig = {
      coins: selected,
      currency,
      refreshSeconds: Number(refresh) || 60,
      width: Number(width) || 320,
      height: Number(height) || 240,
      theme,
      accentColor: accent,
      showChange,
    };
    const r = generateWidget(cfg);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [selected, currency, refresh, width, height, theme, accent, showChange]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Coins ({selected.length}/10)</Label>
            <div className="flex flex-wrap gap-1">
              {ALL_COINS.map((c) => (
                <Button key={c.id} size="sm" variant={selected.includes(c.id) ? "default" : "outline"} onClick={() => toggle(c.id)}>{c.symbol}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency" maxLength={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Refresh (sec)</Label>
              <Input type="number" min={15} max={3600} value={refresh} onChange={(e) => setRefresh(e.target.value)} aria-label="Refresh seconds" />
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
            <Button size="sm" variant={showChange ? "default" : "outline"} onClick={() => setShowChange((v) => !v)} aria-pressed={showChange}>Show 24h change</Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Generate widget</Button>
            <Button size="sm" variant="ghost" onClick={() => { setSelected(["bitcoin", "ethereum", "solana"]); setCurrency("usd"); setRefresh("60"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Coins</p>
              <p className="text-lg font-bold">{result.config.coins.length}</p>
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
                  title="Crypto widget preview"
                  className="rounded-md border border-border"
                  style={{ width: "100%", maxWidth: (result.config.width ?? 320) + 40, height: (result.config.height ?? 240) + 60 }}
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
                <DownloadButton getText={() => result.html} filename="crypto-widget.html" mime="text/html" />
                <DownloadButton getText={() => buildPreviewPage(result)} filename="crypto-widget-preview.html" mime="text/html" label="Download preview" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
