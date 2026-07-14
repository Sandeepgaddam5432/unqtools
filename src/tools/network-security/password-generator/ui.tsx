"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CopyButton, RunButton, ErrorBanner, ActionBar } from "../../_shared";
import { toast } from "sonner";
import {
  generate,
  estimateStrength,
  detectPatterns,
  generateBatch,
  toCsv,
  toJson,
  encodePreset,
  decodePreset,
  loadHistory,
  saveToHistory,
  clearHistory,
  crossCheckZxcvbn,
  DEFAULT_OPTIONS,
  DEFAULT_RANDOM,
  DEFAULT_PASSPHRASE,
  DEFAULT_PRONOUNCEABLE,
  DEFAULT_PIN,
  DEFAULT_WIFI,
  DEFAULT_DICEWARE,
  type PasswordOptions,
  type GenerationMode,
  type GenerationResult,
  type HistoryEntry,
} from "./logic";
import { RefreshCw, History, Trash2, Download, Share2, AlertTriangle, Dice5, Zap } from "lucide-react";

const MODES: { id: GenerationMode; label: string; hint: string }[] = [
  { id: "random", label: "Random", hint: "Custom chars" },
  { id: "passphrase", label: "Passphrase", hint: "EFF words" },
  { id: "pronounceable", label: "Pronounceable", hint: "Speakable" },
  { id: "pin", label: "PIN", hint: "4-8 digits" },
  { id: "wifi", label: "WiFi", hint: "WPA2/WPA3" },
  { id: "diceware", label: "Diceware", hint: "Dice rolls" },
];

const STRENGTH_COLORS: Record<string, string> = {
  Weak: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  Fair: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Good: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Very Strong": "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40",
};

const STRENGTH_BAR: Record<string, string> = {
  Weak: "bg-red-500",
  Fair: "bg-amber-500",
  Good: "bg-blue-500",
  Strong: "bg-emerald-500",
  "Very Strong": "bg-emerald-600",
};

export default function PasswordGenerator() {
  const [opts, setOpts] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState(1);
  const [batchResults, setBatchResults] = useState<GenerationResult[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [zxcvbnResult, setZxcvbnResult] = useState<{ score: number; warning: string; suggestions: string[] } | null>(null);
  const [zxcvbnLoading, setZxcvbnLoading] = useState(false);
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const [autoClear, setAutoClear] = useState(false);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Generate on mode change
  const run = useCallback(() => {
    setError(null);
    setZxcvbnResult(null);
    try {
      const r = generate(opts);
      setResult(r);
      setBatchResults(null);
      // Save to history
      const updated = saveToHistory(r.password, r.mode, r.entropyBits);
      setHistory(updated);
    } catch (e) {
      setError((e as Error).message ?? "Generation failed");
      setResult(null);
    }
  }, [opts]);

  // Auto-clear clipboard timer
  useEffect(() => {
    if (!copiedAt || !autoClear) return;
    const timer = setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => {});
      toast.info("Clipboard auto-cleared (30s)");
      setCopiedAt(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [copiedAt, autoClear]);

  // Keyboard shortcuts (extra #9)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          run();
          break;
        case "c":
        case "C":
          if (result) {
            navigator.clipboard.writeText(result.password).then(() => {
              setCopiedAt(Date.now());
              toast.success("Copied");
            });
          }
          break;
        case "1": setOpts({ ...opts, mode: "random" }); break;
        case "2": setOpts({ ...opts, mode: "passphrase" }); break;
        case "3": setOpts({ ...opts, mode: "pronounceable" }); break;
        case "4": setOpts({ ...opts, mode: "pin" }); break;
        case "5": setOpts({ ...opts, mode: "wifi" }); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run, result, opts]);

  const strength = useMemo(
    () => (result ? estimateStrength(result.entropyBits) : null),
    [result],
  );

  const patterns = useMemo(
    () => (result ? detectPatterns(result.password) : []),
    [result],
  );

  const updateMode = (mode: GenerationMode) => {
    setOpts({ ...opts, mode });
    setResult(null);
    setZxcvbnResult(null);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.password).then(() => {
      setCopiedAt(Date.now());
      toast.success("Password copied");
    });
  };

  const runBatch = () => {
    setError(null);
    try {
      const results = generateBatch(opts, batchCount);
      setBatchResults(results);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const sharePreset = () => {
    try {
      const encoded = encodePreset(opts);
      const url = `${window.location.origin}${window.location.pathname}?preset=${encoded}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Preset URL copied (does NOT include the password)");
      });
    } catch (e) {
      toast.error("Could not create preset URL");
    }
  };

  // Load preset from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("preset");
    if (preset) {
      try {
        const decoded = decodePreset(preset);
        setOpts(decoded);
        toast.success("Preset loaded from URL");
      } catch {
        toast.error("Invalid preset in URL");
      }
    }
  }, []);

  const runZxcvbn = async () => {
    if (!result) return;
    setZxcvbnLoading(true);
    try {
      const r = await crossCheckZxcvbn(result.password);
      setZxcvbnResult({ score: r.score, warning: r.warning, suggestions: r.suggestions });
    } catch (e) {
      toast.error("zxcvbn cross-check failed");
    } finally {
      setZxcvbnLoading(false);
    }
  };

  const clearHist = () => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => updateMode(m.id)}
                className={`px-2 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-center ${
                  opts.mode === m.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={opts.mode === m.id}
                aria-label={`${m.label} mode`}
              >
                <div className="font-semibold">{m.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{m.hint}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mode-specific options */}
      <ModeOptions opts={opts} setOpts={setOpts} />

      {/* Action bar */}
      <Card>
        <CardContent className="p-4">
          <ActionBar>
            <RunButton onClick={run} label="Generate" size="md" />
            <button
              type="button"
              onClick={sharePreset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer"
              title="Share preset (settings only, never the password)"
            >
              <Share2 className="h-3 w-3" /> Share preset
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer ${showHistory ? "bg-muted" : ""}`}
            >
              <History className="h-3 w-3" /> History ({history.length})
            </button>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={autoClear}
                onChange={(e) => setAutoClear(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
              />
              Auto-clear 30s
            </label>
          </ActionBar>
          <p className="text-[10px] text-muted-foreground mt-2">
            Shortcuts: <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Space</kbd>=regenerate ·{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">C</kbd>=copy ·{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">1-5</kbd>=modes
          </p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Generated password</Label>
              {strength && (
                <Badge variant="outline" className={`text-[10px] ${STRENGTH_COLORS[strength.label]}`}>
                  {strength.label} · {strength.bits} bits
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={result.password}
                className="font-mono text-sm flex-1"
                aria-label="Generated password"
              />
              <CopyButton getText={() => result.password} label="Copy" size="md" />
            </div>

            {/* Strength meter (extra #8) */}
            {strength && (
              <div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${STRENGTH_BAR[strength.label]}`}
                    style={{ width: `${Math.min(100, (strength.bits / 150) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Crack time (offline GPU, 10B/s): <span className="font-mono">{strength.crackTimeHuman}</span>
                </p>
              </div>
            )}

            {/* Pattern warnings (extra #2) */}
            {patterns.length > 0 && (
              <div className="space-y-1">
                {patterns.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    <span>{p.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Diceware rolls display */}
            {result.diceRolls && (
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[10px] text-muted-foreground mb-1">Dice rolls (4 dice per word):</p>
                <div className="flex flex-wrap gap-2">
                  {result.diceRolls.map((group, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <Dice5 className="h-3 w-3 text-muted-foreground" />
                      <code className="text-[10px] font-mono">{group.join("-")}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* zxcvbn cross-check button + result */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={runZxcvbn}
                disabled={zxcvbnLoading}
                className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                {zxcvbnLoading ? "Running zxcvbn…" : "Cross-check with zxcvbn (lazy-loaded)"}
              </button>
              {zxcvbnResult && (
                <div className="text-xs text-muted-foreground">
                  zxcvbn score: <span className="font-mono font-semibold">{zxcvbnResult.score}/4</span>
                  {zxcvbnResult.warning && (
                    <span className="text-amber-600 dark:text-amber-400 ml-2">⚠ {zxcvbnResult.warning}</span>
                  )}
                  {zxcvbnResult.suggestions.length > 0 && (
                    <div className="mt-1 text-[10px]">
                      {zxcvbnResult.suggestions.map((s, i) => <div key={i}>• {s}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History panel (extra #1) */}
      {showHistory && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Recent passwords (last 10, local only)</Label>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHist}
                  className="text-xs text-red-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet. Generate a password to start.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <code className="font-mono break-all">{h.password}</code>
                    <Badge variant="outline" className="text-[9px]">{h.mode}</Badge>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(h.password);
                        toast.success("Copied from history");
                      }}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch generation (blueprint feature + extra #7) */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-semibold">Batch generate</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={100}
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                className="w-20 font-mono text-sm"
                aria-label="Batch count"
              />
              <RunButton onClick={runBatch} label="Generate batch" size="sm" />
            </div>
          </div>
          {batchResults && (
            <>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {batchResults.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <code className="font-mono break-all">{r.password}</code>
                    <CopyButton getText={() => r.password} label="" size="icon-sm" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => {
                    const csv = toCsv(batchResults);
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "passwords.csv";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.success("CSV downloaded");
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer"
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const json = toJson(batchResults);
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "passwords.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.success("JSON downloaded");
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer"
                >
                  <Download className="h-3 w-3" /> JSON
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> passwords are
            generated locally using <code>crypto.getRandomValues</code> (CSPRNG
            with rejection sampling). Nothing leaves your browser. History is
            stored in localStorage and never transmitted. The optional zxcvbn
            cross-check runs locally (lazy-loaded).{" "}
            <strong>HIBP breach check intentionally omitted</strong> to preserve
            the offline-first guarantee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Mode-specific options =====

function ModeOptions({
  opts,
  setOpts,
}: {
  opts: PasswordOptions;
  setOpts: (o: PasswordOptions) => void;
}) {
  switch (opts.mode) {
    case "random":
      return <RandomOptionsUI opts={opts.random!} setOpts={(r) => setOpts({ ...opts, random: r })} />;
    case "passphrase":
      return <PassphraseOptionsUI opts={opts.passphrase!} setOpts={(p) => setOpts({ ...opts, passphrase: p })} />;
    case "pronounceable":
      return <PronounceableOptionsUI opts={opts.pronounceable!} setOpts={(p) => setOpts({ ...opts, pronounceable: p })} />;
    case "pin":
      return <PinOptionsUI opts={opts.pin!} setOpts={(p) => setOpts({ ...opts, pin: p })} />;
    case "wifi":
      return <WifiOptionsUI opts={opts.wifi!} setOpts={(w) => setOpts({ ...opts, wifi: w })} />;
    case "diceware":
      return <DicewareOptionsUI opts={opts.diceware!} setOpts={(d) => setOpts({ ...opts, diceware: d })} />;
    default:
      return null;
  }
}

function RandomOptionsUI({ opts, setOpts }: { opts: typeof DEFAULT_RANDOM; setOpts: (o: typeof DEFAULT_RANDOM) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pwd-length" className="text-sm">Length</Label>
            <Badge variant="outline" className="font-mono text-xs">{opts.length}</Badge>
          </div>
          <Slider id="pwd-length" value={[opts.length]} min={4} max={64} step={1}
            onValueChange={(v) => setOpts({ ...opts, length: v[0] })} aria-label="Password length" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>4</span><span>16</span><span>32</span><span>48</span><span>64</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-lower">
            <input id="opt-lower" type="checkbox" checked={opts.lowercase}
              onChange={(e) => setOpts({ ...opts, lowercase: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Lowercase (a-z)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-upper">
            <input id="opt-upper" type="checkbox" checked={opts.uppercase}
              onChange={(e) => setOpts({ ...opts, uppercase: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Uppercase (A-Z)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-num">
            <input id="opt-num" type="checkbox" checked={opts.numbers}
              onChange={(e) => setOpts({ ...opts, numbers: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Numbers (0-9)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-sym">
            <input id="opt-sym" type="checkbox" checked={opts.symbols}
              onChange={(e) => setOpts({ ...opts, symbols: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Symbols (!@#$)</span>
          </label>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="opt-ambig">
          <input id="opt-ambig" type="checkbox" checked={opts.excludeAmbiguous}
            onChange={(e) => setOpts({ ...opts, excludeAmbiguous: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
          <span>Exclude ambiguous (0/O, 1/l/I)</span>
        </label>
        {/* Per-class minimums (blueprint feature) */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Per-class minimums (advanced)</summary>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div className="space-y-1">
              <Label htmlFor="min-lower" className="text-[10px]">Min lowercase</Label>
              <Input id="min-lower" type="number" min={0} max={20} value={opts.minLower ?? 0}
                onChange={(e) => setOpts({ ...opts, minLower: parseInt(e.target.value, 10) || 0 })}
                className="w-full font-mono text-xs" disabled={!opts.lowercase} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="min-upper" className="text-[10px]">Min uppercase</Label>
              <Input id="min-upper" type="number" min={0} max={20} value={opts.minUpper ?? 0}
                onChange={(e) => setOpts({ ...opts, minUpper: parseInt(e.target.value, 10) || 0 })}
                className="w-full font-mono text-xs" disabled={!opts.uppercase} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="min-num" className="text-[10px]">Min numbers</Label>
              <Input id="min-num" type="number" min={0} max={20} value={opts.minNumbers ?? 0}
                onChange={(e) => setOpts({ ...opts, minNumbers: parseInt(e.target.value, 10) || 0 })}
                className="w-full font-mono text-xs" disabled={!opts.numbers} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="min-sym" className="text-[10px]">Min symbols</Label>
              <Input id="min-sym" type="number" min={0} max={20} value={opts.minSymbols ?? 0}
                onChange={(e) => setOpts({ ...opts, minSymbols: parseInt(e.target.value, 10) || 0 })}
                className="w-full font-mono text-xs" disabled={!opts.symbols} />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function PassphraseOptionsUI({ opts, setOpts }: { opts: typeof DEFAULT_PASSPHRASE; setOpts: (o: typeof DEFAULT_PASSPHRASE) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pp-count" className="text-sm">Word count</Label>
            <Badge variant="outline" className="font-mono text-xs">{opts.wordCount}</Badge>
          </div>
          <Slider id="pp-count" value={[opts.wordCount]} min={3} max={12} step={1}
            onValueChange={(v) => setOpts({ ...opts, wordCount: v[0] })} aria-label="Word count" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-sep" className="text-sm">Separator</Label>
          <Input id="pp-sep" value={opts.separator} maxLength={3}
            onChange={(e) => setOpts({ ...opts, separator: e.target.value })}
            className="w-20 font-mono" aria-label="Separator" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="pp-cap">
          <input id="pp-cap" type="checkbox" checked={opts.capitalize}
            onChange={(e) => setOpts({ ...opts, capitalize: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
          <span>Capitalize each word</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="pp-num">
          <input id="pp-num" type="checkbox" checked={opts.includeNumber}
            onChange={(e) => setOpts({ ...opts, includeNumber: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
          <span>Append a number to a random word</span>
        </label>
      </CardContent>
    </Card>
  );
}

function PronounceableOptionsUI({ opts, setOpts }: { opts: typeof DEFAULT_PRONOUNCEABLE; setOpts: (o: typeof DEFAULT_PRONOUNCEABLE) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pr-length" className="text-sm">Length</Label>
            <Badge variant="outline" className="font-mono text-xs">{opts.length}</Badge>
          </div>
          <Slider id="pr-length" value={[opts.length]} min={8} max={32} step={1}
            onValueChange={(v) => setOpts({ ...opts, length: v[0] })} aria-label="Pronounceable length" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="pr-cap">
            <input id="pr-cap" type="checkbox" checked={opts.capitalize}
              onChange={(e) => setOpts({ ...opts, capitalize: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Capitalize</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="pr-num">
            <input id="pr-num" type="checkbox" checked={opts.includeNumbers}
              onChange={(e) => setOpts({ ...opts, includeNumbers: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Numbers</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm" htmlFor="pr-sym">
            <input id="pr-sym" type="checkbox" checked={opts.includeSymbols}
              onChange={(e) => setOpts({ ...opts, includeSymbols: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
            <span>Symbols</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function PinOptionsUI({ opts, setOpts }: { opts: typeof DEFAULT_PIN; setOpts: (o: typeof DEFAULT_PIN) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="pin-digits" className="text-sm">Digits</Label>
          <Badge variant="outline" className="font-mono text-xs">{opts.digits}</Badge>
        </div>
        <Slider id="pin-digits" value={[opts.digits]} min={4} max={8} step={1}
          onValueChange={(v) => setOpts({ ...opts, digits: v[0] })} aria-label="PIN digits" />
        <p className="text-[10px] text-muted-foreground">
          PINs are optimized for phone unlock screens. Use 6+ digits for security.
        </p>
      </CardContent>
    </Card>
  );
}

function WifiOptionsUI({ opts, setOpts }: { opts: typeof DEFAULT_WIFI; setOpts: (o: typeof DEFAULT_WIFI) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="wifi-length" className="text-sm">Length</Label>
          <Badge variant="outline" className="font-mono text-xs">{opts.length}</Badge>
        </div>
        <Slider id="wifi-length" value={[opts.length]} min={8} max={63} step={1}
          onValueChange={(v) => setOpts({ ...opts, length: v[0] })} aria-label="WiFi password length" />
        <p className="text-[10px] text-muted-foreground">
          Uses full printable ASCII (94 chars) for max entropy. 63 chars = WPA2/WPA3 max.
          At 63 chars, entropy ≈ 412 bits — uncrackable offline.
        </p>
      </CardContent>
    </Card>
  );
}

function DicewareOptionsUI({ opts, setOpts }: { opts: typeof DEFAULT_DICEWARE; setOpts: (o: typeof DEFAULT_DICEWARE) => void }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="dw-count" className="text-sm">Word count</Label>
            <Badge variant="outline" className="font-mono text-xs">{opts.wordCount}</Badge>
          </div>
          <Slider id="dw-count" value={[opts.wordCount]} min={4} max={10} step={1}
            onValueChange={(v) => setOpts({ ...opts, wordCount: v[0] })} aria-label="Diceware word count" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dw-sep" className="text-sm">Separator</Label>
          <Input id="dw-sep" value={opts.separator} maxLength={3}
            onChange={(e) => setOpts({ ...opts, separator: e.target.value })}
            className="w-20 font-mono" aria-label="Separator" />
        </div>
        <p className="text-[10px] text-muted-foreground">
          True physical diceware uses 5 dice per word. We use 4 dice + EFF short
          wordlist for faster generation. Dice rolls are shown after generation
          so you can verify the math.
        </p>
      </CardContent>
    </Card>
  );
}
