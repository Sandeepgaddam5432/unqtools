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
  COMMAND_GROUPS,
  SAFETY_LEVELS,
  CLIENT_LANGUAGES,
  GROUP_LABELS,
  REDIS_COMMANDS,
  normalizeCommandName,
  lookupCommand,
  searchCommands,
  getGroupCounts,
  parseCliCommand,
  buildAll,
  generateClientCode,
  getSafetyWarnings,
  formatComplexity,
  exportMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RedisCommand,
  type RedisGroup,
  type SafetyLevel,
  type ClientLanguage,
  type HistoryEntry,
} from "./logic";
import {
  History, Database, Search, AlertTriangle, ShieldAlert,
  ShieldCheck, Terminal, Code2, BookOpen,
} from "lucide-react";

const SAFETY_BADGE: Record<SafetyLevel, { color: string; icon: React.ReactNode; label: string }> = {
  safe: { color: "text-emerald-600 dark:text-emerald-400", icon: <ShieldCheck className="h-3 w-3" />, label: "Safe" },
  warning: { color: "text-yellow-600 dark:text-yellow-400", icon: <AlertTriangle className="h-3 w-3" />, label: "Warning" },
  dangerous: { color: "text-red-600 dark:text-red-400", icon: <ShieldAlert className="h-3 w-3" />, label: "Dangerous" },
};

export default function RedisCommandReferenceBuilder() {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<RedisGroup | "">("");
  const [safetyFilter, setSafetyFilter] = useState<SafetyLevel | "">("");
  const [selected, setSelected] = useState<RedisCommand | null>(null);
  const [args, setArgs] = useState<string[]>([]);
  const [language, setLanguage] = useState<ClientLanguage>("redis-cli");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cliInput, setCliInput] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.commandName) {
        const cmd = lookupCommand(p.commandName);
        if (cmd) {
          setSelected(cmd);
          setArgs(p.args.length > 0 ? p.args : cmd.args.map(() => ""));
          toast.info("Loaded command from share link");
        }
      }
    }
  }, []);

  const filtered = useMemo(
    () => searchCommands({ query, group: groupFilter, safety: safetyFilter }),
    [query, groupFilter, safetyFilter],
  );
  const groupCounts = useMemo(() => getGroupCounts(), []);

  const buildResult = useMemo(() => {
    if (!selected) return null;
    return buildAll(selected, args.filter((a) => a !== ""));
  }, [selected, args]);

  const handleSelect = useCallback((cmd: RedisCommand) => {
    setSelected(cmd);
    setArgs(cmd.args.map(() => ""));
    setLanguage("redis-cli");
    setCliInput("");
  }, []);

  const handleSetArg = (i: number, value: string) => {
    setArgs((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  };

  const handleParseCli = useCallback(() => {
    const parsed = parseCliCommand(cliInput);
    if (!parsed) {
      toast.error("Could not parse command");
      return;
    }
    const cmd = lookupCommand(parsed.name);
    if (!cmd) {
      toast.error(`Unknown command: ${parsed.name}`);
      return;
    }
    setSelected(cmd);
    // Pad args array to match command arity.
    const next: string[] = cmd.args.map((_, i) => parsed.args[i] ?? "");
    if (parsed.args.length > cmd.args.length) {
      // Extra variadic args.
      for (let i = cmd.args.length; i < parsed.args.length; i++) next.push(parsed.args[i]);
    }
    setArgs(next);
    toast.success(`Loaded ${cmd.name}`);
  }, [cliInput]);

  const handleClear = useCallback(() => {
    setQuery("");
    setGroupFilter("");
    setSafetyFilter("");
    setSelected(null);
    setArgs([]);
    setCliInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (selected && buildResult?.ok) {
      saveHistory({
        ts: Date.now(),
        commandName: selected.name,
        group: selected.group,
        cli: buildResult.cli,
        args: args.filter((a) => a !== ""),
      });
      setHistory(loadHistory());
    }
  }, [selected, buildResult, args]);

  const activeCode = useMemo(() => {
    if (!selected) return "";
    const filteredArgs = args.filter((a) => a !== "");
    if (language === "redis-cli") {
      return buildResult?.ok ? buildResult.cli : "";
    }
    return generateClientCode(selected, filteredArgs, language);
  }, [selected, args, language, buildResult]);

  const warnings = useMemo(
    () => (selected ? getSafetyWarnings(selected) : []),
    [selected],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Redis command reference ({REDIS_COMMANDS.length} commands)
            </h3>
            <ClearButton onClick={handleClear} disabled={!query && !groupFilter && !safetyFilter && !selected} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="redis-search" className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="redis-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SET, GET, hash, expire…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Group</Label>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value as RedisGroup | "")}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="">All groups</option>
                {COMMAND_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label} ({groupCounts.find((c) => c.group === g.value)?.count ?? 0})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Safety</Label>
              <select
                value={safetyFilter}
                onChange={(e) => setSafetyFilter(e.target.value as SafetyLevel | "")}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="">Any safety</option>
                {SAFETY_LEVELS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 max-h-[180px] overflow-auto">
            {filtered.map((c) => {
              const badge = SAFETY_BADGE[c.safety];
              return (
                <button
                  key={c.name}
                  onClick={() => handleSelect(c)}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-mono transition-colors ${
                    selected?.name === c.name
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span>{c.name}</span>
                  <span className={`flex items-center gap-0.5 ${badge.color}`}>{badge.icon}</span>
                  {c.deprecated && (
                    <span className="text-[9px] text-muted-foreground">(dep)</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No commands match.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-mono font-semibold text-foreground">{selected.name}</h3>
                  <Badge variant="outline" className="text-[10px]">{GROUP_LABELS[selected.group]}</Badge>
                  <Badge variant="outline" className="text-[10px]">since {selected.since}</Badge>
                  <Badge variant="outline" className="text-[10px]">O: {formatComplexity(selected)}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${SAFETY_BADGE[selected.safety].color}`}>
                    {SAFETY_BADGE[selected.safety].label}
                  </Badge>
                  {selected.deprecated && (
                    <Badge variant="outline" className="text-[10px] text-yellow-600">
                      Deprecated → {selected.replacement}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <CopyButton getText={() => exportMarkdown(selected)} label="Copy .md" />
                  <DownloadButton
                    getText={() => exportMarkdown(selected)}
                    filename={`${selected.name.toLowerCase().replace(/\s+/g, "-")}.md`}
                    mime="text/markdown"
                    label="Download"
                  />
                  <ShareButton getUrl={() => {
                    const a = args.filter((x) => x !== "");
                    return buildShareUrl(selected.name, a);
                  }} />
                </div>
              </div>
              <p className="text-sm text-foreground">{selected.description}</p>
              <div className="rounded border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground overflow-x-auto">
                <span className="text-muted-foreground mr-2">SYNTAX:</span>{selected.syntax}
              </div>
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Returns:</strong> {selected.returns}
              </div>
              {warnings.length > 0 && (
                <div className="space-y-1">
                  {warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
                        w.startsWith("DANGEROUS")
                          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                          : w.startsWith("DEPRECATED")
                            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                            : "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {selected.args.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arguments</h4>
                  {selected.args.map((a, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-2 rounded border bg-background px-2 py-1 text-xs">
                      <span className="font-mono font-medium text-foreground">{a.name}</span>
                      <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                      {a.optional && <Badge variant="outline" className="text-[10px]">optional</Badge>}
                      {a.variadic && <Badge variant="outline" className="text-[10px]">variadic</Badge>}
                      <span className="text-muted-foreground">{a.description}</span>
                    </div>
                  ))}
                </div>
              )}
              {selected.examples.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Examples</h4>
                  {selected.examples.map((e, i) => (
                    <div key={i} className="rounded border bg-background px-2 py-1 text-xs">
                      <div className="text-muted-foreground">{e.description}</div>
                      <code className="block mt-1 font-mono text-foreground">{e.command}</code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Command builder
                </h3>
                <div className="flex gap-1">
                  {CLIENT_LANGUAGES.map((l) => (
                    <Button
                      key={l.value}
                      variant={language === l.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setLanguage(l.value)}
                    >
                      {l.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selected.args.map((a, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {a.name} <span className="text-foreground/60">({a.type})</span>
                      {a.optional && <span className="text-emerald-600"> · optional</span>}
                      {a.variadic && <span className="text-blue-600"> · variadic</span>}
                    </Label>
                    <Input
                      value={args[i] ?? ""}
                      onChange={(e) => handleSetArg(i, e.target.value)}
                      placeholder={a.type === "integer" ? "0" : a.type === "float" || a.type === "score" ? "1.5" : a.type === "pattern" ? "user:*" : a.type === "cursor" ? "0" : "…"}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
              {buildResult && !buildResult.ok && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {buildResult.error}
                </div>
              )}
              {activeCode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5" /> Generated code ({language})
                    </Label>
                    <CopyButton getText={() => { handleRecordHistory(); return activeCode; }} label="Copy" />
                  </div>
                  <Textarea
                    readOnly
                    value={activeCode}
                    className="min-h-[80px] resize-y font-mono text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Paste a redis-cli command to load it
              </h3>
              <div className="flex gap-2">
                <Input
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder={'SET mykey "hello world"'}
                  className="h-8 text-xs font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") handleParseCli(); }}
                />
                <Button size="sm" onClick={handleParseCli}>Load</Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Search and select a Redis command"
          hint="Browse 60 built-in commands across 15 groups, or paste a redis-cli command above to auto-fill the builder. 100% client-side — no Redis instance required."
          icon={<Database className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const c = lookupCommand(h.commandName);
                    if (c) {
                      setSelected(c);
                      setArgs(c.args.map((_, idx) => h.args[idx] ?? ""));
                    }
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.commandName}</Badge>
                    <Badge variant="outline" className="text-[10px]">{GROUP_LABELS[h.group]}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 font-mono text-[10px] text-foreground/80 truncate">{h.cli}</code>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All command lookup, parsing, and client-code generation run entirely in your browser. No Redis instance is contacted. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
