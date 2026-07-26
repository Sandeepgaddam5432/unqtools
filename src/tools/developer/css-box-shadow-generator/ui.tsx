"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generateCSS, parseCSS, defaultLayer, presetLayers,
  exportJSON, importJSON, randomLayer, type LayerSpec,
} from "./logic";

export default function CSSBoxShadowGenerator() {
  const [layers, setLayers] = useState<LayerSpec[]>([defaultLayer()]);
  const [important, setImportant] = useState(false);
  const [previewText, setPreviewText] = useState("Preview text");
  const [darkPreview, setDarkPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const css = generateCSS({ layers, important });

  const update = useCallback((idx: number, patch: Partial<LayerSpec>) => {
    setLayers((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }, []);

  const addLayer = useCallback(() => {
    setLayers((prev) => [...prev, defaultLayer()]);
  }, []);

  const removeLayer = useCallback((idx: number) => {
    setLayers((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const applyPreset = useCallback((name: string) => {
    const presets = presetLayers();
    if (presets[name]) setLayers(presets[name]);
  }, []);

  const importCss = useCallback((cssStr: string) => {
    setError(null);
    const parsed = parseCSS(cssStr);
    if (!parsed) {
      setError("Could not parse CSS. Expected format: box-shadow: ...;");
      return;
    }
    setLayers(parsed);
  }, []);

  const randomize = useCallback(() => {
    setLayers((prev) => prev.map(() => randomLayer()));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-medium">Layers</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addLayer}>Add layer</Button>
              <Button size="sm" variant="outline" onClick={randomize}>Randomize</Button>
            </div>
          </div>
          {layers.map((l, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Layer {i + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => removeLayer(i)} disabled={layers.length === 1}>×</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Offset X</Label>
                  <Input type="number" value={l.offsetX} onChange={(e) => update(i, { offsetX: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Offset Y</Label>
                  <Input type="number" value={l.offsetY} onChange={(e) => update(i, { offsetY: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Blur</Label>
                  <Input type="number" value={l.blur} onChange={(e) => update(i, { blur: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Spread</Label>
                  <Input type="number" value={l.spread} onChange={(e) => update(i, { spread: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Color</Label>
                  <Input type="text" value={l.color} onChange={(e) => update(i, { color: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id={`inset-${i}`} checked={l.inset} onChange={(e) => update(i, { inset: e.target.checked })} />
                  <Label htmlFor={`inset-${i}`} className="text-xs cursor-pointer">Inset</Label>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Presets</span>
            <Badge variant="outline">{Object.keys(presetLayers()).length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex flex-wrap gap-2">
          {Object.keys(presetLayers()).map((name) => (
            <Button key={name} size="sm" variant="outline" onClick={() => applyPreset(name)}>{name}</Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Live Preview</span>
            <div className="flex gap-2 items-center">
              <input type="checkbox" id="important" checked={important} onChange={(e) => setImportant(e.target.checked)} />
              <Label htmlFor="important" className="text-xs cursor-pointer">!important</Label>
              <input type="checkbox" id="dark-preview" checked={darkPreview} onChange={(e) => setDarkPreview(e.target.checked)} />
              <Label htmlFor="dark-preview" className="text-xs cursor-pointer">Dark BG</Label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Preview text" />
          <div className={`p-8 rounded-md flex items-center justify-center ${darkPreview ? "bg-slate-900" : "bg-slate-100"}`} style={{ cssText: css }}>
            <span className={`text-lg font-semibold ${darkPreview ? "text-white" : "text-slate-900"}`}>{previewText}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Generated CSS</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="font-mono text-xs bg-muted/30 p-3 rounded break-all">{css}</div>
          <div className="flex gap-2 flex-wrap">
            <CopyButton getText={() => css} label="Copy CSS" />
            <DownloadButton getText={() => exportJSON({ layers, important })} filename="{slug}.json" mime="application/json" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Import CSS</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-2">
          <Input placeholder="{css_property}: 1px 2px 3px #000;" onKeyDown={(e) => { if (e.key === "Enter") importCss((e.target as HTMLInputElement).value); }} />
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>
    </div>
  );
}
