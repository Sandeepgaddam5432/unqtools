"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";

export default function PatternGeneratorSVGCSS() {
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [fill, setFill] = useState("#3b82f6");
  const [stroke, setStroke] = useState("#1e40af");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [seed, setSeed] = useState(42);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);
    try {
      const opts = { width, height, fill, stroke, strokeWidth, opacity: 1 };
      // Simple SVG generation (placeholder — real impl uses logic.ts)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
</svg>`;
      setOutput(svg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [width, height, fill, stroke, strokeWidth, seed]);

  const randomize = useCallback(() => {
    setSeed(Math.floor(Math.random() * 10000));
    setFill("#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Width</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 200)} />
            </div>
            <div>
              <Label className="text-xs">Height</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 200)} />
            </div>
            <div>
              <Label className="text-xs">Stroke width</Label>
              <Input type="number" value={strokeWidth} onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Fill color</Label>
              <Input value={fill} onChange={(e) => setFill(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Stroke color</Label>
              <Input value={stroke} onChange={(e) => setStroke(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Seed</Label>
              <Input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={generate}>Generate</Button>
            <Button variant="outline" onClick={randomize}>Randomize</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
            <CardContent className="p-4 flex items-center justify-center bg-muted/30 rounded">
              <div dangerouslySetInnerHTML={{ __html: output }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>SVG Output</span>
                <Badge variant="outline">{output.length} chars</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <pre className="text-xs font-mono bg-muted/30 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">{output}</pre>
              <div className="flex gap-2">
                <CopyButton getText={() => output} label="Copy SVG" />
                <DownloadButton getText={() => output} filename="{pattern-generator-svg-css}.svg" mime="image/svg+xml" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All SVG generation happens 100% in your browser. Nothing is uploaded. Works offline as a PWA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
