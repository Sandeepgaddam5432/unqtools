"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { encrypt, decrypt, rot13, bruteForce, type BruteForceResult } from "./logic";

export default function CaesarCipher() {
  const [input, setInput] = useState("");
  const [shift, setShift] = useState(3);
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [bruteResults, setBruteResults] = useState<BruteForceResult[]>([]);

  const output = useMemo(() => {
    if (!input) return "";
    return mode === "encrypt" ? encrypt(input, shift) : decrypt(input, shift);
  }, [input, shift, mode]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Button variant={mode === "encrypt" ? "default" : "outline"} size="sm" onClick={() => setMode("encrypt")}>
                Encrypt
              </Button>
              <Button variant={mode === "decrypt" ? "default" : "outline"} size="sm" onClick={() => setMode("decrypt")}>
                Decrypt
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Shift (1-25)</Label>
              <Input type="number" min={1} max={25} aria-label="Shift amount" value={shift} onChange={(e) => setShift(Math.max(1, Math.min(25, Number(e.target.value) || 1)))} className="w-24" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setShift(13); toast.info("ROT13 applied"); }}>
              ROT13
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setInput("Hello World"); toast.info("Sample loaded"); }}>
              Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cc-input">Input</Label>
          <Textarea id="cc-input" placeholder="Type text…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y font-mono text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            {output && <CopyButton getText={() => output} />}
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Brute-force solver (all 25 shifts)</Label>
            <Button variant="outline" size="sm" onClick={() => setBruteResults(bruteForce(input))} disabled={!input}>
              Run brute-force
            </Button>
          </div>
          {bruteResults.length > 0 && (
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {bruteResults.map((r, i) => (
                <div key={r.shift} className={`flex items-start gap-2 rounded-md border p-2 text-xs ${i === 0 ? "border-primary/50 bg-primary/5" : "border-border/50"}`}>
                  <span className="font-mono font-bold flex-shrink-0 w-12">{i === 0 ? "★" : i + 1}.</span>
                  <span className="font-mono flex-shrink-0 w-12">Shift {r.shift}</span>
                  <span className="font-mono flex-shrink-0 w-20">{r.score !== undefined ? `${r.score.toFixed(2)}` : ""}</span>
                  <span className="font-mono break-all">{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encryption/decryption runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
