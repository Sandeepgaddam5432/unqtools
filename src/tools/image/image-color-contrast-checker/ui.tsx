"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  parseHex,
  toHex,
  evaluateContrast,
  apcaContrast,
  suggestColors,
  formatReport,
  recommendTextRole,
  rgbToHsl,
  type RGB,
} from "./logic";

function Swatch({ rgb, label }: { rgb: RGB | null; label: string }) {
  if (!rgb) {
    return (
      <div className="flex-1 min-h-[80px] rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
        {label}: invalid
      </div>
    );
  }
  const hex = toHex(rgb);
  const hsl = rgbToHsl(rgb);
  return (
    <div className="flex-1 min-h-[80px] rounded-md border border-border overflow-hidden">
      <div className="h-12" style={{ background: hex }} />
      <div className="p-2 text-xs space-y-0.5">
        <p className="font-mono font-medium">{hex.toUpperCase()}</p>
        <p className="text-muted-foreground">rgb({rgb.r}, {rgb.g}, {rgb.b})</p>
        <p className="text-muted-foreground">hsl({hsl.h}, {hsl.s}%, {hsl.l}%)</p>
      </div>
    </div>
  );
}

export default function ImageColorContrastCheckerUI() {
  const [fgHex, setFgHex] = useState("#0b0b0b");
  const [bgHex, setBgHex] = useState("#ffffff");
  const [target, setTarget] = useState(4.5);
  const [error, setError] = useState("");

  const fg = useMemo(() => parseHex(fgHex), [fgHex]);
  const bg = useMemo(() => parseHex(bgHex), [bgHex]);

  const result = useMemo(() => {
    if (!fg || !bg) return null;
    return evaluateContrast(fg, bg);
  }, [fg, bg]);

  const apc = useMemo(() => {
    if (!fg || !bg) return null;
    return apcaContrast(fg, bg);
  }, [fg, bg]);

  const suggestions = useMemo(() => {
    if (!fg || !bg) return null;
    return suggestColors(fg, bg, target);
  }, [fg, bg, target]);

  const role = useMemo(() => {
    if (!fg || !bg) return null;
    return recommendTextRole(fg, bg);
  }, [fg, bg]);

  const report = useMemo(() => {
    if (!fg || !bg) return "";
    return formatReport(fg, bg);
  }, [fg, bg]);

  const onSwap = useCallback(() => {
    setFgHex(bgHex);
    setBgHex(fgHex);
  }, [fgHex, bgHex]);

  const previewStyle = result
    ? { color: fg ? toHex(fg) : "#000", background: bg ? toHex(bg) : "#fff" }
    : {};

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Foreground (text)</Label>
              <Input value={fgHex} onChange={(e) => { setFgHex(e.target.value); setError(""); }} placeholder="#000000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Background</Label>
              <Input value={bgHex} onChange={(e) => { setBgHex(e.target.value); setError(""); }} placeholder="#ffffff" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={onSwap}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
            >
              Swap fg/bg
            </button>
            <Label className="text-xs text-muted-foreground ml-2">Target ratio</Label>
            <select
              className="text-xs px-2 py-1.5 rounded-md border border-input bg-background"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            >
              <option value={3}>3 (AA Large)</option>
              <option value={4.5}>4.5 (AA Normal)</option>
              <option value={7}>7 (AAA Normal)</option>
            </select>
            <CopyButton getText={() => report} disabled={!result} />
            <DownloadButton getText={() => report} filename="contrast-report.txt" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Colors</Label>
          <div className="flex flex-wrap gap-3">
            <Swatch rgb={fg} label="Foreground" />
            <Swatch rgb={bg} label="Background" />
          </div>
          {result && (
            <div
              className="rounded-md border border-border p-4 text-center text-2xl font-bold"
              style={previewStyle}
            >
              The quick brown fox jumps over the lazy dog. 1234567890
            </div>
          )}
          {role && (
            <p className="text-xs text-muted-foreground">
              Recommended: use <strong>{role === "first-as-fg" ? "Foreground" : "Background"}</strong> as the text color for stronger contrast.
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">WCAG results</p>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge variant="outline" className="text-base">{result.ratio}:1</Badge>
              <Badge variant={result.aaNormal ? "default" : "secondary"}>AA Normal {result.aaNormal ? "✓" : "✗"}</Badge>
              <Badge variant={result.aaLarge ? "default" : "secondary"}>AA Large {result.aaLarge ? "✓" : "✗"}</Badge>
              <Badge variant={result.aaaNormal ? "default" : "secondary"}>AAA Normal {result.aaaNormal ? "✓" : "✗"}</Badge>
              <Badge variant={result.aaaLarge ? "default" : "secondary"}>AAA Large {result.aaaLarge ? "✓" : "✗"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{result.summary}</p>
          </CardContent>
        </Card>
      )}

      {apc && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-medium">APCA (perceptual contrast)</p>
            <p className="text-xs text-muted-foreground">Lc {apc.value} — {apc.level} {apc.pass ? "(passes ≥45)" : "(fails minimum)"}</p>
          </CardContent>
        </Card>
      )}

      {suggestions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Lighter foreground suggestions (≥{target}:1)</p>
              {suggestions.lighter.length === 0 ? (
                <p className="text-xs text-muted-foreground">No lighter suggestions within range.</p>
              ) : (
                <ul className="space-y-1.5">
                  {suggestions.lighter.map((s) => (
                    <li key={s.hex} className="flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded border" style={{ background: s.hex }} />
                      <span className="font-mono">{s.hex.toUpperCase()}</span>
                      <span className="text-muted-foreground">— {s.ratio}:1</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Darker foreground suggestions (≥{target}:1)</p>
              {suggestions.darker.length === 0 ? (
                <p className="text-xs text-muted-foreground">No darker suggestions within range.</p>
              ) : (
                <ul className="space-y-1.5">
                  {suggestions.darker.map((s) => (
                    <li key={s.hex} className="flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded border" style={{ background: s.hex }} />
                      <span className="font-mono">{s.hex.toUpperCase()}</span>
                      <span className="text-muted-foreground">— {s.ratio}:1</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations happen locally. WCAG 2.x uses relative luminance (sRGB). APCA is the W3 draft perceptual model.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
