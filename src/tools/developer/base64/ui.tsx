"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { encodeBase64, decodeBase64, type Base64Variant } from "./logic";

export default function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [variant, setVariant] = useState<Base64Variant>("standard");
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (textInput?: string) => {
      const text = textInput ?? input;
      if (!text.trim()) {
        setOutput("");
        setError(null);
        return;
      }
      try {
        if (mode === "encode") {
          setOutput(encodeBase64(text, variant));
        } else {
          setOutput(decodeBase64(text, variant));
        }
        setError(null);
      } catch (e) {
        setError((e as Error).message ?? "Invalid Base64 input");
        setOutput("");
      }
    },
    [input, mode, variant],
  );

  const onInputChange = useCallback(
    (val: string) => {
      setInput(val);
      if (liveUpdate) run(val);
    },
    [liveUpdate, run],
  );

  const swap = useCallback(() => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    const tmp = input;
    setInput(output);
    setOutput(tmp);
    toast.info("Swapped input ↔ output");
  }, [input, output]);

  const loadSample = useCallback(() => {
    const sample = mode === "encode" ? "Hello, UnQTools! 🎉" : "SGVsbG8sIFVuUVRvb2xzISDwn46J";
    onInputChange(sample);
  }, [mode, onInputChange]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
  }, []);

  const inputBytes = useMemo(() => new Blob([input]).size, [input]);
  const outputBytes = useMemo(() => new Blob([output]).size, [output]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "encode" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("encode")}
              >
                Encode (Text → Base64)
              </Button>
              <Button
                variant={mode === "decode" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("decode")}
              >
                Decode (Base64 → Text)
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={variant === "urlsafe"}
                onCheckedChange={(c) => setVariant(c ? "urlsafe" : "standard")}
                id="url-safe"
              />
              <Label htmlFor="url-safe" className="text-sm cursor-pointer">
                URL-safe
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={liveUpdate} onCheckedChange={setLiveUpdate} id="live-update" />
              <Label htmlFor="live-update" className="text-sm cursor-pointer">
                Live update
              </Label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={swap} disabled={!output}>
                Swap
              </Button>
              {!liveUpdate && <Button size="sm" onClick={() => run()}>Run</Button>}
              <Button variant="ghost" size="sm" onClick={loadSample}>Sample</Button>
              <Button variant="ghost" size="sm" onClick={clear} disabled={!input && !output}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="b64-input">Input</Label>
            <Badge variant="outline" className="text-xs">{inputBytes.toLocaleString()} bytes</Badge>
          </div>
          <Textarea
            id="b64-input"
            placeholder={mode === "encode" ? "Type text to encode…" : "Paste Base64 to decode…"}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            className="min-h-[200px] font-mono text-sm resize-y"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            <div className="flex items-center gap-2">
              {output && <Badge variant="outline" className="text-xs">{outputBytes.toLocaleString()} bytes</Badge>}
              {output && <CopyButton getText={() => output} />}
            </div>
          </div>
          <pre className="min-h-[200px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encoding/decoding runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
