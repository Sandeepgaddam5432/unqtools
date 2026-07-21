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
  PLATFORM_LABELS,
  FILE_TYPE_LABELS,
  TIME_KIND_LABELS,
  ACTION_LABELS,
  PRINTF_TOKENS,
  REGEX_TYPES,
  COMMON_RECIPES,
  buildFindCommand,
  explainIntent,
  explainOptions,
  validateConfig,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BuilderConfig,
  type Predicate,
  type Platform,
  type ActionKind,
  type FileType,
  type TimeKind,
  type HistoryEntry,
} from "./logic";
import {
  FolderSearch, History, BookOpen, AlertTriangle, Wand2,
  Plus, X, Lightbulb, ChevronUp, ChevronDown, Trash2,
} from "lucide-react";

type Tab = "builder" | "explain" | "recipes";

const PREDICATE_KINDS: { kind: Predicate["kind"]; label: string }[] = [
  { kind: "name", label: "-name (glob)" },
  { kind: "iname", label: "-iname (glob, case-insensitive)" },
  { kind: "path", label: "-path (full path glob)" },
  { kind: "ipath", label: "-ipath (full path, case-insensitive)" },
  { kind: "type", label: "-type (f/d/l/...)" },
  { kind: "size", label: "-size (+/-N with unit)" },
  { kind: "time", label: "-mtime/-mmin/..." },
  { kind: "newer", label: "-newer file" },
  { kind: "perm", label: "-perm (octal/symbolic)" },
  { kind: "user", label: "-user name" },
  { kind: "group", label: "-group name" },
  { kind: "empty", label: "-empty" },
  { kind: "regex", label: "-regex (full path)" },
];

const FILE_TYPES: FileType[] = ["f", "d", "l", "b", "c", "p", "s"];
const TIME_KINDS: TimeKind[] = ["mtime", "mmin", "ctime", "cmin", "atime", "amin"];
const ACTIONS: ActionKind[] = ["print", "print0", "ls", "printf", "exec", "execPlus", "xargs", "delete"];

function newId(): string {
  return `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function FindCommandBuilder() {
  const [config, setConfig] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("builder");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p.config).length > 0) {
        setConfig((c) => ({ ...c, ...p.config }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const built = useMemo(() => buildFindCommand(config), [config]);
  const intent = useMemo(() => explainIntent(config), [config]);
  const options = useMemo(() => explainOptions(config), [config]);
  const validation = useMemo(() => validateConfig(config), [config]);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      command: built.command,
      platform: config.platform,
      destructive: built.destructive,
    });
    setHistory(loadHistory());
  }, [built.command, built.destructive, config.platform]);

  const update = <K extends keyof BuilderConfig>(key: K, value: BuilderConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const addPredicate = (kind: Predicate["kind"]) => {
    const newPred: Predicate = {
      id: newId(),
      kind,
      value: "",
      op: "and",
      ...(kind === "time" ? { extra: "mtime" as const } : {}),
    };
    setConfig((c) => ({ ...c, predicates: [...c.predicates, newPred] }));
  };

  const updatePredicate = (id: string, patch: Partial<Predicate>) => {
    setConfig((c) => ({
      ...c,
      predicates: c.predicates.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const removePredicate = (id: string) => {
    setConfig((c) => ({ ...c, predicates: c.predicates.filter((p) => p.id !== id) }));
  };

  const movePredicate = (id: string, dir: -1 | 1) => {
    setConfig((c) => {
      const idx = c.predicates.findIndex((p) => p.id === id);
      if (idx === -1) return c;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= c.predicates.length) return c;
      const preds = [...c.predicates];
      const [removed] = preds.splice(idx, 1);
      preds.splice(newIdx, 0, removed);
      // Fix the op of the new first element
      if (preds.length > 0) preds[0] = { ...preds[0], op: "and" };
      return { ...c, predicates: preds };
    });
  };

  const handleClear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadRecipe = (id: string) => {
    const recipe = COMMON_RECIPES.find((r) => r.id === id);
    if (!recipe) return;
    setConfig((c) => ({ ...DEFAULT_CONFIG, ...recipe.config }));
    setTab("builder");
    toast.success(`Loaded recipe: ${recipe.label}`);
  };

  const pathsText = config.paths.join("\n");

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["builder", "explain", "recipes"] as Tab[]).map((t) => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t)}
                className="text-xs"
              >
                {t === "builder" && <Wand2 className="h-3 w-3 mr-1" />}
                {t === "explain" && <Lightbulb className="h-3 w-3 mr-1" />}
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
              <Label className="text-xs">Platform</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                  <Button
                    key={p}
                    variant={config.platform === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("platform", p)}
                    className="text-xs"
                  >
                    {PLATFORM_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="fcb-paths">Paths (one per line)</Label>
              <Textarea
                id="fcb-paths"
                value={pathsText}
                onChange={(e) => update("paths", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                placeholder="."
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">maxdepth</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.maxdepth}
                  onChange={(e) => update("maxdepth", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">mindepth</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.mindepth}
                  onChange={(e) => update("mindepth", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">regex type (GNU)</Label>
                <select
                  value={config.regexType}
                  onChange={(e) => update("regexType", e.target.value)}
                  className="w-full h-9 rounded border bg-background px-2 text-xs font-mono"
                >
                  {REGEX_TYPES.map((rt) => (
                    <option key={rt} value={rt}>{rt || "(default)"}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Options</Label>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useRegexE}
                      onChange={(e) => update("useRegexE", e.target.checked)}
                    />
                    -E (BSD)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.followSymlinks}
                      onChange={(e) => update("followSymlinks", e.target.checked)}
                    />
                    -L follow symlinks
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.mountOnly}
                      onChange={(e) => update("mountOnly", e.target.checked)}
                    />
                    -mount/-xdev
                  </label>
                </div>
              </div>
            </div>

            {/* Predicates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Predicates ({config.predicates.length})</Label>
                <div className="flex gap-1">
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) { addPredicate(e.target.value as Predicate["kind"]); e.target.value = ""; } }}
                    className="h-7 text-[11px] rounded border bg-background px-1"
                  >
                    <option value="">+ Add predicate…</option>
                    {PREDICATE_KINDS.map((p) => (
                      <option key={p.kind} value={p.kind}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {config.predicates.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No predicates — the action will apply to EVERY file under the path.</p>
              ) : (
                <div className="space-y-1.5">
                  {config.predicates.map((p, idx) => (
                    <PredicateEditor
                      key={p.id}
                      predicate={p}
                      isFirst={idx === 0}
                      onChange={(patch) => updatePredicate(p.id, patch)}
                      onRemove={() => removePredicate(p.id)}
                      onMoveUp={idx > 0 ? () => movePredicate(p.id, -1) : undefined}
                      onMoveDown={idx < config.predicates.length - 1 ? () => movePredicate(p.id, 1) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Action */}
            <div className="space-y-2">
              <Label className="text-xs">Action</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => (
                  <Button
                    key={a}
                    variant={config.action === a ? "default" : "outline"}
                    size="sm"
                    onClick={() => update("action", a)}
                    className={`text-xs ${a === "delete" ? "border-red-400 text-red-700 dark:text-red-300" : ""}`}
                  >
                    {a === "delete" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {ACTION_LABELS[a]}
                  </Button>
                ))}
              </div>
              {(config.action === "exec" || config.action === "execPlus" || config.action === "xargs") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Command</Label>
                    <Input
                      value={config.execCommand}
                      onChange={(e) => update("execCommand", e.target.value)}
                      placeholder="grep -nH TODO"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Args (use {} for path)</Label>
                    <Input
                      value={config.execArgs}
                      onChange={(e) => update("execArgs", e.target.value)}
                      placeholder="{}"
                      className="font-mono text-xs"
                      disabled={config.action === "xargs"}
                    />
                  </div>
                </div>
              )}
              {config.action === "printf" && (
                <div className="space-y-1 mt-2">
                  <Label className="text-xs">printf format</Label>
                  <Input
                    value={config.printfFormat}
                    onChange={(e) => update("printfFormat", e.target.value)}
                    placeholder="%p\\n"
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {PRINTF_TOKENS.map((t) => (
                      <button
                        key={t.token}
                        onClick={() => update("printfFormat", config.printfFormat + t.token)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-background hover:bg-accent/50"
                        title={t.meaning}
                      >
                        {t.token}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {config.action === "print" && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={config.noDefaultPrint}
                    onChange={(e) => update("noDefaultPrint", e.target.checked)}
                  />
                  Omit explicit -print (find adds it implicitly when no other action is set)
                </label>
              )}
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

      {tab === "explain" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Plain-English explanation
            </h3>
            <p className="text-xs text-foreground">{intent}</p>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Per-option notes</h4>
              {options.length === 0 ? (
                <p className="text-xs text-muted-foreground">No options active.</p>
              ) : (
                <div className="space-y-1">
                  {options.map((o, i) => (
                    <div key={i} className="flex gap-2 items-start rounded border bg-background px-2 py-1.5 text-xs">
                      <Badge variant="outline" className="font-mono text-[10px] flex-shrink-0">{o.option}</Badge>
                      <span className="text-foreground">{o.explanation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "recipes" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Recipe library ({COMMON_RECIPES.length})
            </h3>
            {COMMON_RECIPES.map((r) => {
              const cmd = buildFindCommand({ ...DEFAULT_CONFIG, ...r.config });
              return (
                <div key={r.id} className="rounded border bg-background p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{r.label}</span>
                    <Button size="sm" variant="outline" onClick={() => loadRecipe(r.id)} className="h-6 text-[11px]">
                      Load
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                  <pre className="text-[10px] font-mono bg-muted/50 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                    <code>{cmd.command}</code>
                  </pre>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Always-visible command preview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FolderSearch className="h-4 w-4" /> Generated command
            </h3>
            {built.destructive && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Destructive
              </Badge>
            )}
          </div>
          <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            <code>{built.command}</code>
          </pre>
          {built.notes.length > 0 && (
            <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-0.5">
              {built.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {built.warnings.length > 0 && (
            <div className="rounded border border-amber-400/30 bg-amber-400/10 p-2 text-[10px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              {built.warnings.join(" ")}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton getText={() => { handleSaveHistory(); return built.command; }} label="Copy command" />
            <DownloadButton
              getText={() => `${built.command}\n\n# Intent:\n${intent}\n\n# Notes:\n${built.notes.map((n) => `- ${n}`).join("\n")}`}
              filename="find-command.txt"
              mime="text/plain"
              label="Download .txt"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config); }} />
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{h.platform}</Badge>
                    {h.destructive && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-0.5" /> destructive
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <pre className="text-[10px] font-mono mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                    <code>{h.command}</code>
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Commands are generated locally — nothing is executed or uploaded. History is stored in localStorage on this device only. Always preview destructive commands with -print before running them for real.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PredicateEditor({
  predicate,
  isFirst,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  predicate: Predicate;
  isFirst: boolean;
  onChange: (patch: Partial<Predicate>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const isTime = predicate.kind === "time";
  const isType = predicate.kind === "type";
  const isEmpty = predicate.kind === "empty";
  const isDepth = predicate.kind === "depth";
  return (
    <div className="rounded border bg-background p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {!isFirst && (
          <select
            value={predicate.op}
            onChange={(e) => onChange({ op: e.target.value as Predicate["op"] })}
            className="h-7 text-[11px] rounded border bg-background px-1 font-mono"
          >
            <option value="and">AND (-a)</option>
            <option value="or">OR (-o)</option>
            <option value="not">NOT (-not)</option>
          </select>
        )}
        {isFirst && <span className="text-[10px] text-muted-foreground">first</span>}
        <Badge variant="outline" className="font-mono text-[10px]">{predicate.kind}</Badge>
        <div className="ml-auto flex gap-0.5">
          {onMoveUp && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveUp}>
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {onMoveDown && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveDown}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {!isEmpty && !isDepth && (
        <div className="flex gap-1 flex-wrap">
          {isType ? (
            <select
              value={predicate.value}
              onChange={(e) => onChange({ value: e.target.value })}
              className="h-7 text-[11px] rounded border bg-background px-1 font-mono"
            >
              {FILE_TYPES.map((t) => (
                <option key={t} value={t}>{FILE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          ) : isTime ? (
            <>
              <select
                value={predicate.extra || "mtime"}
                onChange={(e) => onChange({ extra: e.target.value })}
                className="h-7 text-[11px] rounded border bg-background px-1 font-mono"
              >
                {TIME_KINDS.map((t) => (
                  <option key={t} value={t}>{TIME_KIND_LABELS[t]}</option>
                ))}
              </select>
              <Input
                value={predicate.value.replace(/^-?(mtime|mmin|ctime|cmin|atime|amin)\s*/, "")}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="-7 / +7 / 7"
                className="font-mono text-xs h-7 w-24"
              />
            </>
          ) : (
            <Input
              value={predicate.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={placeholderFor(predicate.kind)}
              className="font-mono text-xs h-7 flex-1"
            />
          )}
        </div>
      )}
    </div>
  );
}

function placeholderFor(kind: Predicate["kind"]): string {
  switch (kind) {
    case "name": return "*.log";
    case "iname": return "*.JPG";
    case "path": return "*/src/*.ts";
    case "ipath": return "*/SRC/*";
    case "size": return "+100M / -1k / 0";
    case "newer": return "reference.txt";
    case "perm": return "-o+w / 644 / 755";
    case "user": return "alice";
    case "group": return "staff";
    case "regex": return ".*\\.py$";
    default: return "";
  }
}

void X;
