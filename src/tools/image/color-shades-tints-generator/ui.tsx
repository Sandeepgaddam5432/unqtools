"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "../../_shared";
import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, getContrastRatio,
  getWcagGrade, complementary, analogous, triadic, shades,
  randomColor, isValidHex, namedToHex, getAllNamedColors,
} from "./logic";

export default function ColorShadesAndTintsGenerator() {
  const [hex, setHex] = useState("#3b82f6");
  const [history, setHistory] = useState<string[]>([]);

  const rgb = useMemo(() => hexToRgb(hex), [hex]);
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb) : null), [rgb]);
  const comp = useMemo(() => complementary(hex), [hex]);
  const ana = useMemo(() => analogous(hex), [hex]);
  const tri = useMemo(() => triadic(hex), [hex]);
  const shadeScale = useMemo(() => shades(hex, 5), [hex]);

  const contrastWhite = useMemo(() => (rgb ? getContrastRatio(rgb, { r: 255, g: 255, b: 255 }) : 0), [rgb]);
  const contrastBlack = useMemo(() => (rgb ? getContrastRatio(rgb, { r: 0, g: 0, b: 0 }) : 0), [rgb]);

  const updateHex = useCallback((newHex: string) => {
    setHex(newHex.startsWith("#") ? newHex : "#" + newHex);
  }, []);

  const randomize = useCallback(() => {
    const c = randomColor();
    setHex(c);
    setHistory((prev) => [c, ...prev].slice(0, 10));
  }, []);

  const namedColors = getAllNamedColors();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="color-input">Color (HEX)</Label>
          <div className="flex gap-2">
            <Input
              id="color-input"
              value={hex}
              onChange={(e) => updateHex(e.target.value)}
              className="font-mono"
              placeholder="#3b82f6"
            />
            <input
              type="color"
              value={isValidHex(hex) ? hex : "#3b82f6"}
              onChange={(e) => setHex(e.target.value)}
              className="h-10 w-16 rounded border"
            />
            <Button variant="outline" onClick={randomize}>Random</Button>
          </div>
          {!isValidHex(hex) && (
            <p className="text-xs text-destructive">Invalid hex color</p>
          )}
        </CardContent>
      </Card>

      {rgb && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Color Preview</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="rounded-md border" style={{ backgroundColor: hex, height: 100 }}></div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">HEX</div>
                  <div className="font-mono">{hex}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">RGB</div>
                  <div className="font-mono">{rgb.r}, {rgb.g}, {rgb.b}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">HSL</div>
                  <div className="font-mono">{hsl?.h}°, {hsl?.s}%, {hsl?.l}%</div>
                </div>
              </div>
              <CopyButton getText={() => hex} label="Copy hex" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">WCAG Contrast</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">vs White</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{contrastWhite.toFixed(2)}</span>
                  <Badge variant={getWcagGrade(contrastWhite).aa ? "default" : "destructive"}>AA</Badge>
                  <Badge variant={getWcagGrade(contrastWhite).aaa ? "default" : "secondary"}>AAA</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">vs Black</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{contrastBlack.toFixed(2)}</span>
                  <Badge variant={getWcagGrade(contrastBlack).aa ? "default" : "destructive"}>AA</Badge>
                  <Badge variant={getWcagGrade(contrastBlack).aaa ? "default" : "secondary"}>AAA</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {comp && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Color Harmonies</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Complementary</div>
                  <div className="flex gap-2">
                    <div className="rounded border flex-1" style={{ backgroundColor: hex, height: 40 }}></div>
                    <div className="rounded border flex-1" style={{ backgroundColor: comp, height: 40 }}></div>
                  </div>
                </div>
                {ana && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Analogous</div>
                    <div className="flex gap-2">
                      <div className="rounded border flex-1" style={{ backgroundColor: ana[0], height: 40 }}></div>
                      <div className="rounded border flex-1" style={{ backgroundColor: hex, height: 40 }}></div>
                      <div className="rounded border flex-1" style={{ backgroundColor: ana[1], height: 40 }}></div>
                    </div>
                  </div>
                )}
                {tri && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Triadic</div>
                    <div className="flex gap-2">
                      <div className="rounded border flex-1" style={{ backgroundColor: hex, height: 40 }}></div>
                      <div className="rounded border flex-1" style={{ backgroundColor: tri[0], height: 40 }}></div>
                      <div className="rounded border flex-1" style={{ backgroundColor: tri[1], height: 40 }}></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {shadeScale && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Shades & Tints (5-step)</CardTitle></CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-1">
                  {shadeScale.map((s, i) => (
                    <div key={i} className="flex-1 rounded border" style={{ backgroundColor: s, height: 60 }}></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">History</CardTitle></CardHeader>
          <CardContent className="p-4 flex flex-wrap gap-2">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => setHex(h)}
                className="w-8 h-8 rounded border"
                style={{ backgroundColor: h }}
                title={h}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Named Colors</CardTitle></CardHeader>
        <CardContent className="p-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
          {namedColors.slice(0, 18).map((c) => (
            <button
              key={c.name}
              onClick={() => setHex(c.hex)}
              className="flex flex-col items-center gap-1 p-1 rounded hover:bg-muted/50"
            >
              <div className="w-8 h-8 rounded border" style={{ backgroundColor: c.hex }}></div>
              <span className="text-[10px] text-muted-foreground">{c.name}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All color calculations happen 100% in your browser. Nothing is uploaded. Works offline as a PWA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
