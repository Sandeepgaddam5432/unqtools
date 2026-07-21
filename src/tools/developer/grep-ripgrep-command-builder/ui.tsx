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
  DEFAULT_CONFIG,
  FLAVOR_LABELS,
  FLAVOR_HINTS,
  SAMPLE_TEXTS,
  RECIPES,
  TRANSLATION_TABLE,
  shellQuote,
  buildGrepCommand,
  buildRgCommand,
  buildCommands,
  explainIntent,
  explainFlags,
  validateConfig,
  runMatch,
  highlightRanges,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BuilderConfig,
  type RegexFlavor,
  type HistoryEntry,
} from "./logic";
import {
  Search, History, BookOpen, AlertTriangle, Wand2,
  Plus, X, ChevronRight, Lightbulb,
} from "lucide-react";

type Tab = "builder" | "match" | "explain" | "translate" | "recipes";

const FLAVORS: RegexFlavor[] = ["bre", "ere", "pcre", "rust"];

export default function GrepRipgrepCommandBuilder() {
  const [config, setConfig] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [sample, setSample] = useState<string>(SAMPLE_TEXTS[0].text);
  const [tab, setTab] = useState<Tab>("builder");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.config.pattern) setConfig((c) => ({ ...c, ...p.config }));
      if (p.sample) setSample(p.sample);
      if (p.config.pattern || p.sample) toast.info("Loaded from share link");
    }
  }, []);

  const grep = useMemo(() => buildGrepCommand(config), [config]);
  const rg = useMemo(() => buildRgCommand(config), [config]);
  const intent = useMemo(() => explainIntent(config), [config]);
  const flags = useMemo(() => explainFlags(config), [config]);
  const validation = useMemo(() => validateConfig(config), [config]);
  const match = useMemo(
    () => runMatch(config.pattern, sample, config),
    [config.pattern, config.flavor, config.ignoreCase, config.wholeWord, config.invert, config.count, config.onlyMatching, config.multiline, config.fixedString, sample],
  );

  const handleSaveHistory = useCallback(() => {
    if (config.pattern) {
      saveHistory({
        ts: Date.now(),
        pattern: config.pattern,
        flavor: config.flavor,
        matchCount: match.count,
      });
      setHistory(loadHistory());
    }
  }, [config.pattern, config.flavor, match.count]);

  const update = <K extends keyof BuilderConfig>(key: K, value: BuilderConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const toggle = (key: keyof BuilderConfig) => {
    setConfig((c) => ({ ...c, [key]: !c[key as keyof BuilderConfig] as unknown as never }));
  };

  const addGlob = (key: "includes" | "excludes" | "excludeDirs", value: string) => {
    if (!value.trim()) return;
    setConfig((c) => ({ ...c, [key]: [...c[key], value.trim()] }));
  };

  const removeGlob = (key: "includes" | "excludes" | "excludeDirs", idx: number) => {
    setConfig((c) => ({ ...c, [key]: c[key].filter((_, i) => i !== idx) }));
  };

  const handleClear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setSample(SAMPLE_TEXTS[0].text);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadRecipe = (id: string) => {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return;
    setConfig((c) => ({ ...DEFAULT_CONFIG, ...recipe.config }));
    if (recipe.sample) setSample(recipe.sample);
    setTab("builder");
    toast.success(`Loaded recipe: ${recipe.label}`);
  };

  const pathsText = config.paths.join("\n");

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["builder", "match", "explain", "translate", "recipes"] as Tab[]).map((t) => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
                className="text-xs"
              >
                {t === "builder" && <Wand2 className="h-3 w-3 mr-1" />}
                {t === "match" && <Search className="h-3 w-3 mr-1" />}
                {t === "explain" && <Lightbulb className="h-3 w-3 mr-1" />}
                {t === "translate" && <ChevronRight className="h-3 w-3 mr-1" />}
                {t === "recipes" && <BookOpen className="h-3 w-3 mr-1" />}
                {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "builder" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grb-pattern">Pattern</Label>
              <Input
                id="grb-pattern"
                value={config.pattern}
                onChange={(e) => update("pattern", e.target.value)}
                placeholder="TODO|FIXME"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Shell-quoted in output: <code className="font-mono">{shellQuote(config.pattern || "")}</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Regex flavor</Label>
              <div className="flex flex-wrap gap-2">
                {FLAVORS.map((f) => (
                  <Button
                    key={f}
                    variant={config.flavor === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("flavor", f)}
                    className="text-xs"
                  >
                    {FLAVOR_LABELS[f]}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{FLAVOR_HINTS[config.flavor]}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Flags</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {[
                  { k: "ignoreCase", label: "-i ignore case" },
                  { k: "wholeWord", label: "-w whole word" },
                  { k: "invert", label: "-v invert" },
                  { k: "count", label: "-c count" },
                  { k: "lineNumbers", label: "-n line numbers" },
                  { k: "recursive", label: "-r recursive" },
                  { k: "fixedString", label: "-F fixed string" },
                  { k: "onlyMatching", label: "-o only match" },
                  { k: "multiline", label: "-U multiline" },
                  { k: "noFiltering", label: "-uuu no filter" },
                ].map((opt) => (
                  <label key={opt.k} className="flex items-center gap-1.5 text-xs cursor-pointer rounded border bg-background px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={config[opt.k as keyof BuilderConfig] as boolean}
                      onChange={() => toggle(opt.k as keyof BuilderConfig)}
                    />
                    <span className="font-mono">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Context -B (before)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.contextBefore}
                  onChange={(e) => update("contextBefore", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Context -A (after)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.contextAfter}
                  onChange={(e) => update("contextAfter", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Context -C (both)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.contextBoth}
                  onChange={(e) => update("contextBoth", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="font-mono"
                />
              </div>
            </div>

            <GlobEditor
              label="Includes (grep --include / rg -g)"
              items={config.includes}
              onAdd={(v) => addGlob("includes", v)}
              onRemove={(i) => removeGlob("includes", i)}
              placeholder="*.py"
            />
            <GlobEditor
              label="Excludes (grep --exclude / rg -g '!...')"
              items={config.excludes}
              onAdd={(v) => addGlob("excludes", v)}
              onRemove={(i) => removeGlob("excludes", i)}
              placeholder="*.log"
            />
            <GlobEditor
              label="Exclude dirs (grep --exclude-dir / rg -g '!dir/**')"
              items={config.excludeDirs}
              onAdd={(v) => addGlob("excludeDirs", v)}
              onRemove={(i) => removeGlob("excludeDirs", i)}
              placeholder="node_modules"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">rg type (-t)</Label>
                <Input
                  value={config.rgType}
                  onChange={(e) => update("rgType", e.target.value)}
                  placeholder="py"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">rg type-not (-T)</Label>
                <Input
                  value={config.rgTypeNot}
                  onChange={(e) => update("rgTypeNot", e.target.value)}
                  placeholder="md"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="grb-replace">Replace preview (rg -r only)</Label>
              <Input
                id="grb-replace"
                value={config.replace}
                onChange={(e) => update("replace", e.target.value)}
                placeholder="FIXME (rg only; grep falls back to sed note)"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="grb-paths">Paths (one per line)</Label>
              <Textarea
                id="grb-paths"
                value={pathsText}
                onChange={(e) => update("paths", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                placeholder="."
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="grb-sample">Sample text (for live tester)</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {SAMPLE_TEXTS.map((s) => (
                  <Button
                    key={s.id}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setSample(s.text)}
                  >
                    + {s.label}
                  </Button>
                ))}
              </div>
              <Textarea
                id="grb-sample"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
                placeholder="Paste text here to test the pattern live"
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>

            {validation.errors.length > 0 && (
              <ErrorBanner message={validation.errors.join(" ")} />
            )}
            {validation.warnings.length > 0 && (
              <div className="rounded border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />
                {validation.warnings.join(" ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "match" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4" /> Live pattern tester
              </h3>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-[10px]">{config.flavor.toUpperCase()}</Badge>
                <Badge variant="outline" className="text-[10px]">{match.count} match(es)</Badge>
              </div>
            </div>
            {!match.ok && <ErrorBanner message={match.error ?? "Invalid pattern"} />}
            {match.ok && match.count === 0 && (
              <p className="text-xs text-muted-foreground">No matches found.</p>
            )}
            {match.ok && match.matches.length > 0 && (
              <div className="space-y-1 max-h-[400px] overflow-auto rounded border bg-background p-2">
                {match.matches.map((m, i) => (
                  <div key={i} className="font-mono text-xs whitespace-pre-wrap break-all">
                    <span className="text-muted-foreground mr-2">{m.line}:</span>
                    {highlightRanges(m.text, m.ranges).map((seg, j) => (
                      <span key={j} className={seg.match ? "bg-yellow-200 dark:bg-yellow-600/50 text-foreground" : ""}>
                        {seg.text}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {match.ok && match.count > 0 && match.matches.length === 0 && (
              <div className="rounded border bg-background p-3 text-xs">
                <Badge variant="outline">{match.count} matches</Badge>
                <span className="ml-2 text-muted-foreground">(count mode — lines suppressed)</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              The tester uses JavaScript RegExp adapted to approximate each flavor. For production, always verify against the real tool.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "explain" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Plain-English explanation
            </h3>
            <p className="text-xs text-foreground">{intent}</p>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Per-flag notes</h4>
              {flags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No flags active.</p>
              ) : (
                <div className="space-y-1">
                  {flags.map((f, i) => (
                    <div key={i} className="flex gap-2 items-start rounded border bg-background px-2 py-1.5 text-xs">
                      <Badge variant="outline" className="font-mono text-[10px] flex-shrink-0">{f.flag}</Badge>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">{f.tool}</Badge>
                      <span className="text-foreground">{f.explanation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "translate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4" /> grep ↔ ripgrep translation
            </h3>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1.5 pr-2">Intent</th>
                    <th className="py-1.5 pr-2">grep</th>
                    <th className="py-1.5 pr-2">rg</th>
                    <th className="py-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSLATION_TABLE.map((t, i) => (
                    <tr key={i} className="border-b align-top">
                      <td className="py-1.5 pr-2 font-medium">{t.intent}</td>
                      <td className="py-1.5 pr-2 font-mono text-[11px]">{t.grep}</td>
                      <td className="py-1.5 pr-2 font-mono text-[11px]">{t.rg}</td>
                      <td className="py-1.5 text-muted-foreground">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "recipes" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Recipe library ({RECIPES.length})
            </h3>
            {RECIPES.map((r) => (
              <div key={r.id} className="rounded border bg-background p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{r.label}</span>
                  <Button size="sm" variant="outline" onClick={() => loadRecipe(r.id)} className="h-6 text-[11px]">
                    Load
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="font-mono text-[10px]">pattern: {r.config.pattern}</Badge>
                  <Badge variant="outline" className="text-[10px]">flavor: {r.config.flavor}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Always-visible command preview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Generated commands
          </h3>
          <CommandBlock title="grep" command={grep.command} notes={grep.notes} onCopy={handleSaveHistory} />
          <CommandBlock title="rg" command={rg.command} notes={rg.notes} onCopy={handleSaveHistory} />
          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton getText={() => { handleSaveHistory(); return `${grep.command}\n\n# ripgrep equivalent:\n${rg.command}`; }} label="Copy both" />
            <DownloadButton
              getText={() => `${grep.command}\n\n# ripgrep equivalent:\n${rg.command}\n\n# Intent:\n${intent}`}
              filename="grep-rg-commands.txt"
              mime="text/plain"
              label="Download .txt"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config, sample); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setConfig((c) => ({ ...c, pattern: h.pattern, flavor: h.flavor }));
                    toast.info(`Restored pattern: ${h.pattern}`);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent/50"
                >
                  <Badge variant="outline" className="mr-2 font-mono text-[10px]">{h.flavor}</Badge>
                  <Badge variant="secondary" className="mr-2 text-[10px]">{h.matchCount} matches</Badge>
                  <span className="font-mono text-foreground">{h.pattern}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Pattern testing runs locally — your sample text never leaves the browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GlobEditor({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {items.map((g, i) => (
          <Badge key={i} variant="secondary" className="font-mono text-[10px] gap-1">
            {g}
            <button onClick={() => onRemove(i)} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onAdd(value); setValue(""); }
          }}
          placeholder={placeholder}
          className="font-mono text-xs h-8"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => { onAdd(value); setValue(""); }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function CommandBlock({
  title,
  command,
  notes,
  onCopy,
}: {
  title: string;
  command: string;
  notes: string[];
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="font-mono text-[10px]">{title}</Badge>
        </div>
        <CopyButton getText={() => { onCopy(); return command; }} label={`Copy ${title}`} size="sm" />
      </div>
      <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
        <code>{command}</code>
      </pre>
      {notes.length > 0 && (
        <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-0.5">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
