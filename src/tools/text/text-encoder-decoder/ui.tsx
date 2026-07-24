"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { encode, decode, type Encoding } from "./logic";

const ENCODINGS: Encoding[] = ["base64", "url", "html", "hex", "rot13", "binary"];

export default function TextEncoderDecoder() {
  const [input, setInput] = useState("Hello, World!");
  const [encoding, setEncoding] = useState<Encoding>("base64");
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const r = direction === "encode" ? encode(input, { encoding }) : decode(input, { encoding });
    if ("error" in r) { setError(r.error); setOutput(""); }
    else setOutput(r.output);
  }, [input, encoding, direction]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Encoding</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={encoding} onChange={(e) => setEncoding(e.target.value as Encoding)}>
                {ENCODINGS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={direction} onChange={(e) => setDirection(e.target.value as "encode" | "decode")}>
                <option value="encode">Encode</option>
                <option value="decode">Decode</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Run</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setOutput(""); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{encoding}</Badge>
              <Badge variant="outline">{direction}</Badge>
              <div className="ml-auto"><CopyButton getText={() => output} /></div>
            </div>
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{output}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
