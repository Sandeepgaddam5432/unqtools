"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";

export default function CryptographicKeyGeneratorAESRSAECDSA() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const process = useCallback(() => {
    setError(null);
    if (!input.trim()) {
      setOutput("");
      return;
    }
    try {
      const result = input;
      setOutput(result);
      setHistory((prev) => [input.slice(0, 100), ...prev].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setOutput("");
    }
  }, [input]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
  }, []);

  const stats = useMemo(() => ({ inputLength: input.length, outputLength: output.length }), [input, output]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-medium">Input</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setInput("Sample input text")}>Example</Button>
              <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
            </div>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter input..."
            rows={4}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">{stats.inputLength} chars</p>
          <Button onClick={process} disabled={!input.trim()}>Process</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Output</span>
              <Badge variant="outline">{stats.outputLength} chars</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {output}
            </div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => output} label="Copy output" />
              <DownloadButton getText={() => output} filename="{cryptographic-key-generator}-output.txt" />
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
