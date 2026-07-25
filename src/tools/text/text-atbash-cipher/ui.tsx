"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton } from "../../_shared";
import { atbash, atbashTable } from "./logic";
import { toast } from "sonner";

export default function AtbashCipher() {
  const [input, setInput] = useState("");
  const output = useMemo(() => (input ? atbash(input) : ""), [input]);
  const table = useMemo(() => atbashTable(), []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput("Hello, World!");
                toast.info("Sample loaded");
              }}
            >
              Sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput(atbash(input));
                toast.info("Applied again (Atbash is its own inverse)");
              }}
              disabled={!input}
            >
              Apply again
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="atbash-input">Input</Label>
          <Textarea
            id="atbash-input"
            placeholder="Type text…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[180px] resize-y font-mono text-sm"
          />
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
          <Label className="text-sm font-medium mb-3 block">Atbash mapping (A↔Z)</Label>
          <div className="grid grid-cols-7 sm:grid-cols-13 gap-1 text-center text-xs font-mono">
            {table.map((row) => (
              <div
                key={row.from}
                className="rounded-md border border-border/50 p-1.5"
                title={`${row.from} ↔ ${row.to}`}
              >
                <div className="font-bold text-foreground">{row.from}</div>
                <div className="text-muted-foreground">↓</div>
                <div className="font-bold text-primary">{row.to}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all ciphering runs locally
            in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
