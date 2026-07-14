"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CopyButton, RunButton, ErrorBanner, ActionBar } from "../../_shared";
import { RefreshCw } from "lucide-react";
import {
  generatePassword,
  estimateStrength,
  DEFAULT_OPTIONS,
  type PasswordOptions,
} from "./logic";

const STRENGTH_COLORS: Record<string, string> = {
  Weak: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  Fair: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Good: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Very Strong": "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40",
};

export default function PasswordGenerator() {
  const [opts, setOpts] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(
    () => (password ? estimateStrength(password, opts) : null),
    [password, opts],
  );

  const run = useCallback(() => {
    setError(null);
    try {
      const pwd = generatePassword(opts);
      setPassword(pwd);
    } catch (e) {
      setError((e as Error).message ?? "Generation failed");
      setPassword("");
    }
  }, [opts]);

  const updateOpt = useCallback(
    <K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <div className="space-y-4">
      {/* Password display */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="pwd-output" className="text-xs text-muted-foreground">
              Generated password
            </Label>
            {strength && (
              <Badge
                variant="outline"
                className={`text-[10px] ${STRENGTH_COLORS[strength.label]}`}
                aria-label={`Strength: ${strength.label}, ${strength.bits} bits of entropy`}
              >
                {strength.label} · {strength.bits} bits
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="pwd-output"
              readOnly
              value={password}
              placeholder="Click Generate to create a password…"
              className="font-mono text-sm flex-1"
              aria-label="Generated password output"
            />
            <CopyButton
              getText={() => password}
              label="Copy"
              disabled={!password}
              size="md"
            />
          </div>
          <ActionBar>
            <RunButton
              onClick={run}
              label="Generate"
              size="md"
            />
            <button
              type="button"
              onClick={run}
              disabled={!password}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Regenerate password"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </button>
          </ActionBar>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Options */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pwd-length" className="text-sm">Length</Label>
              <Badge variant="outline" className="font-mono text-xs">{opts.length}</Badge>
            </div>
            <Slider
              id="pwd-length"
              value={[opts.length]}
              min={4}
              max={64}
              step={1}
              onValueChange={(v) => updateOpt("length", v[0])}
              aria-label="Password length"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>4</span><span>16</span><span>32</span><span>48</span><span>64</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-lower">
              <input
                id="opt-lower"
                type="checkbox"
                checked={opts.lowercase}
                onChange={(e) => updateOpt("lowercase", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span>Lowercase (a-z)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-upper">
              <input
                id="opt-upper"
                type="checkbox"
                checked={opts.uppercase}
                onChange={(e) => updateOpt("uppercase", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span>Uppercase (A-Z)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-num">
              <input
                id="opt-num"
                type="checkbox"
                checked={opts.numbers}
                onChange={(e) => updateOpt("numbers", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span>Numbers (0-9)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-sym">
              <input
                id="opt-sym"
                type="checkbox"
                checked={opts.symbols}
                onChange={(e) => updateOpt("symbols", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <span>Symbols (!@#$)</span>
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-ambig">
            <input
              id="opt-ambig"
              type="checkbox"
              checked={opts.excludeAmbiguous}
              onChange={(e) => updateOpt("excludeAmbiguous", e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <span>Exclude ambiguous characters (0/O, 1/l/I)</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> passwords are
            generated locally using the browser's <code>crypto.getRandomValues</code>
            {" "}API (cryptographically secure). Nothing ever leaves your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
