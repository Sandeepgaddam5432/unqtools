"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton } from "../../_shared";
import { encrypt, decrypt, validateKeyword, type VigenereMode } from "./logic";
import { toast } from "sonner";

export default function VigenereCipher() {
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("LEMON");
  const [mode, setMode] = useState<VigenereMode>("encrypt");

  const validation = useMemo(() => validateKeyword(keyword), [keyword]);

  const output = useMemo(() => {
    if (!input) return "";
    if (typeof validation !== "string") return "";
    return mode === "encrypt" ? encrypt(input, validation) : decrypt(input, validation);
  }, [input, validation, mode]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "encrypt" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("encrypt")}
              >
                Encrypt
              </Button>
              <Button
                variant={mode === "decrypt" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("decrypt")}
              >
                Decrypt
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Keyword</Label>
              <Input
                type="text"
                aria-label="Keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-40 font-mono"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput("ATTACKATDAWN");
                setKeyword("LEMON");
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
          <Label htmlFor="vig-input">Input</Label>
          <Textarea
            id="vig-input"
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

      {typeof validation !== "string" && input && (
        <ErrorBanner message={validation.error} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encryption/decryption
            runs locally in your browser. The keyword never leaves your machine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
