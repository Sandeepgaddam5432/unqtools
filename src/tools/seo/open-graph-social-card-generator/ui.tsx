"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { CARD_SIZES, DEFAULT_CONFIG, drawCard, downloadCanvas, canvasToDataUrl, saveConfig, loadConfig, generateOgTags, type CardConfig, type CardSize } from "./logic";

export default function OpenGraphSocialCardGenerator() {
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CONFIG);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMetaTags, setShowMetaTags] = useState(false);
  const [metaTags, setMetaTags] = useState("");

  useEffect(() => {
    const loaded = loadConfig();
    if (loaded) setConfig(loaded);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) { setError("Canvas not supported"); return; }
    try {
      drawCard(ctx, config);
      setError(null);
    } catch (e) {
      setError(`Draw failed: ${(e as Error).message}`);
    }
  }, [config]);

  const update = useCallback((patch: Partial<CardConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  const handleDownload = useCallback((format: "png" | "jpeg") => {
    if (!canvasRef.current) return;
    const size = CARD_SIZES.find((s) => s.id === config.size)!;
    downloadCanvas(canvasRef.current, `social-card-${size.width}x${size.height}.${format}`, format);
  }, [config.size]);

  const handleCopyDataUrl = useCallback(async () => {
    if (!canvasRef.current) return;
    const url = canvasToDataUrl(canvasRef.current);
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* ignore */ }
  }, []);

  const generateMeta = useCallback(() => {
    const size = CARD_SIZES.find((s) => s.id === config.size)!;
    const tags = generateOgTags("https://example.com/page", config.title, config.subtitle, `https://example.com/card-${size.width}x${size.height}.png`);
    setMetaTags(tags);
    setShowMetaTags(true);
  }, [config]);

  const size = CARD_SIZES.find((s) => s.id === config.size)!;
  const previewScale = 600 / size.width;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Card size</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.size} onChange={(e) => update({ size: e.target.value as CardSize })}>
                {CARD_SIZES.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.width}×{s.height})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Template</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.template} onChange={(e) => update({ template: e.target.value as CardConfig["template"] })}>
                <option value="minimal">Minimal</option>
                <option value="centered-bold">Centered Bold</option>
                <option value="left-bottom">Left-bottom</option>
                <option value="gradient-overlay">Gradient Overlay</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Brand name</Label>
              <Input value={config.brandName} onChange={(e) => update({ brandName: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={config.title} onChange={(e) => update({ title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Subtitle</Label>
              <Input value={config.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Background color</Label><Input type="color" value={config.backgroundColor} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-9" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Text color</Label><Input type="color" value={config.textColor} onChange={(e) => update({ textColor: e.target.value })} className="h-9" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Accent color (brand)</Label><Input type="color" value={config.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="h-9" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Gradient from (optional)</Label><Input type="color" value={config.gradientFrom ?? "#000000"} onChange={(e) => update({ gradientFrom: e.target.value })} className="h-9" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Gradient to (optional)</Label><Input type="color" value={config.gradientTo ?? "#1f2937"} onChange={(e) => update({ gradientTo: e.target.value })} className="h-9" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Gradient angle</Label><Input type="number" min="0" max="360" value={config.gradientAngle} onChange={(e) => update({ gradientAngle: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Font family</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.fontFamily} onChange={(e) => update({ fontFamily: e.target.value as CardConfig["fontFamily"] })}>
                <option value="inter">Inter</option>
                <option value="helvetica">Helvetica</option>
                <option value="georgia">Georgia</option>
                <option value="courier">Courier</option>
                <option value="system-ui">System UI</option>
                <option value="arial">Arial</option>
                <option value="verdana">Verdana</option>
                <option value="tahoma">Tahoma</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Title font size</Label><Input type="number" min="20" max="200" value={config.titleFontSize} onChange={(e) => update({ titleFontSize: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Subtitle font size</Label><Input type="number" min="12" max="80" value={config.subtitleFontSize} onChange={(e) => update({ subtitleFontSize: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Text align</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.textAlign} onChange={(e) => update({ textAlign: e.target.value as CardConfig["textAlign"] })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Vertical align</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.verticalAlign} onChange={(e) => update({ verticalAlign: e.target.value as CardConfig["verticalAlign"] })}>
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Padding</Label><Input type="number" min="0" max="300" value={config.padding} onChange={(e) => update({ padding: Number(e.target.value) })} /></div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => handleDownload("png")}>Download PNG</Button>
            <Button size="sm" variant="outline" onClick={() => handleDownload("jpeg")}>Download JPEG</Button>
            <Button size="sm" variant="outline" onClick={handleCopyDataUrl}>Copy data URL</Button>
            <Button size="sm" variant="ghost" onClick={generateMeta}>Generate meta tags</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfig(DEFAULT_CONFIG)}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Live preview ({size.width}×{size.height} — {size.ratio})</CardTitle></CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <canvas ref={canvasRef} style={{ width: 600, height: 600 * size.height / size.width }} className="border border-border rounded-md max-w-full" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Preview shown at {Math.round(previewScale * 100)}% — actual export is full {size.width}×{size.height}.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {size.platforms.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
          </div>
        </CardContent>
      </Card>

      {showMetaTags && metaTags && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Generated OG + Twitter meta tags</CardTitle>
              <CopyButton getText={() => metaTags} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{metaTags}</code></pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all rendering happens locally via Canvas API. No file leaves your browser. Config auto-saved to localStorage.</p></CardContent></Card>
    </div>
  );
}
