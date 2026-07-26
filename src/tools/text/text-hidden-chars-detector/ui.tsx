"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  detectHidden, removeByCategory, decodeSteganography, encodeSteganography,
  toCsv, type HiddenCategory,
} from "./logic";

const CATS: HiddenCategory[] = ["zero-width", "bom", "control", "directional", "invisible-op", "variation-selector", "whitespace-special", "deprecated-format"];

export default function TextHiddenCharsDetector() {
  const [text, setText] = useState("Hello\u200BWorld\u00A0Test");
  const [result, setResult] = useState<ReturnType<typeof detectHidden> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stegOut, setStegOut] = useState<string | null>(null);
  const [encodePayload, setEncodePayload] = useState("Secret message");
  const [encodeCarrier, setEncodeCarrier] = useState("This is a normal looking text.");
  const [encodedOut, setEncodedOut] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    setResult(detectHidden(text));
    setStegOut(decodeSteganography(text));
  }, [text]);

  const removeSelected = useCallback((cats: HiddenCategory[]) => {
    const cleaned = removeByCategory(text, cats);
    setText(cleaned);
    setResult(detectHidden(cleaned));
  }, [text]);

  const doEncode = useCallback(() => {
    setEncodedOut(encodeSteganography(encodeCarrier, encodePayload));
    setError(null);
  }, [encodeCarrier, encodePayload]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Text to inspect</Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Detect</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText("Hello\u200BWorld\u00A0Test\u202Ehidden"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); setStegOut(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={result.total > 0 ? "destructive" : "outline"}>Found: {result.total}</Badge>
                {CATS.filter((c) => result.countsByCategory[c] > 0).map((c) => (
                  <Badge key={c} variant="secondary">{c}: {result.countsByCategory[c]}</Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => result.cleaned} label="Copy cleaned" />
                <DownloadButton getText={() => toCsv(result)} filename="hidden-chars.csv" mime="text/csv" />
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {CATS.map((c) => (
                <Button key={c} size="sm" variant="outline" onClick={() => removeSelected([c])} disabled={result.countsByCategory[c] === 0}>
                  Remove {c}
                </Button>
              ))}
              <Button size="sm" variant="default" onClick={() => removeSelected(CATS)}>Remove all</Button>
            </div>

            {result.chars.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Hex</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Category</th><th className="p-2 text-right">Line</th><th className="p-2 text-right">Col</th><th className="p-2 text-left">Context</th></tr></thead>
                  <tbody>
                    {result.chars.slice(0, 200).map((c, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-mono">{c.hex}</td>
                        <td className="p-2">{c.name}</td>
                        <td className="p-2">{c.category}</td>
                        <td className="p-2 text-right font-mono">{c.line}</td>
                        <td className="p-2 text-right font-mono">{c.column}</td>
                        <td className="p-2 font-mono text-muted-foreground">{c.context}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.chars.length > 200 && <p className="text-xs text-muted-foreground mt-1">Showing first 200 of {result.chars.length}.</p>}
              </div>
            )}

            {stegOut && (
              <div className="p-3 rounded-md border border-primary/30 bg-primary/5">
                <p className="text-xs text-muted-foreground mb-1">Steganographic payload decoded</p>
                <p className="font-mono text-sm break-all">{stegOut}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Encode a steganographic payload</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Carrier text (visible)</Label>
              <Input value={encodeCarrier} onChange={(e) => setEncodeCarrier(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hidden payload</Label>
              <Input value={encodePayload} onChange={(e) => setEncodePayload(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={doEncode}>Encode</Button>
          {encodedOut && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Encoded (zero-width chars may not be visible — copy and inspect in detector):</p>
              <div className="p-3 rounded-md border bg-muted/30 text-sm font-mono break-all">{encodedOut.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "•")}</div>
              <CopyButton getText={() => encodedOut} label="Copy encoded (with hidden chars)" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all detection runs locally. No data leaves the browser.</p></CardContent></Card>
    </div>
  );
}
