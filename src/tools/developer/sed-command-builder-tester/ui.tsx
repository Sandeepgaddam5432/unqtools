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
  SAMPLE_TEXTS,
  RECIPE_LIBRARY,
  buildSubstitute,
  buildDelete,
  buildPrint,
  buildInsert,
  buildAppend,
  buildChange,
  buildNext,
  buildQuit,
  buildLineNumber,
  formatAddress,
  explainConfig,
  explainProgram,
  buildScript,
  buildSedCommand,
  buildSed,
  runSed,
  validateScript,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SedConfig,
  type SedCommand,
  type SedCommandType,
  type Address,
  type HistoryEntry,
} from "./logic";
import {
  History, Terminal, Play, BookOpen, Wand2, AlertTriangle,
  Plus, Trash2, Lightbulb, FileWarning,
} from "lucide-react";

type Tab = "raw" | "builder" | "explain";

const COMMAND_TYPES: { type: SedCommandType; label: string }[] = [
  { type: "substitute", label: "s — substitute" },
  { type: "delete", label: "d — delete" },
  { type: "print", label: "p — print" },
  { type: "insert", label: "i — insert" },
  { type: "append", label: "a — append" },
  { type: "change", label: "c — change" },
  { type: "next", label: "n — next" },
  { type: "quit", label: "q — quit" },
  { type: "lineNumber", label: "= — line number" },
];

export default function SedCommandBuilderTester() {
  const [script, setScript] = useState("s/foo/bar/g");
  const [input, setInput] = useState(SAMPLE_TEXTS[0].text);
  const [config, setConfig] = useState<SedConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("raw");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.script) setScript(p.script);
      if (p.input) setInput(p.input);
      setConfig((c) => ({
        ...c,
        suppressAutoPrint: p.nFlag,
        extendedRegex: p.eFlag,
      }));
      if (p.script || p.input) toast.info("Loaded from share link");
    }
  }, []);

  // Run interpreter live.
  const run = useMemo(
    () => runSed(script, input, {
      suppressAutoPrint: config.suppressAutoPrint,
      extendedRegex: config.extendedRegex,
    }),
    [script, input, config.suppressAutoPrint, config.extendedRegex],
  );
  const parseErr = useMemo(
    () => validateScript(script, config.extendedRegex),
    [script, config.extendedRegex],
  );

  // Builder output (script from config + command + explanations).
  const built = useMemo(() => buildSed(config), [config]);

  // Reverse explainer annotations.
  const annotations = useMemo(
    () => explainProgram(script, config.extendedRegex),
    [script, config.extendedRegex],
  );

  // When in builder tab and config changes, sync the raw script.
  useEffect(() => {
    if (tab === "builder") {
      setScript(built.script);
    }
  }, [built.script, tab]);

  const handleSaveHistory = useCallback(() => {
    if (script) {
      saveHistory({
        ts: Date.now(),
        script,
        inputPreview: input.slice(0, 60),
        command: built.command,
      });
      setHistory(loadHistory());
    }
  }, [script, input, built.command]);

  const handleClear = useCallback(() => {
    setScript("s/foo/bar/g");
    setInput("");
    setConfig(DEFAULT_CONFIG);
    toast.info("Cleared");
  }, []);

  const loadSample = (label: string) => {
    const s = SAMPLE_TEXTS.find((t) => t.label === label);
    if (s) {
      setInput(s.text);
      toast.info(`Loaded sample: ${s.label}`);
    }
  };

  const loadRecipe = (idx: number) => {
    const r = RECIPE_LIBRARY[idx];
    setScript(r.script);
    setConfig((c) => ({
      ...c,
      suppressAutoPrint: r.flags.n,
      extendedRegex: r.flags.E,
      inPlace: r.flags.i,
    }));
    const s = SAMPLE_TEXTS.find((t) => t.label === r.sampleLabel);
    if (s) setInput(s.text);
    toast.info(`Loaded recipe: ${r.label}`);
  };

  // ---- Builder command editors ----
  const addCommand = (type: SedCommandType) => {
    let cmd: SedCommand;
    const emptyAddr: Address = { type: "none" };
    switch (type) {
      case "substitute": cmd = buildSubstitute("foo", "bar", "g"); break;
      case "delete": cmd = buildDelete(emptyAddr); break;
      case "print": cmd = buildPrint(emptyAddr); break;
      case "insert": cmd = buildInsert(emptyAddr, "text"); break;
      case "append": cmd = buildAppend(emptyAddr, "text"); break;
      case "change": cmd = buildChange(emptyAddr, "text"); break;
      case "next": cmd = buildNext(emptyAddr); break;
      case "quit": cmd = buildQuit(emptyAddr); break;
      case "lineNumber": cmd = buildLineNumber(emptyAddr); break;
    }
    setConfig((c) => ({ ...c, commands: [...c.commands, cmd] }));
    setTab("builder");
  };

  const updateCommand = (i: number, patch: Partial<SedCommand>) => {
    setConfig((c) => ({
      ...c,
      commands: c.commands.map((cmd, j) => (i === j ? { ...cmd, ...patch } : cmd)),
    }));
  };

  const removeCommand = (i: number) => {
    setConfig((c) => ({ ...c, commands: c.commands.filter((_, j) => j !== i) }));
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Pure-JS sed</Badge>
            <Badge variant="outline" className="text-[10px]">100% client-side</Badge>
            <Badge variant="outline" className="text-[10px]">No WASM</Badge>
            <Badge variant="outline" className="text-[10px]">Preview only — never edits files</Badge>
            <div className="ml-auto flex gap-1">
              <Button variant={tab === "raw" ? "default" : "outline"} size="sm" onClick={() => setTab("raw")} className="h-7 text-xs">
                <Terminal className="h-3.5 w-3.5 mr-1" /> Raw script
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
              <Label htmlFor="sed-script" className="text-xs flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> sed script
              </Label>
              <Textarea
                id="sed-script"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={"s/foo/bar/g"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
              <div className="flex items-center gap-2 text-[10px]">
                {parseErr ? (
                  <Badge variant="destructive" className="text-[10px]">parse error</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">syntax OK</Badge>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sed-input" className="text-xs">Sample text</Label>
                <select
                  onChange={(e) => e.target.value && loadSample(e.target.value)}
                  value=""
                  className="h-7 text-xs rounded border bg-background px-2"
                >
                  <option value="">Load sample…</option>
                  {SAMPLE_TEXTS.map((s) => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </div>
              <Textarea
                id="sed-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={"one\n_two\n_three"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
              <div className="text-[10px] text-muted-foreground">
                {input === "" ? "0" : input.split("\n").length} lines · {input.length} chars
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.suppressAutoPrint}
                onChange={(e) => setConfig((c) => ({ ...c, suppressAutoPrint: e.target.checked }))}
              />
              <code>-n</code> suppress auto-print
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.extendedRegex}
                onChange={(e) => setConfig((c) => ({ ...c, extendedRegex: e.target.checked }))}
              />
              <code>-E</code> extended regex (ERE)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.inPlace}
                onChange={(e) => setConfig((c) => ({ ...c, inPlace: e.target.checked }))}
              />
              <code>-i</code> in-place (preview only)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-muted-foreground">Mode:</span>
              <select
                value={config.gnuMode ? "gnu" : "bsd"}
                onChange={(e) => setConfig((c) => ({ ...c, gnuMode: e.target.value === "gnu" }))}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                <option value="gnu">GNU (Linux)</option>
                <option value="bsd">BSD/macOS</option>
              </select>
            </label>
          </div>

          {config.inPlace && (
            <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs flex gap-2">
              <FileWarning className="h-4 w-4 flex-shrink-0 text-amber-600" />
              <div>
                <strong>In-place preview only.</strong> This tool never edits real files. The generated command shows the correct
                <code className="mx-1">-i</code> syntax for {config.gnuMode ? "GNU sed (Linux): `sed -i 's/.../' file`" : "BSD/macOS sed: `sed -i '' 's/.../' file`"}.
                {config.inPlaceSuffix && <span> Backup suffix: <code>{config.inPlaceSuffix}</code></span>}
                <input
                  type="text"
                  value={config.inPlaceSuffix}
                  onChange={(e) => setConfig((c) => ({ ...c, inPlaceSuffix: e.target.value }))}
                  placeholder=".bak (optional backup suffix)"
                  className="ml-2 inline-block w-32 h-6 text-[10px] font-mono rounded border bg-background px-1"
                />
              </div>
            </div>
          )}
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
                <select
                  onChange={(e) => {
                    const t = e.target.value as SedCommandType;
                    if (t) addCommand(t);
                  }}
                  value=""
                  className="h-7 text-xs rounded border bg-background px-2"
                >
                  <option value="">Add command…</option>
                  {COMMAND_TYPES.map((c) => (
                    <option key={c.type} value={c.type}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {config.commands.length === 0 ? (
              <EmptyState
                title="No commands yet"
                hint="Add a command from the dropdown, or load a recipe to get started."
                icon={<Wand2 className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-2">
                {config.commands.map((cmd, i) => (
                  <CommandEditor
                    key={i}
                    command={cmd}
                    onChange={(patch) => updateCommand(i, patch)}
                    onRemove={() => removeCommand(i)}
                  />
                ))}
              </div>
            )}

            <div className="rounded border bg-muted/40 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Generated script</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{built.script || "(empty)"}</pre>
            </div>
            <div className="rounded border bg-muted/40 p-2 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Copy-ready command</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{built.command}</pre>
            </div>
            {built.explanations.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Per-command explanation</div>
                {built.explanations.map((e, i) => (
                  <div key={i} className="rounded border bg-background px-2 py-1 text-xs">
                    <code className="font-mono text-primary break-all">{e.command}</code>
                    <div className="text-muted-foreground mt-0.5">{e.explanation}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return built.command; }} label="Copy command" />
              <CopyButton getText={() => built.script} label="Copy script" />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(script, input, config.suppressAutoPrint, config.extendedRegex); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "explain" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Script explainer
            </h3>
            <p className="text-xs text-muted-foreground">
              Annotations for the script in the editor above. Each token is explained in plain English so non-experts can read it.
            </p>
            {annotations.length === 0 ? (
              <EmptyState
                title="No script to explain"
                hint="Type or load a sed script in the editor."
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
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px]">{run.lineCount} in</Badge>
              <Badge variant="outline" className="text-[10px]">{run.outputLineCount} out</Badge>
            </div>
          </div>
          {run.error ? (
            <ErrorBanner message={`sed: ${run.error}`} />
          ) : run.output === "" ? (
            <EmptyState
              title="No output"
              hint="The script ran but produced no output. Try removing -n or adding a print command."
              icon={<AlertTriangle className="h-8 w-8" />}
            />
          ) : (
            <pre className="rounded border bg-muted/40 p-2 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-auto">{run.output}</pre>
          )}
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return run.output; }} label="Copy output" disabled={!!run.error} />
            <DownloadButton
              getText={() => run.output}
              filename="sed-output.txt"
              mime="text/plain"
              label="Download output"
              disabled={!!run.error}
            />
            <CopyButton getText={() => built.command} label="Copy command" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(script, input, config.suppressAutoPrint, config.extendedRegex); }} />
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
                <code className="font-mono text-[10px] text-primary block mt-1 truncate">{r.script}</code>
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
              <Button variant="ghost" size="sm" onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setScript(h.script);
                    if (h.inputPreview) setInput(h.inputPreview);
                    toast.info("Loaded from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent transition-colors"
                >
                  <code className="font-mono text-primary block truncate">{h.script}</code>
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
            <strong className="text-foreground">Privacy:</strong> The sed interpreter runs in your browser — no WASM, no network. Your text and script never leave the device. The <code>-i</code> flag is preview-only: this tool NEVER edits real files. History is stored in localStorage only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CommandEditor({
  command,
  onChange,
  onRemove,
}: {
  command: SedCommand;
  onChange: (patch: Partial<SedCommand>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border bg-background p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="text-[10px]">{command.source}</Badge>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <AddressEditor
        address={command.address}
        onChange={(addr) => onChange({ address: addr })}
      />
      {command.type === "substitute" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px]">Search</Label>
            <Input
              value={command.search ?? ""}
              onChange={(e) => onChange({ search: e.target.value })}
              className="font-mono text-xs h-7"
            />
          </div>
          <div>
            <Label className="text-[10px]">Replace</Label>
            <Input
              value={command.replace ?? ""}
              onChange={(e) => onChange({ replace: e.target.value })}
              className="font-mono text-xs h-7"
            />
          </div>
          <div>
            <Label className="text-[10px]">Flags</Label>
            <Input
              value={command.flags ?? ""}
              onChange={(e) => onChange({ flags: e.target.value })}
              placeholder="g, i, p, or N"
              className="font-mono text-xs h-7"
            />
          </div>
        </div>
      )}
      {(command.type === "insert" || command.type === "append" || command.type === "change") && (
        <div>
          <Label className="text-[10px]">Text</Label>
          <Input
            value={command.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            className="font-mono text-xs h-7"
          />
        </div>
      )}
    </div>
  );
}

function AddressEditor({
  address,
  onChange,
}: {
  address: Address;
  onChange: (addr: Address) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
      <div>
        <Label className="text-[10px]">Address type</Label>
        <select
          value={address.type}
          onChange={(e) => {
            const t = e.target.value as Address["type"];
            if (t === "none") onChange({ type: "none" });
            else if (t === "line") onChange({ type: "line", line: 1 });
            else if (t === "last") onChange({ type: "last" });
            else if (t === "regex") onChange({ type: "regex", regex: "", caseInsensitive: false });
            else onChange({ type: "range", start: { type: "line", line: 1 }, end: { type: "line", line: 5 } });
          }}
          className="h-7 w-full text-xs rounded border bg-background px-2"
        >
          <option value="none">every line</option>
          <option value="line">line N</option>
          <option value="last">last line ($)</option>
          <option value="regex">/regex/</option>
          <option value="range">range</option>
        </select>
      </div>
      {address.type === "line" && (
        <div>
          <Label className="text-[10px]">Line number</Label>
          <Input
            type="number"
            min={1}
            value={address.line ?? 1}
            onChange={(e) => onChange({ ...address, line: parseInt(e.target.value, 10) || 1 })}
            className="font-mono text-xs h-7"
          />
        </div>
      )}
      {address.type === "regex" && (
        <>
          <div>
            <Label className="text-[10px]">Regex</Label>
            <Input
              value={address.regex ?? ""}
              onChange={(e) => onChange({ ...address, regex: e.target.value })}
              className="font-mono text-xs h-7"
            />
          </div>
          <div>
            <Label className="text-[10px]">Case-insensitive</Label>
            <input
              type="checkbox"
              checked={!!address.caseInsensitive}
              onChange={(e) => onChange({ ...address, caseInsensitive: e.target.checked })}
              className="ml-2"
            />
          </div>
        </>
      )}
      {address.type === "range" && (
        <div className="col-span-2 text-[10px] text-muted-foreground">
          Range: <code>{formatAddress(address)}</code> — edit start/end via the line inputs above. (For more complex ranges, use the raw script editor.)
        </div>
      )}
    </div>
  );
}
