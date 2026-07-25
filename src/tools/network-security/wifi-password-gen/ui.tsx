"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  defaultOptions,
  validateOptions,
  generateMany,
  estimateEntropy,
  classifyStrength,
  buildAlphabet,
  WPA2_MAX_LENGTH,
  type Charset,
  type WifiPasswordOptions,
  makeCryptoRandomSource,
} from "./logic";

const CHARSET_LABELS: Record<Charset, string> = {
  lowercase: "Lowercase (a-z)",
  uppercase: "Uppercase (A-Z)",
  numbers: "Numbers (0-9)",
  symbols: "Symbols (!@#…)",
};

const STRENGTH_COLOR: Record<string, string> = {
  weak: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  fair: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  strong: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "very-strong": "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export default function WifiPasswordGen() {
  const [opts, setOpts] = useState<WifiPasswordOptions>(defaultOptions());
  const [mode, setMode] = useState<"wpa2" | "wpa3">("wpa2");
  const [count, setCount] = useState(5);
  const [passwords, setPasswords] = useState<string[]>([]);

  const error = useMemo(() => validateOptions(opts, mode), [opts, mode]);
  const entropy = useMemo(() => estimateEntropy(opts), [opts]);
  const strength = useMemo(() => classifyStrength(entropy), [entropy]);
  const alphabetSize = useMemo(() => buildAlphabet(opts).length, [opts]);

  const handleGenerate = () => {
    if (error) return;
    const random = makeCryptoRandomSource();
    setPasswords(generateMany(opts, Math.max(1, Math.min(50, count)), random));
  };

  const toggleCharset = (cs: Charset) => {
    setOpts((o) => {
      const has = o.charsets.includes(cs);
      return { ...o, charsets: has ? o.charsets.filter((c) => c !== cs) : [...o.charsets, cs] };
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {(["wpa2", "wpa3"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                  mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Length ({mode === "wpa3" ? 12 : 8}–{WPA2_MAX_LENGTH})</Label>
              <Input
                type="number"
                min={mode === "wpa3" ? 12 : 8}
                max={WPA2_MAX_LENGTH}
                value={opts.length}
                onChange={(e) => setOpts((o) => ({ ...o, length: parseInt(e.target.value, 10) || 0 }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Number of passwords</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Character sets</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHARSET_LABELS) as Charset[]).map((cs) => (
                <label
                  key={cs}
                  className={`px-2 py-1 text-xs rounded-md border cursor-pointer ${
                    opts.charsets.includes(cs) ? "border-primary bg-primary/10" : "border-border bg-muted/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={opts.charsets.includes(cs)}
                    onChange={() => toggleCharset(cs)}
                  />
                  {CHARSET_LABELS[cs]}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={opts.excludeAmbiguous}
                onChange={(e) => setOpts((o) => ({ ...o, excludeAmbiguous: e.target.checked }))}
              />
              Exclude ambiguous characters (Il1O0)
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">Alphabet: {alphabetSize}</Badge>
            <Badge variant="outline" className="text-xs">~{entropy} bits</Badge>
            <Badge variant="outline" className={`text-xs ${STRENGTH_COLOR[strength]}`}>{strength}</Badge>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!!error}
              className="ml-auto px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer"
            >
              Generate
            </button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {passwords.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Generated passwords</Label>
              <CopyButton getText={() => passwords.join("\n")} />
            </div>
            <div className="space-y-1">
              {passwords.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                  <code className="font-mono break-all">{p}</code>
                  <CopyButton getText={() => p} label="" size="icon-sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {passwords.length === 0 && !error && (
        <EmptyState title="No passwords yet" hint="Pick your options and click Generate. WPA3 requires at least 12 characters." />
      )}
    </div>
  );
}
