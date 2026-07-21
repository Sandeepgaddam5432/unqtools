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
  SAMPLE_DATA,
  FS_PRESETS,
  RECIPE_LIBRARY,
  buildAwkProgram,
  buildAwkCommand,
  explainConfig,
  explainProgram,
  presetPrintColumns,
  presetFilter,
  presetAggregate,
  runAwk,
  validateProgram,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AwkConfig,
  type AwkVariable,
  type AggregationType,
  type HistoryEntry,
} from "./logic";
import {
  History, Terminal, Play, BookOpen, Wand2, AlertTriangle,
  Plus, Trash2, Lightbulb,
} from "lucide-react";

type Tab = "raw" | "builder" | "explain";

export default function AwkCommandBuilderTester() {
  const [program, setProgram] = useState("{ print $1 }");
  const [input, setInput] = useState(SAMPLE_DATA[0].input);
  const [config, setConfig] = useState<AwkConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("raw");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.program) setProgram(p.program);
      if (p.input) setInput(p.input);
      if (p.fs) setConfig((c) => ({ ...c, fieldSeparator: p.fs }));
      if (p.program || p.input) toast.info("Loaded from share link");
    }
  }, []);

  // Run interpreter live.
  const run = useMemo(
    () => runAwk(program, input, { fs: config.fieldSeparator, ofs: config.outputSeparator, variables: config.variables }),
    [program, input, config.fieldSeparator, config.outputSeparator, config.variables],
  );
  const parseErr = useMemo(() => validateProgram(program), [program]);

  // Builder output (raw program from builder, plus command + explanations).
  const built = useMemo(() => {
    const prog = buildAwkProgram(config);
    const cmd = buildAwkCommand(config);
    const expl = explainConfig(config);
    return { prog, cmd, expl };
  }, [config]);

  // Reverse explainer annotations.
  const annotations = useMemo(() => explainProgram(program), [program]);

  // When in builder tab and config changes, sync the raw program.
  useEffect(() => {
    if (tab === "builder") {
      setProgram(built.prog);
    }
  }, [built.prog, tab]);

  const handleSaveHistory = useCallback(() => {
    if (program) {
      saveHistory({
        ts: Date.now(),
        program,
        inputPreview: input.slice(0, 60),
        command: built.cmd,
      });
      setHistory(loadHistory());
    }
  }, [program, input, built.cmd]);

  const handleClear = useCallback(() => {
    setProgram("{ print $1 }");
    setInput("");
    setConfig(DEFAULT_CONFIG);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = (label: string) => {
    const s = SAMPLE_DATA.find((d) => d.label === label);
    if (s) {
      setInput(s.input);
      toast.info(`Loaded sample: ${s.label}`);
    }
  };

  const loadRecipe = (idx: number) => {
    const r = RECIPE_LIBRARY[idx];
    setProgram(r.program);
    setConfig((c) => ({ ...c, fieldSeparator: r.fieldSeparator }));
    const s = SAMPLE_DATA.find((d) => d.label === r.sampleLabel);
    if (s) setInput(s.input);
    toast.info(`Loaded recipe: ${r.label}`);
  };

  const applyPreset = (kind: "print" | "filter" | "agg") => {
    if (kind === "print") {
      setConfig(presetPrintColumns([1, 3], config.fieldSeparator || ","));
    } else if (kind === "filter") {
      setConfig(presetFilter(2, ">", 5, config.fieldSeparator || ","));
    } else {
      setConfig(presetAggregate("sum", 2, config.fieldSeparator || ","));
    }
    setTab("builder");
    toast.info("Preset applied — review and run");
  };

  const addVariable = () => {
    setConfig((c) => ({ ...c, variables: [...c.variables, { name: "", value: "" }] }));
  };
  const updateVariable = (i: number, patch: Partial<AwkVariable>) => {
    setConfig((c) => ({
      ...c,
      variables: c.variables.map((v, j) => (i === j ? { ...v, ...patch } : v)),
    }));
  };
  const removeVariable = (i: number) => {
    setConfig((c) => ({ ...c, variables: c.variables.filter((_, j) => j !== i) }));
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Pure-JS awk</Badge>
            <Badge variant="outline" className="text-[10px]">100% client-side</Badge>
            <Badge variant="outline" className="text-[10px]">No WASM</Badge>
            <div className="ml-auto flex gap-1">
              <Button variant={tab === "raw" ? "default" : "outline"} size="sm" onClick={() => setTab("raw")} className="h-7 text-xs">
                <Terminal className="h-3.5 w-3.5 mr-1" /> Raw program
              </Button>
              <Button variant={tab === "builder" ? "default" : "outline"} size="sm" onClick={() => setTab("builder")} className="h-7 text-xs">
                <Wand2 className="h-3.5 w-3.5 mr-1" /> Builder
              </Button>
              <Button variant={tab === "explain" ? "default" : "outline"} size="sm" onClick={() => setTab("explain")} className="h-7 text-xs">
                <Lightbulb className="h-3.5 w-3.5 mr-1" /> Explainer
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="awk-program" className="text-xs flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> awk program
              </Label>
              <Textarea
                id="awk-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder={"{ print $1, $3 }"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
              <div className="flex items-center gap-2 text-[10px]">
                {parseErr ? (
                  <Badge variant="destructive" className="text-[10px]">parse error</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">syntax OK</Badge>
                )}
                <span className="text-muted-foreground">{program.split("\n").length} lines</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="awk-input" className="text-xs">Sample input</Label>
                <select
                  onChange={(e) => e.target.value && loadSample(e.target.value)}
                  value=""
                  className="h-7 text-xs rounded border bg-background px-2"
                >
                  <option value="">Load sample…</option>
                  {SAMPLE_DATA.map((s) => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </div>
              <Textarea
                id="awk-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={"a,1\nb,2\nc,3"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
              <div className="text-[10px] text-muted-foreground">
                {input === "" ? "0" : input.split("\n").length} lines · {input.length} chars
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Field separator (FS)</Label>
              <div className="flex gap-2">
                <Input
                  value={config.fieldSeparator}
                  onChange={(e) => setConfig((c) => ({ ...c, fieldSeparator: e.target.value }))}
                  placeholder="empty = whitespace"
                  className="font-mono text-xs h-8"
                />
                <select
                  onChange={(e) => e.target.value !== "__none" && setConfig((c) => ({ ...c, fieldSeparator: FS_PRESETS[parseInt(e.target.value, 10)].value }))}
                  value=""
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="__none">Presets…</option>
                  {FS_PRESETS.map((p, i) => (
                    <option key={p.label} value={i}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Output separator (OFS)</Label>
              <Input
                value={config.outputSeparator}
                onChange={(e) => setConfig((c) => ({ ...c, outputSeparator: e.target.value }))}
                placeholder="empty = single space"
                className="font-mono text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">-v variables</Label>
              <Button variant="ghost" size="sm" onClick={addVariable} className="h-6 text-[11px]">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {config.variables.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No -v variables. Add one to pre-assign values before BEGIN runs.</p>
            ) : (
              <div className="space-y-1">
                {config.variables.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={v.name}
                      onChange={(e) => updateVariable(i, { name: e.target.value })}
                      placeholder="name"
                      className="font-mono text-xs h-7 w-32"
                    />
                    <span className="text-xs">=</span>
                    <Input
                      value={v.value}
                      onChange={(e) => updateVariable(i, { value: e.target.value })}
                      placeholder="value"
                      className="font-mono text-xs h-7 flex-1"
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeVariable(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {tab === "builder" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Visual builder
              </h3>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset("print")}>Print cols</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset("filter")}>Filter</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset("agg")}>Aggregate</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pattern (optional)</Label>
                <Input
                  value={config.pattern}
                  onChange={(e) => setConfig((c) => ({ ...c, pattern: e.target.value }))}
                  placeholder="$2 > 100  or  /error/"
                  className="font-mono text-xs h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Action body</Label>
                <Input
                  value={config.action}
                  onChange={(e) => setConfig((c) => ({ ...c, action: e.target.value }))}
                  placeholder="print $1, $3"
                  className="font-mono text-xs h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">BEGIN block (optional)</Label>
                <Input
                  value={config.beginBlock}
                  onChange={(e) => setConfig((c) => ({ ...c, beginBlock: e.target.value }))}
                  placeholder='print "header"'
                  className="font-mono text-xs h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">END block (optional)</Label>
                <Input
                  value={config.endBlock}
                  onChange={(e) => setConfig((c) => ({ ...c, endBlock: e.target.value }))}
                  placeholder="print NR"
                  className="font-mono text-xs h-8"
                />
              </div>
            </div>
            <div className="rounded border bg-muted/40 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Generated program</div>
              <pre className="text-xs font-mono whitespace-pre-wrap">{built.prog || "(empty)"}</pre>
            </div>
            <div className="rounded border bg-muted/40 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Copy-ready command</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{built.cmd}</pre>
            </div>
            {built.expl.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Per-option explanation</div>
                {built.expl.map((e, i) => (
                  <div key={i} className="rounded border bg-background px-2 py-1 text-xs">
                    <code className="font-mono text-primary">{e.option}</code>
                    <span className="text-muted-foreground"> — {e.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return built.cmd; }} label="Copy command" />
              <CopyButton getText={() => built.prog} label="Copy program" />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(program, input, config.fieldSeparator); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "explain" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Program explainer
            </h3>
            <p className="text-xs text-muted-foreground">
              Annotations for the program in the editor above. Each token is explained in plain English so non-experts can read it.
            </p>
            {annotations.length === 0 ? (
              <EmptyState
                title="No program to explain"
                hint="Type or load an awk program in the editor."
                icon={<Lightbulb className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-1">
                {annotations.map((a, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <code className="font-mono text-primary break-all">{a.token}</code>
                    <div className="text-muted-foreground mt-0.5">{a.explanation}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Output
            </h3>
            <Badge variant="outline" className="text-[10px]">{run.lineCount} lines in</Badge>
          </div>
          {run.error ? (
            <ErrorBanner message={`awk: ${run.error}`} />
          ) : run.output === "" ? (
            <EmptyState
              title="No output"
              hint="The program ran but produced no output. Try a `print` statement or load a recipe."
              icon={<AlertTriangle className="h-8 w-8" />}
            />
          ) : (
            <pre className="rounded border bg-muted/40 p-2 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-auto">{run.output}</pre>
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return run.output; }} label="Copy output" disabled={!!run.error} />
            <DownloadButton
              getText={() => run.output}
              filename="awk-output.txt"
              mime="text/plain"
              label="Download output"
              disabled={!!run.error}
            />
            <CopyButton getText={() => built.cmd} label="Copy command" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(program, input, config.fieldSeparator); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Recipe library
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {RECIPE_LIBRARY.map((r, i) => (
              <button
                key={r.label}
                onClick={() => loadRecipe(i)}
                className="text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent transition-colors"
              >
                <div className="font-medium text-foreground">{r.label}</div>
                <div className="text-muted-foreground text-[10px]">{r.description}</div>
                <code className="font-mono text-[10px] text-primary block mt-1 truncate">{r.program}</code>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setProgram(h.program);
                    if (h.inputPreview) setInput(h.inputPreview);
                    toast.info("Loaded from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent transition-colors"
                >
                  <code className="font-mono text-primary block truncate">{h.program}</code>
                  <div className="text-[10px] text-muted-foreground truncate">{h.command}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> The awk interpreter runs in your browser — no WASM, no network. Your input and program never leave the device. History is stored in localStorage only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
