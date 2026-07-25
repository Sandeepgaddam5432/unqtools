"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton } from "../../_shared";
import { decode, encode, detectSpeed } from "./logic";
import { toast } from "sonner";

export default function MorseDecoder() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"decode" | "encode">("decode");

  const isMorseInput = mode === "decode";
  const output = useMemo(() => {
    if (!input) return "";
    return isMorseInput ? decode(input) : encode(input);
  }, [input, isMorseInput]);

  const speed = useMemo(
    () => (isMorseInput && input ? detectSpeed(input) : 0),
    [input, isMorseInput],
  );

  const toggleMode = () => {
    setMode((m) => (m === "decode" ? "encode" : "decode"));
    setInput("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "decode" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("decode")}
              >
                Decode
              </Button>
              <Button
                variant={mode === "encode" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("encode")}
              >
                Encode
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleMode}>
              Swap direction
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput(isMorseInput ? "... --- ... / - .... . .-. ." : "Hello there");
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
          <Label htmlFor="morse-input">
            {isMorseInput ? "Morse input" : "Text input"}
          </Label>
          <Textarea
            id="morse-input"
            placeholder={isMorseInput ? "... --- ... / - .... . .-. ." : "Hello there"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[180px] resize-y font-mono text-sm"
          />
          {isMorseInput && speed > 0 && (
            <p className="text-xs text-muted-foreground">
              Estimated speed:{" "}
              <Badge variant="outline" className="ml-1">
                ~{speed} WPM
              </Badge>
            </p>
          )}
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

      {input && !output && <ErrorBanner message="Could not parse the input." />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Format:</strong> use spaces between symbols,
            <code className="mx-1 px-1 rounded bg-muted">/</code> or double-space between
            words. <strong className="text-foreground">Privacy:</strong> all decoding runs
            locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
