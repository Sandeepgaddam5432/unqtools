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
} from "../../_shared";
import { toast } from "sonner";
import {
  CATEGORY_LABELS,
  MODE_LABELS,
  CATEGORY_ORDER,
  VIM_COMMANDS,
  OPERATORS,
  MOTIONS,
  TEXT_OBJECTS,
  KEYBOARD_MAP,
  COLORSCHEME_OPTIONS,
  MOUSE_OPTIONS,
  normalizeQuery,
  searchCommands,
  intentLookup,
  composeCommand,
  composeAll,
  makeDefaultVimrc,
  buildVimrc,
  renderCheatsheetMarkdown,
  computeStats,
  lookupKey,
  validateVimrc,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VimCategory,
  type VimMode,
  type Operator,
  type VimrcConfig,
  type HistoryEntry,
} from "./logic";
import {
  History, Keyboard, Search, AlertTriangle, Info,
  Wand2, FileCode, Sparkles, GitBranch, Zap,
} from "lucide-react";

type Tab = "cheatsheet" | "grammar" | "intent" | "keyboard" | "vimrc";

export default function VimCheatsheetKeybindingReference() {
  const [tab, setTab] = useState<Tab>("cheatsheet");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<VimCategory | "">("");
  const [filterModes, setFilterModes] = useState<VimMode[]>([]);
  const [intentText, setIntentText] = useState("");

  // Grammar tab
  const [grammarOp, setGrammarOp] = useState<Operator>("d");
  const [grammarOperand, setGrammarOperand] = useState("w");
  const [grammarCount, setGrammarCount] = useState<number>(0);

  // Keyboard tab
  const [activeKey, setActiveKey] = useState<string>("");

  // .vimrc tab
  const [vimrc, setVimrc] = useState<VimrcConfig>(makeDefaultVimrc());

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.search) setSearch(p.search);
      if (p.category) setFilterCat(p.category);
      if (p.intent) { setIntentText(p.intent); setTab("intent"); }
      if (p.search || p.category || p.intent) toast.info("Loaded from share link");
    }
  }, []);

  const filtered = useMemo(
    () => searchCommands({ query: search, category: filterCat || "", modes: filterModes }),
    [search, filterCat, filterModes],
  );
  const stats = useMemo(() => computeStats(), []);
  const intentMatches = useMemo(() => intentLookup(intentText), [intentText]);
  const composed = useMemo(
    () => composeCommand(grammarOp, grammarOperand, grammarCount > 0 ? grammarCount : undefined),
    [grammarOp, grammarOperand, grammarCount],
  );
  const vimrcResult = useMemo(() => buildVimrc(vimrc), [vimrc]);
  const vimrcValidation = useMemo(() => validateVimrc(vimrc), [vimrc]);
  const csMarkdown = useMemo(
    () => renderCheatsheetMarkdown(VIM_COMMANDS as unknown as Parameters<typeof renderCheatsheetMarkdown>[0]),
    [],
  );

  const logHistory = useCallback((action: HistoryEntry["action"], detail: string) => {
    saveHistory({ ts: Date.now(), action, detail });
    setHistory(loadHistory());
  }, []);

  const toggleMode = (m: VimMode) => {
    setFilterModes((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const updateVimrc = useCallback(<K extends keyof VimrcConfig>(key: K, value: VimrcConfig[K]) => {
    setVimrc((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClear = useCallback(() => {
    setSearch("");
    setFilterCat("");
    setFilterModes([]);
    setIntentText("");
    setGrammarCount(0);
    setVimrc(makeDefaultVimrc());
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const operandOptions = [...MOTIONS, ...TEXT_OBJECTS];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Tab bar */}
      <Card>
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-1">
            <TabBtn active={tab === "cheatsheet"} onClick={() => setTab("cheatsheet")} icon={<Keyboard className="h-4 w-4" />} label="Cheatsheet" />
            <TabBtn active={tab === "grammar"} onClick={() => setTab("grammar")} icon={<Wand2 className="h-4 w-4" />} label="Grammar" />
            <TabBtn active={tab === "intent"} onClick={() => setTab("intent")} icon={<Sparkles className="h-4 w-4" />} label="Intent Lookup" />
            <TabBtn active={tab === "keyboard"} onClick={() => setTab("keyboard")} icon={<Zap className="h-4 w-4" />} label="Keyboard Map" />
            <TabBtn active={tab === "vimrc"} onClick={() => setTab("vimrc")} icon={<FileCode className="h-4 w-4" />} label=".vimrc Generator" />
            <div className="ml-auto flex gap-2">
              <ShareButton getUrl={() => {
                logHistory("search", search || intentText || "share");
                return buildShareUrl({ search, category: filterCat, intent: intentText });
              }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats strip */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Total commands" value={stats.total} />
            <Stat label="Categories" value={Object.keys(CATEGORY_LABELS).length} />
            <Stat label="Operators" value={OPERATORS.length} />
            <Stat label="Text objects" value={TEXT_OBJECTS.length} />
          </div>
        </CardContent>
      </Card>

      {/* Cheatsheet tab */}
      {tab === "cheatsheet" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4" /> {filtered.length} of {VIM_COMMANDS.length} commands
              </h3>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search keys / descriptions…"
                    className="h-8 pl-7 text-xs w-56"
                  />
                </div>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value as VimCategory | "")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All categories</option>
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <CopyButton getText={() => { logHistory("search", "copy-md"); return csMarkdown; }} label="Copy as .md" />
                <DownloadButton getText={() => csMarkdown} filename="vim-cheatsheet.md" mime="text/markdown" label="Download .md" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MODE_LABELS) as VimMode[]).map((m) => (
                <label key={m} className="flex items-center gap-1 text-[11px] cursor-pointer">
                  <input type="checkbox" checked={filterModes.includes(m)} onChange={() => toggleMode(m)} />
                  {MODE_LABELS[m]}
                </label>
              ))}
            </div>
            {filtered.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-auto">
                {CATEGORY_ORDER.map((cat) => {
                  const items = filtered.filter((c) => c.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        {CATEGORY_LABELS[cat]} ({items.length})
                      </div>
                      <div className="space-y-1">
                        {items.map((c, i) => (
                          <div key={`${cat}-${i}`} className="flex items-start gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                            <code className="font-mono text-primary min-w-[90px]">{c.keys}</code>
                            <div className="flex-1 min-w-0">
                              <div className="text-foreground">{c.description}</div>
                              {c.example && <div className="text-[10px] text-muted-foreground font-mono mt-0.5">e.g. {c.example}</div>}
                              {c.count && <div className="text-[10px] text-muted-foreground mt-0.5">{c.count}</div>}
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              {c.modes.map((m) => (
                                <Badge key={m} variant="outline" className="text-[9px]">{MODE_LABELS[m]}</Badge>
                              ))}
                              {c.neovim && <Badge variant="secondary" className="text-[9px]">nvim</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No commands match your search"
                hint="Try clearing the search or filter."
                icon={<Search className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Grammar tab */}
      {tab === "grammar" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Verb + Noun Grammar Explainer
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Vim is composable: pick an <strong>operator</strong> (verb) and a <strong>motion or text-object</strong> (noun). {OPERATORS.length * (MOTIONS.length + TEXT_OBJECTS.length)} possible combinations.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Operator (verb)</Label>
                <select
                  value={grammarOp}
                  onChange={(e) => setGrammarOp(e.target.value as Operator)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} — {o.description}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motion / Text-object (noun)</Label>
                <select
                  value={grammarOperand}
                  onChange={(e) => setGrammarOperand(e.target.value)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <optgroup label="Motions">
                    {MOTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label} — {m.description}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Text objects (i/a)">
                    {TEXT_OBJECTS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} — {t.description}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Count (0 = none)</Label>
                <Input
                  type="number"
                  value={grammarCount}
                  onChange={(e) => setGrammarCount(Math.max(0, parseInt(e.target.value || "0", 10)))}
                  className="h-8 text-xs"
                  min={0}
                  max={99}
                />
              </div>
            </div>
            <div className="rounded border bg-muted/30 p-4 space-y-2">
              <div className="text-xs text-muted-foreground">Composed command</div>
              <code className="font-mono text-2xl text-primary">{composed.command}</code>
              <div className="text-sm text-foreground">{composed.description}</div>
              <div className="text-[11px] text-muted-foreground">{composed.countExample}</div>
            </div>
            <CopyButton getText={() => { logHistory("compose", composed.command); return composed.command; }} label="Copy command" />
            <div>
              <Label className="text-xs">Browse all {composeAll().length} combinations</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-1 mt-2 max-h-[200px] overflow-auto">
                {composeAll().slice(0, 80).map((c, i) => (
                  <code key={i} className="font-mono text-[10px] rounded border bg-background px-2 py-1">{c.command}</code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Intent lookup tab */}
      {tab === "intent" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Reverse Intent Lookup
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Describe what you want to do — e.g. "delete inside quotes", "save and quit", "yank to end of line".
              </p>
            </div>
            <Input
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              placeholder="Describe what you want to do…"
              className="text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {["delete inside quotes", "save and quit", "yank to end of line", "change word", "force quit"].map((ex) => (
                <Button
                  key={ex}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setIntentText(ex)}
                >{ex}</Button>
              ))}
            </div>
            {intentText && (
              intentMatches.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{intentMatches.length} match(es)</div>
                  {intentMatches.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 rounded border bg-background px-3 py-2 text-xs">
                      <code className="font-mono text-primary min-w-[100px]">{m.command.keys}</code>
                      <div className="flex-1">
                        <div className="text-foreground">{m.command.description}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Score {m.score} · matched on {m.matchedOn} · {m.command.modes.map((x) => MODE_LABELS[x]).join(", ")}
                        </div>
                      </div>
                      <CopyButton getText={() => m.command.keys} label="" size="icon-sm" />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No matches"
                  hint="Try a different phrasing. Common patterns: 'delete inside <X>', 'change a word', 'yank to <position>'."
                  icon={<Search className="h-8 w-8" />}
                />
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Keyboard map tab */}
      {tab === "keyboard" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Interactive Keyboard Map
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Click any key to see its meaning per mode.
              </p>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1.5">
              {KEYBOARD_MAP.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setActiveKey(e.key)}
                  className={`rounded border px-2 py-2 text-center font-mono text-xs transition-colors ${
                    activeKey === e.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent/30"
                  }`}
                >{e.key}</button>
              ))}
            </div>
            {activeKey && (
              <div className="rounded border bg-muted/30 p-3 space-y-2">
                <div className="text-xs text-muted-foreground">Key: <code className="font-mono text-primary text-sm">{activeKey}</code></div>
                {lookupKey(activeKey) ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["normal", "insert", "visual", "command"] as const).map((m) => {
                      const entry = lookupKey(activeKey);
                      const val = entry?.[m];
                      return (
                        <div key={m} className="rounded border bg-background px-2 py-1.5 text-xs">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{MODE_LABELS[m]}</div>
                          <div className="text-foreground">{val ?? "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No documented meaning.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* .vimrc tab */}
      {tab === "vimrc" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileCode className="h-4 w-4" /> .vimrc Options
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <Toggle label="Line numbers" checked={vimrc.lineNumber} onChange={(v) => updateVimrc("lineNumber", v)} />
                <Toggle label="Relative numbers" checked={vimrc.relativeNumber} onChange={(v) => updateVimrc("relativeNumber", v)} />
                <Toggle label="Syntax highlighting" checked={vimrc.syntax} onChange={(v) => updateVimrc("syntax", v)} />
                <Toggle label="Cursor line" checked={vimrc.cursorLine} onChange={(v) => updateVimrc("cursorLine", v)} />
                <Toggle label="expandtab (spaces)" checked={vimrc.expandtab} onChange={(v) => updateVimrc("expandtab", v)} />
                <Toggle label="smartindent" checked={vimrc.smartindent} onChange={(v) => updateVimrc("smartindent", v)} />
                <Toggle label="autoindent" checked={vimrc.autoindent} onChange={(v) => updateVimrc("autoindent", v)} />
                <Toggle label="wrap" checked={vimrc.wrap} onChange={(v) => updateVimrc("wrap", v)} />
                <Toggle label="swapfile" checked={vimrc.swapfile} onChange={(v) => updateVimrc("swapfile", v)} />
                <Toggle label="backup" checked={vimrc.backup} onChange={(v) => updateVimrc("backup", v)} />
                <Toggle label="undofile (persist undo)" checked={vimrc.undofile} onChange={(v) => updateVimrc("undofile", v)} />
                <Toggle label="hlsearch" checked={vimrc.hlsearch} onChange={(v) => updateVimrc("hlsearch", v)} />
                <Toggle label="incsearch" checked={vimrc.incsearch} onChange={(v) => updateVimrc("incsearch", v)} />
                <Toggle label="ignorecase" checked={vimrc.ignorecase} onChange={(v) => updateVimrc("ignorecase", v)} />
                <Toggle label="smartcase" checked={vimrc.smartcase} onChange={(v) => updateVimrc("smartcase", v)} />
                <Toggle label="wildmenu" checked={vimrc.wildmenu} onChange={(v) => updateVimrc("wildmenu", v)} />
                <Toggle label="showmatch" checked={vimrc.showMatch} onChange={(v) => updateVimrc("showMatch", v)} />
                <Toggle label="splitright" checked={vimrc.splitRight} onChange={(v) => updateVimrc("splitRight", v)} />
                <Toggle label="splitbelow" checked={vimrc.splitBelow} onChange={(v) => updateVimrc("splitBelow", v)} />
                <Toggle label="jk→Esc remap" checked={vimrc.remapEscape} onChange={(v) => updateVimrc("remapEscape", v)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">shiftwidth</Label>
                  <Input type="number" value={vimrc.shiftwidth} onChange={(e) => updateVimrc("shiftwidth", parseInt(e.target.value || "0", 10))} className="h-8 text-xs" min={1} max={16} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">tabstop</Label>
                  <Input type="number" value={vimrc.tabstop} onChange={(e) => updateVimrc("tabstop", parseInt(e.target.value || "0", 10))} className="h-8 text-xs" min={1} max={16} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">softtabstop</Label>
                  <Input type="number" value={vimrc.softtabstop} onChange={(e) => updateVimrc("softtabstop", parseInt(e.target.value || "0", 10))} className="h-8 text-xs" min={0} max={16} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Leader key</Label>
                  <Input value={vimrc.leader} onChange={(e) => updateVimrc("leader", e.target.value)} className="h-8 text-xs font-mono" maxLength={1} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Colorscheme</Label>
                  <select
                    value={vimrc.colorscheme}
                    onChange={(e) => updateVimrc("colorscheme", e.target.value)}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    {COLORSCHEME_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mouse</Label>
                  <select
                    value={vimrc.mouse}
                    onChange={(e) => updateVimrc("mouse", e.target.value as VimrcConfig["mouse"])}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    {MOUSE_OPTIONS.map((m) => (
                      <option key={String(m.value)} value={String(m.value)}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {vimrcValidation.errors.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Validation errors
                </h3>
                {vimrcValidation.errors.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {vimrcResult.warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4" /> Heads-up
                </h3>
                {vimrcResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-2 text-xs">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4" /> .vimrc ({vimrcResult.lines.length} lines)
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { logHistory("vimrc", "copy"); return vimrcResult.text; }} label="Copy .vimrc" />
                  <DownloadButton getText={() => { logHistory("vimrc", "download"); return vimrcResult.text; }} filename=".vimrc" mime="text/plain" label="Download" />
                </div>
              </div>
              <Textarea
                readOnly
                value={vimrcResult.text}
                className="min-h-[400px] resize-y font-mono text-[11px] leading-tight"
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* History */}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.action}</Badge>
                  <span className="text-muted-foreground">{h.detail}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% static and offline. History is stored in localStorage on this device only. Share URLs encode your search in the fragment (after #), which browsers never send to servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
    >
      {icon}
      {label}
    </Button>
  );
}

function Toggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
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
