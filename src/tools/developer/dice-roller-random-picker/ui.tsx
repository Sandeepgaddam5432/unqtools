"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  DICE_TYPES,
  SAMPLE_EXPRESSIONS,
  SAMPLE_SEED,
  createPrng,
  parseDiceNotation,
  rollExpression,
  flipCoin,
  pickFromList,
  pickWeighted,
  parsePickerList,
  computeRollStats,
  collectDieRolls,
  renderRollText,
  renderRollJson,
  renderRollsCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RollResult,
  type HistoryEntry,
} from "./logic";
import { History, Dices, ListChecks, Coins, Sparkles, ArrowRight } from "lucide-react";

type Tab = "dice" | "picker" | "coin";
type OutputFormat = "text" | "json" | "csv";

export default function DiceRollerRandomPicker() {
  const [tab, setTab] = useState<Tab>("dice");
  const [expression, setExpression] = useState("3d6+2");
  const [seedInput, setSeedInput] = useState<string>(String(SAMPLE_SEED));
  const [rollCount, setRollCount] = useState(1);
  const [results, setResults] = useState<RollResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("text");

  // Picker state
  const [pickerText, setPickerText] = useState("apple\nbanana\ncherry");
  const [weighted, setWeighted] = useState(false);
  const [pickerResult, setPickerResult] = useState<string | null>(null);

  // Coin state
  const [coinResult, setCoinResult] = useState<"heads" | "tails" | null>(null);
  const [coinStreak, setCoinStreak] = useState<{ side: "heads" | "tails"; count: number }>({ side: "heads", count: 0 });

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.expression) {
        setExpression(parsed.expression);
        setTab("dice");
      }
      if (parsed.seed !== null) setSeedInput(String(parsed.seed));
      if (parsed.expression || parsed.seed !== null) toast.info("Loaded from share link");
    }
  }, []);

  const seed = useMemo(() => {
    const n = Number(seedInput);
    if (Number.isFinite(n) && n > 0) return n >>> 0;
    return null;
  }, [seedInput]);

  const handleRoll = useCallback(() => {
    const parsed = parseDiceNotation(expression);
    if (!parsed.ok) {
      setError(parsed.error ?? "Invalid expression.");
      setResults([]);
      toast.error(parsed.error ?? "Invalid expression.");
      return;
    }
    setError(null);
    const out: RollResult[] = [];
    for (let i = 0; i < rollCount; i++) {
      const prng = createPrng(seed);
      out.push(rollExpression(prng, expression));
    }
    setResults(out);
    saveHistory({
      ts: Date.now(),
      expression,
      total: out[0]?.ok ? out[0].total : 0,
      seed,
      parts: out[0]?.ok ? out[0].parts.length : 0,
    });
    setHistory(loadHistory());
    toast.success(`Rolled ${rollCount}× ${expression}`);
  }, [expression, seed, rollCount]);

  const handleRandomSeed = useCallback(() => {
    const s = Math.floor(Math.random() * 0x100000000) >>> 0;
    setSeedInput(String(s));
    toast.info(`Seed: ${s}`);
  }, []);

  const handleClearSeed = useCallback(() => {
    setSeedInput("");
    toast.info("Seed cleared — using Math.random");
  }, []);

  const handleClear = useCallback(() => {
    setResults([]);
    setError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handlePick = useCallback(() => {
    const parsed = parsePickerList(pickerText);
    if (parsed.items.length === 0) {
      toast.error("Add at least one item to the list.");
      return;
    }
    const prng = createPrng(seed);
    try {
      const r = weighted ? pickWeighted(prng, parsed.weighted) : pickFromList(prng, parsed.items);
      setPickerResult(r);
      toast.success(`Picked: ${r}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [pickerText, weighted, seed]);

  const handleFlip = useCallback(() => {
    const prng = createPrng(seed);
    const r = flipCoin(prng);
    setCoinResult(r);
    setCoinStreak((prev) => {
      if (prev.side === r) return { side: r, count: prev.count + 1 };
      return { side: r, count: 1 };
    });
  }, [seed]);

  // Aggregate die rolls across all results for stats.
  const allDieRolls = useMemo(() => {
    const out: number[] = [];
    for (const r of results) if (r.ok) out.push(...collectDieRolls(r));
    return out;
  }, [results]);

  const stats = useMemo(() => computeRollStats(allDieRolls), [allDieRolls]);

  const output = useMemo(() => {
    if (results.length === 0) return "";
    if (outputFormat === "json") {
      return JSON.stringify(results.map(renderRollJson).map((s) => JSON.parse(s)), null, 2);
    }
    if (outputFormat === "csv") {
      return renderRollsCsv(results.filter((r) => r.ok).map((r) => ({ expression: r.expression, total: r.total })));
    }
    return results.map(renderRollText).join("\n\n---\n\n");
  }, [results, outputFormat]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "dice"} onClick={() => setTab("dice")} icon={<Dices className="h-4 w-4" />} label="Dice Roller" />
            <TabButton active={tab === "picker"} onClick={() => setTab("picker")} icon={<ListChecks className="h-4 w-4" />} label="Random Picker" />
            <TabButton active={tab === "coin"} onClick={() => setTab("coin")} icon={<Coins className="h-4 w-4" />} label="Coin Flip" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Seed (optional — for reproducibility)
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              type="number"
              min={0}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="e.g. 42 — leave blank for Math.random"
              className="h-8 text-xs w-64"
            />
            <Button variant="outline" size="sm" onClick={handleRandomSeed}>Random</Button>
            <ClearButton onClick={handleClearSeed} label="Clear seed" disabled={!seedInput} />
            {seed !== null ? (
              <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-500/40">
                Seeded (reproducible)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40">
                Math.random (non-reproducible)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {tab === "dice" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="dice-expr" className="text-sm font-semibold">Dice notation</Label>
                <select
                  value=""
                  onChange={(e) => e.target.value && setExpression(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">Examples…</option>
                  {SAMPLE_EXPRESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Input
                id="dice-expr"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g. 3d6+2, 4d6kh3, 2d20kl1, d6!"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {DICE_TYPES.map((d) => (
                  <Button
                    key={d.value}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-mono"
                    onClick={() => setExpression(`1${d.value}`)}
                  >
                    {d.label}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setExpression((p) => `${p}+`)}>+</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setExpression((p) => `${p}-`)}>−</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setExpression((p) => `${p}kh1`)}>kh</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setExpression((p) => `${p}kl1`)}>kl</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setExpression((p) => `${p}!`)}>!</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Field label="Roll count">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={rollCount}
                    onChange={(e) => setRollCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                    className="h-8 text-xs w-20"
                  />
                </Field>
                <Button size="sm" onClick={handleRoll} className="gap-1.5 mt-5">
                  <Dices className="h-3.5 w-3.5" /> Roll
                </Button>
                <div className="mt-5">
                  <ClearButton onClick={handleClear} disabled={results.length === 0} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                Notation: <code>3d6</code> (3 dice), <code>3d6+2</code> (modifier), <code>4d6kh3</code> (keep highest 3),
                <code> 2d20kl1</code> (keep lowest — disadvantage), <code>d6!</code> (exploding), <code>1d20-1d4</code> (subtract term).
              </p>
            </CardContent>
          </Card>

          {error && <ErrorBanner message={error} />}

          {results.length > 0 && (
            <>
              {allDieRolls.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> Roll stats ({allDieRolls.length} individual dice)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                      <Stat label="Dice rolled" value={stats.count} />
                      <Stat label="Sum" value={stats.sum} />
                      <Stat label="Mean" value={stats.mean.toFixed(2)} />
                      <Stat label="Min" value={stats.min} />
                      <Stat label="Max" value={stats.max} />
                      <Stat label="Range" value={stats.max - stats.min} />
                    </div>
                    {Object.keys(stats.distribution).length > 0 && (
                      <div className="space-y-1 pt-2">
                        {Object.entries(stats.distribution)
                          .sort((a, b) => Number(a[0]) - Number(b[0]))
                          .map(([face, count]) => {
                            const max = Math.max(...Object.values(stats.distribution));
                            const pct = (count / max) * 100;
                            return (
                              <div key={face} className="flex items-center gap-2 text-[10px]">
                                <span className="font-mono text-muted-foreground w-8 text-right">{face}</span>
                                <div className="flex-1 bg-muted rounded h-3 overflow-hidden">
                                  <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-8 text-right font-mono">{count}</span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Dices className="h-4 w-4" /> Results ({results.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                        className="h-8 text-xs rounded border bg-background px-2"
                      >
                        <option value="text">Text</option>
                        <option value="json">JSON</option>
                        <option value="csv">CSV (totals)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {results.slice(0, 20).map((r, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                        {r.ok ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                Total: {r.total}
                              </Badge>
                              <span className="font-mono text-muted-foreground">{r.expression}</span>
                            </div>
                            <div className="mt-1.5 space-y-1">
                              {r.parts.map((p, j) => (
                                <div key={j} className="flex items-center gap-1.5 text-[10px]">
                                  <span className="font-mono text-muted-foreground">
                                    {p.kind === "dice" ? (p.negate ? "−" : "+") : (p.value >= 0 ? "+" : "−")}
                                  </span>
                                  <span className="font-mono">{p.notation}</span>
                                  {p.kind === "dice" && (
                                    <span className="font-mono text-muted-foreground">
                                      [{p.rolls.join(",")}] → kept [{p.kept.join(",")}] = {p.value}
                                    </span>
                                  )}
                                  {p.kind === "constant" && (
                                    <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                                  )}
                                  {p.kind === "constant" && <span className="font-mono">{p.value}</span>}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-destructive">Error: {r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Textarea
                    readOnly
                    value={output}
                    className="min-h-[120px] resize-y font-mono text-[11px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => output} label="Copy" />
                    <DownloadButton
                      getText={() => output}
                      filename={
                        outputFormat === "json" ? "dice-rolls.json"
                        : outputFormat === "csv" ? "dice-rolls.csv"
                        : "dice-rolls.txt"
                      }
                      mime={
                        outputFormat === "json" ? "application/json"
                        : outputFormat === "csv" ? "text/csv"
                        : "text/plain"
                      }
                      label={`Download .${outputFormat === "text" ? "txt" : outputFormat}`}
                    />
                    <ShareButton getUrl={() => buildShareUrl({ expression, seed })} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {results.length === 0 && !error && (
            <EmptyState
              title="Enter dice notation and roll"
              hint="Supports 3d6+2, 4d6kh3 (keep highest 3), 2d20kl1 (disadvantage), d6! (exploding), and multi-term expressions. Seed for reproducibility."
              icon={<Dices className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "picker" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="picker-list" className="text-sm font-semibold">Items (one per line)</Label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
                  Weighted
                </label>
              </div>
              <Textarea
                id="picker-list"
                value={pickerText}
                onChange={(e) => setPickerText(e.target.value)}
                placeholder={weighted ? "apple :: 3\nbanana :: 1\ncherry :: 2" : "apple\nbanana\ncherry"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {weighted
                  ? <>Weighted syntax: <code>item :: weight</code> or <code>item:weight</code>. Heavier weights get higher probability.</>
                  : <>Unweighted: each item has equal probability. Toggle Weighted for custom weights.</>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handlePick} className="gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" /> Pick one
                </Button>
                <ClearButton onClick={() => setPickerResult(null)} disabled={!pickerResult} />
              </div>
            </CardContent>
          </Card>

          {pickerResult && (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Picked</p>
                <p className="text-3xl font-bold text-foreground mt-2">{pickerResult}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "coin" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Coin flip</h3>
                {coinStreak.count > 1 && (
                  <Badge variant="outline" className="text-[10px]">
                    {coinStreak.count}× {coinStreak.side} in a row
                  </Badge>
                )}
              </div>
              <Button size="lg" onClick={handleFlip} className="gap-2 w-full">
                <Coins className="h-5 w-5" /> Flip coin
              </Button>
            </CardContent>
          </Card>
          {coinResult && (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Result</p>
                <p className="text-4xl font-bold text-foreground mt-2 capitalize">{coinResult}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Roll history ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] font-mono">{h.total}</Badge>
                  <code className="font-mono">{h.expression}</code>
                  {h.seed !== null && (
                    <Badge variant="outline" className="text-[10px]">seed={h.seed}</Badge>
                  )}
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All rolls, picks, and flips run locally — nothing is uploaded.
            History (last 20) is stored in localStorage on this device only. The share URL encodes your expression and seed
            in the fragment, which browsers never send to servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
    >
      {icon} {label}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
