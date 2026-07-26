"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  parseHex, toHex, blend, blendWithAlpha, generateShadesTints,
  analogous, harmony, palette, colorsToCsv, toCssGradient,
  BLEND_MODES, type BlendMode,
} from "./logic";

export default function ImageColorMixerUI() {
  const [colorA, setColorA] = useState("#3366ff");
  const [colorB, setColorB] = useState("#ff9933");
  const [mode, setMode] = useState<BlendMode>("multiply");
  const [alpha, setAlpha] = useState(0.5);
  const [paletteType, setPaletteType] = useState<"mono" | "pastel" | "vibrant" | "muted">("vibrant");
  const [error, setError] = useState("");

  const a = useMemo(() => parseHex(colorA), [colorA]);
  const b = useMemo(() => parseHex(colorB), [colorB]);

  const blended = useMemo(() => {
    if (!a || !b) return null;
    return blend(a, b, mode);
  }, [a, b, mode]);

  const alphaBlended = useMemo(() => {
    if (!a || !b) return null;
    return blendWithAlpha(a, b, alpha);
  }, [a, b, alpha]);

  const shadesTints = useMemo(() => (a ? generateShadesTints(a, 5) : null), [a]);
  const analog = useMemo(() => (a ? analogous(a, 5, 30) : []), [a]);
  const harmonies = useMemo(() => (a ? harmony(a, "triadic") : []), [a]);
  const generatedPalette = useMemo(() => (a ? palette(a, paletteType, 6) : []), [a, paletteType]);

  const onSwap = useCallback(() => {
    setColorA(colorB);
    setColorB(colorA);
  }, [colorA, colorB]);

  const cssGradient = useMemo(() => toCssGradient(generatedPalette), [generatedPalette]);
  const csv = useMemo(() => colorsToCsv(generatedPalette), [generatedPalette]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Color A (base)</Label>
              <Input value={colorA} onChange={(e) => { setColorA(e.target.value); setError(""); }} placeholder="#000000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Color B (blend)</Label>
              <Input value={colorB} onChange={(e) => { setColorB(e.target.value); setError(""); }} placeholder="#ffffff" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Label className="text-xs text-muted-foreground">Blend mode</Label>
            <select
              className="text-xs px-2 py-1.5 rounded-md border border-input bg-background"
              value={mode}
              onChange={(e) => setMode(e.target.value as BlendMode)}
            >
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSwap}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
            >
              Swap A/B
            </button>
            <CopyButton getText={() => (blended ? toHex(blended) : "")} disabled={!blended} label="Copy blended" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Blend result ({mode})</p>
            {blended ? (
              <>
                <div className="h-16 rounded-md border" style={{ background: toHex(blended) }} />
                <p className="text-xs font-mono">{toHex(blended).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">rgb({blended.r}, {blended.g}, {blended.b})</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Invalid input.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Alpha blend (A over B)</Label>
            <input
              type="range" min={0} max={1} step={0.05} value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">alpha = {alpha.toFixed(2)}</p>
            {alphaBlended && (
              <>
                <div className="h-16 rounded-md border" style={{ background: toHex(alphaBlended) }} />
                <p className="text-xs font-mono">{toHex(alphaBlended).toUpperCase()}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {shadesTints && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Tints & shades of A</p>
            <div className="flex gap-2 flex-wrap">
              {shadesTints.tints.map((c, i) => (
                <div key={`t${i}`} className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ background: toHex(c) }} />
                  <p className="text-[10px] font-mono mt-1">{toHex(c).toUpperCase()}</p>
                </div>
              ))}
              <div className="text-center">
                <div className="w-12 h-12 rounded border-2 border-primary" style={{ background: toHex(a) }} />
                <p className="text-[10px] font-mono mt-1">BASE</p>
              </div>
              {shadesTints.shades.map((c, i) => (
                <div key={`s${i}`} className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ background: toHex(c) }} />
                  <p className="text-[10px] font-mono mt-1">{toHex(c).toUpperCase()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analog.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Analogous & triadic harmony</p>
            <div className="flex gap-2 flex-wrap">
              {analog.map((c, i) => (
                <div key={`a${i}`} className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ background: toHex(c) }} />
                  <p className="text-[10px] font-mono mt-1">{toHex(c).toUpperCase()}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              {harmonies.map((c, i) => (
                <div key={`h${i}`} className="text-center">
                  <div className="w-12 h-12 rounded border" style={{ background: toHex(c) }} />
                  <p className="text-[10px] font-mono mt-1">{toHex(c).toUpperCase()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {generatedPalette.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">Palette generator</p>
              <select
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background"
                value={paletteType}
                onChange={(e) => setPaletteType(e.target.value as typeof paletteType)}
              >
                <option value="mono">Monochromatic</option>
                <option value="pastel">Pastel</option>
                <option value="vibrant">Vibrant</option>
                <option value="muted">Muted</option>
              </select>
              <CopyButton getText={() => cssGradient} label="Copy CSS" />
              <DownloadButton getText={() => csv} filename="palette.csv" mime="text/csv" label="Download CSV" />
            </div>
            <div className="flex gap-1 h-16 rounded-md overflow-hidden border">
              {generatedPalette.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: toHex(c) }} title={toHex(c)} />
              ))}
            </div>
            <p className="text-xs font-mono text-muted-foreground break-all">{cssGradient}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all blending is computed locally. Multiplies and screens use the standard sRGB formulas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
