"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { bruteForce, bestGuess, formatResults } from "./logic";
import { toast } from "sonner";

export default function CaesarBruteforce() {
  const [input, setInput] = useState("");
  const results = useMemo(() => (input ? bruteForce(input) : []), [input]);
  const guess = useMemo(() => (input ? bestGuess(input) : null), [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput("Khoor, Zruog!");
                toast.info("Sample ciphertext loaded (shift 3)");
              }}
            >
              Sample
            </Button>
            {input && (
              <Button variant="ghost" size="sm" onClick={() => setInput("")}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bf-input">Ciphertext</Label>
          <Textarea
            id="bf-input"
            placeholder="Paste Caesar-encrypted text…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[180px] resize-y font-mono text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Best guess</Label>
            {guess && <Badge variant="secondary">Shift {guess.shift}</Badge>}
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-primary/5 p-3 font-mono text-sm">
            {guess ? (
              guess.plaintext
            ) : (
              <span className="text-muted-foreground">Best guess appears here…</span>
            )}
          </pre>
          {guess && <CopyButton getText={() => guess.plaintext} label="Copy best guess" />}
        </div>
      </div>

      {input && results.length === 0 && (
        <ErrorBanner message="Could not analyze input." />
      )}

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">All 25 shift candidates</Label>
              <DownloadButton
                getText={() => formatResults(results)}
                filename="caesar-bruteforce.txt"
              />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {results.map((r, i) => (
                <div
                  key={r.shift}
                  className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                    guess && r.shift === guess.shift
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50"
                  }`}
                >
                  <span className="font-mono font-bold flex-shrink-0 w-10">
                    {guess && r.shift === guess.shift ? "★" : i + 1}.
                  </span>
                  <span className="font-mono flex-shrink-0 w-12">Shift {r.shift}</span>
                  <span className="font-mono break-all">{r.plaintext}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all brute-force analysis
            runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
