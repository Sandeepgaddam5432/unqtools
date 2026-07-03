"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CopyButton } from "../../_shared";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  rgbToCss,
  checkContrast,
  type RGB,
} from "./logic";

function rgbToCssStr(rgb: RGB) {
  return rgbToCss(rgb);
}

export default function ColorPicker() {
  const [hex, setHex] = useState("#c96442");
  const [fgHex, setFgHex] = useState("#ffffff");
  const [bgHex, setBgHex] = useState("#c96442");

  const rgb = hexToRgb(hex) ?? { r: 201, g: 100, b: 66 };
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const complementary: RGB = { r: 255 - rgb.r, g: 255 - rgb.g, b: 255 - rgb.b };
  const compHex = rgbToHex(complementary);

  const fgRgb = hexToRgb(fgHex) ?? { r: 255, g: 255, b: 255 };
  const bgRgb = hexToRgb(bgHex) ?? { r: 201, g: 100, b: 66 };
  const contrast = checkContrast(fgRgb, bgRgb);

  const updateFromHex = useCallback((newHex: string) => {
    setHex(newHex);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="color"
              value={hex.slice(0, 7)}
              onChange={(e) => updateFromHex(e.target.value)}
              className="h-12 w-16 rounded-md border cursor-pointer"
              aria-label="Color picker"
            />
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">HEX</Label>
              <Input value={hex} onChange={(e) => updateFromHex(e.target.value)} className="font-mono w-32" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">RGB</Label>
              <Input
                readOnly
                value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
                className="font-mono w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">HSL</Label>
              <Input
                readOnly
                value={`hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`}
                className="font-mono w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">HSV</Label>
              <Input
                readOnly
                value={`hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`}
                className="font-mono w-40"
              />
            </div>
            <div className="ml-auto">
              <CopyButton getText={() => hex} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Complementary color</p>
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-md border"
              style={{ backgroundColor: rgbToCssStr(rgb) }}
              title="Original"
            />
            <span className="text-2xl">→</span>
            <div
              className="h-16 w-16 rounded-md border cursor-pointer"
              style={{ backgroundColor: rgbToCssStr(complementary) }}
              onClick={() => updateFromHex(compHex)}
              title="Complementary — click to use"
            />
            <div className="ml-2">
              <p className="text-xs text-muted-foreground">Complement</p>
              <code className="text-sm font-mono">{compHex}</code>
              <div className="mt-1">
                <CopyButton getText={() => compHex} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">WCAG contrast checker</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <Label className="text-xs text-muted-foreground">Foreground</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={fgHex.slice(0, 7)}
                  onChange={(e) => setFgHex(e.target.value)}
                  className="h-10 w-12 rounded border cursor-pointer"
                  aria-label="Foreground color"
                />
                <Input value={fgHex} onChange={(e) => setFgHex(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Background</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={bgHex.slice(0, 7)}
                  onChange={(e) => setBgHex(e.target.value)}
                  className="h-10 w-12 rounded border cursor-pointer"
                  aria-label="Background color"
                />
                <Input value={bgHex} onChange={(e) => setBgHex(e.target.value)} className="font-mono" />
              </div>
            </div>
          </div>
          <div
            className="mb-3 rounded-lg p-4 text-3xl font-bold"
            style={{ backgroundColor: bgHex, color: fgHex }}
          >
            The quick brown fox jumps over the lazy dog. 1234567890
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {[
              { label: "AA normal", ok: contrast.aaNormal },
              { label: "AA large", ok: contrast.aaLarge },
              { label: "AAA normal", ok: contrast.aaaNormal },
              { label: "AAA large", ok: contrast.aaaLarge },
            ].map((c) => (
              <div
                key={c.label}
                className={`rounded-md border p-2 ${c.ok ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "border-destructive/50 text-destructive"}`}
              >
                <p className="font-bold">{contrast.ratio.toFixed(2)}:1</p>
                <p className="text-muted-foreground">{c.label}</p>
                <p>{c.ok ? "Pass" : "Fail"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all color math runs locally. WCAG contrast uses the official relative-luminance formula.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
