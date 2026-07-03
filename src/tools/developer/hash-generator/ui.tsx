"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { hashString, ALGORITHMS, type HashAlgorithm } from "./logic";

export default function HashGenerator() {
  const [input, setInput] = useState("");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [hexOutput, setHexOutput] = useState("");
  const [b64Output, setB64Output] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    if (!input) {
      setHexOutput("");
      setB64Output("");
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { hex, base64 } = await hashString(input, algorithm, "both");
      setHexOutput(hex);
      setB64Output(base64);
    } catch (e) {
      setError((e as Error).message ?? "Hashing failed");
      setHexOutput("");
      setB64Output("");
    } finally {
      setBusy(false);
    }
  }, [input, algorithm]);

  const loadSample = useCallback(() => {
    setInput("Hello, UnQTools!");
    toast.info("Sample loaded");
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Algorithm</Label>
              <Select value={algorithm} onValueChange={(v) => setAlgorithm(v as HashAlgorithm)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALGORITHMS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={run} disabled={busy || !input}>
                {busy ? "Hashing…" : "Generate hash"}
              </Button>
              <Button variant="ghost" size="sm" onClick={loadSample}>Sample</Button>
              <Button variant="ghost" size="sm" onClick={() => { setInput(""); setHexOutput(""); setB64Output(""); setError(null); }} disabled={!input}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hash-input">Input text</Label>
        <Textarea
          id="hash-input"
          placeholder="Type text to hash…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[120px] font-mono text-sm resize-y"
        />
      </div>

      {hexOutput && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Hex digest</Label>
              <CopyButton getText={() => hexOutput} />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm break-all">
              {hexOutput}
            </pre>
            <Badge variant="outline" className="text-xs w-fit">{hexOutput.length} chars</Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Base64 digest</Label>
              <CopyButton getText={() => b64Output} />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm break-all">
              {b64Output}
            </pre>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all hashing runs locally via the Web Crypto API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
