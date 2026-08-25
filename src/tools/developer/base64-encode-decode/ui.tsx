"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { encode, decode, validate, bulkEncode, getStats, formatBytes, randomString } from "./logic";

export default function Base64EncodeDecode() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [history, setHistory] = useState<string[]>([]);

  const handleProcess = useCallback(() => {
    setError(null);
    if (!input.trim()) {
      setOutput("");
      return;
    }
    const result = mode === "encode" ? encode(input) : decode(input);
    if (result.error) {
      setError(result.error);
      setOutput("");
    } else {
      setOutput(result.output);
      setHistory((prev) => [input.slice(0, 50), ...prev].slice(0, 10));
    }
  }, [input, mode]);

  const swap = useCallback(() => {
    setInput(output);
    setOutput(input);
    setMode((m) => (m === "encode" ? "decode" : "encode"));
  }, [input, output]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
  }, []);

  const loadExample = useCallback(() => {
    setInput("Hello World");
    setMode("encode");
  }, []);

  const loadRandom = useCallback(() => {
    setInput(randomString(32));
    setMode("encode");
  }, []);

  const stats = useMemo(() => getStats(input, output), [input, output]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button variant={mode === "encode" ? "default" : "outline"} size="sm" onClick={() => setMode("encode")}>Encode</Button>
              <Button variant={mode === "decode" ? "default" : "outline"} size="sm" onClick={() => setMode("decode")}>Decode</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={loadExample}>Example</Button>
              <Button variant="ghost" size="sm" onClick={loadRandom}>Random</Button>
              <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
            </div>
          </div>
          <div>
            <Label htmlFor="input">Input <span className="text-muted-foreground">({formatBytes(stats.inputSize)})</span></Label>
            <Textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "encode" ? "Enter text to encode..." : "Enter encoded text to decode..."}
              rows={4}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleProcess} disabled={!input.trim()}>{mode === "encode" ? "Encode →" : "Decode →"}</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Output</span>
              <Badge variant="outline">{formatBytes(stats.outputSize)} ({stats.ratio.toFixed(2)}×)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {output}
            </div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => output} label="Copy output" />
              <Button variant="outline" size="sm" onClick={swap}>Use as input</Button>
              <DownloadButton getText={() => output} filename="{slug}-output.txt" />
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Recent</span>
              <Button variant="ghost" size="sm" onClick={() => setHistory([])}>Clear</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => setInput(h)}
                className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 font-mono truncate"
              >
                {h}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All processing happens 100% in your browser. Nothing is uploaded, tracked, or stored remotely. Works offline as a PWA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
