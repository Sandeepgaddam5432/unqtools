"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton } from "../../_shared";
import { rotate, validateRot, allRotations } from "./logic";
import { toast } from "sonner";

export default function Rot13Cipher() {
  const [input, setInput] = useState("");
  const [rot, setRot] = useState(13);

  const validation = useMemo(() => validateRot(rot), [rot]);
  const output = useMemo(() => {
    if (!input) return "";
    if (typeof validation !== "number") return "";
    return rotate(input, validation);
  }, [input, validation]);

  const variants = useMemo(() => (input ? allRotations(input) : []), [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Rotation (1-25)</Label>
              <Input
                type="number"
                min={1}
                max={25}
                aria-label="Rotation amount"
                value={rot}
                onChange={(e) => setRot(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                className="w-28"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRot(13);
                toast.info("ROT13 applied");
              }}
            >
              ROT13
            </Button>
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rot-input">Input</Label>
          <Textarea
            id="rot-input"
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

      {typeof validation !== "number" && validation && input && (
        <ErrorBanner message={validation.error} />
      )}

      {variants.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-3 block">
              All rotations (ROT1 — ROT25)
            </Label>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {variants.map((v) => (
                <div
                  key={v.rot}
                  className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                    v.rot === rot ? "border-primary/50 bg-primary/5" : "border-border/50"
                  }`}
                >
                  <span className="font-mono font-bold flex-shrink-0 w-14">ROT{v.rot}</span>
                  <span className="font-mono break-all">{v.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all rotation runs locally
            in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
