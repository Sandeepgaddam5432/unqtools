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
  COMMAND_NAMES,
  OPERATORS,
  explain,
  formatExplanation,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Variant,
  type ExplainedToken,
  type HistoryEntry,
} from "./logic";
import {
  History, Terminal, ShieldAlert, AlertTriangle, ShieldCheck,
  Info, Search, Zap,
} from "lucide-react";

const TYPE_COLOR: Record<string, string> = {
  command: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  subcommand: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  "short-flag": "text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/30",
  "long-flag": "text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/30",
  "combined-flag": "text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/30",
  "flag-value": "text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/30",
  positional: "text-foreground bg-muted/40 border-border",
  operator: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
  redirect: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
  "redirect-target": "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
  pipe: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
};

const TYPE_LABEL: Record<string, string> = {
  command: "CMD",
  subcommand: "SUB",
  "short-flag": "FLAG",
  "long-flag": "FLAG",
  "combined-flag": "FLAGS",
  "flag-value": "VALUE",
  positional: "ARG",
  operator: "OP",
  redirect: "REDIR",
  "redirect-target": "PATH",
  pipe: "PIPE",
};

const SAMPLE_COMMANDS = [
  "ls -lah --color=auto /var/log",
  "find . -type f -name '*.ts' -exec wc -l {} \\;",
  "grep -rn 'TODO' --include='*.ts' src/",
  "chmod -R 755 public/",
  "rm -rf node_modules",
  "curl -fsSL https://example.com/install.sh | sh",
  "tar -czvf archive.tar.gz src/",
  "git log --oneline --graph --all -n 20",
  "docker run -d -p 8080:80 --name web nginx",
  "dd if=ubuntu.iso of=/dev/sdb bs=4M",
  ":(){ :|:& };:",
  "ps aux | grep node | grep -v grep | awk '{print $2}' | xargs kill -9",
];

export default function ShellCommandExplainer() {
  const [command, setCommand] = useState("ls -lah /tmp");
  const [variant, setVariant] = useState<Variant>("gnu");
  const [filter, setFilter] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.command) {
        setCommand(p.command);
        setVariant(p.variant);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => explain(command, variant), [command, variant]);
  const filterLower = filter.toLowerCase();
  const knownCommands = useMemo(() => {
    const lower = filterLower;
    return COMMAND_NAMES.filter((n) => n.includes(lower)).slice(0, 24);
  }, [filterLower]);

  const handleClear = useCallback(() => {
    setCommand("");
    setFilter("");
    setSelected(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (command.trim()) {
      saveHistory({
        ts: Date.now(),
        command,
        stageCount: result.parsed.stages.length,
        dangerCount: result.dangers.length,
      });
      setHistory(loadHistory());
    }
  }, [command, result]);

  const handleSelectToken = (idx: number) => {
    setSelected((prev) => (prev === idx ? null : idx));
  };

  const explanationText = useMemo(() => formatExplanation(result), [result]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> Command to explain
            </h3>
            <div className="flex gap-1">
              <Button
                variant={variant === "gnu" ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setVariant("gnu")}
              >GNU/Linux</Button>
              <Button
                variant={variant === "bsd" ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setVariant("bsd")}
              >BSD/macOS</Button>
              <ClearButton onClick={handleClear} disabled={!command} />
            </div>
          </div>
          <Textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Paste a shell command line: ls -la | grep foo | wc -l"
            className="min-h-[80px] resize-y font-mono text-xs"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                handleRecordHistory();
                toast.success("Saved to history");
              }
            }}
          />
          <div className="flex flex-wrap gap-1">
            {SAMPLE_COMMANDS.map((s, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] font-mono"
                title={s}
                onClick={() => setCommand(s)}
              >
                {s.length > 30 ? s.slice(0, 30) + "…" : s}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <CopyButton
              getText={() => { handleRecordHistory(); return explanationText; }}
              label="Copy explanation"
            />
            <DownloadButton
              getText={() => explanationText}
              filename="shell-command-explanation.txt"
              mime="text/plain"
              label="Download .txt"
            />
            <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(command, variant); }} />
          </div>
        </CardContent>
      </Card>

      {command.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Info className="h-4 w-4" /> Plain-English summary
              </h3>
              <p className="text-sm text-foreground">{result.summary}</p>
              {result.parsed.hasUnknown && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-300">
                  <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>One or more commands are not in the bundled offline dataset. The structure is still parsed token-by-token; install <code className="font-mono">tldr</code> or run <code className="font-mono">man &lt;cmd&gt;</code> locally for the canonical reference.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {result.dangers.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-600" /> Danger linter ({result.dangers.length})
                </h3>
                <div className="space-y-1">
                  {result.dangers.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
                        d.level === "danger"
                          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                          : d.level === "warning"
                            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                            : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {d.level === "caution"
                        ? <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                      <span>{d.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Tokenized breakdown ({result.parsed.stages.length} stage{result.parsed.stages.length !== 1 ? "s" : ""})
              </h3>
              {result.parsed.stages.map((stage, si) => {
                const tokens = result.explained[si] ?? [];
                return (
                  <div key={si} className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">Stage {si + 1}</Badge>
                      <span className="font-mono font-semibold text-foreground">
                        {stage.commandName}{stage.subcommandName ? " " + stage.subcommandName : ""}
                      </span>
                      {stage.trailingOperator && (
                        <Badge variant="outline" className="text-[10px] font-mono">{stage.trailingOperator}</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {tokens.map((t, ti) => (
                        <TokenRow
                          key={ti}
                          token={t}
                          selected={selected === si * 1000 + ti}
                          onSelect={() => handleSelectToken(si * 1000 + ti)}
                        />
                      ))}
                      {tokens.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">(empty stage)</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Info className="h-4 w-4" /> Annotated explanation (text)
              </h3>
              <Textarea
                readOnly
                value={explanationText}
                className="min-h-[160px] resize-y font-mono text-[11px]"
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste a shell command to explain"
          hint="Each token (command, flag, flag-value, positional, operator) is broken out with its man-page description. Combined short flags are split, pipelines and redirections are decomposed, and destructive patterns trigger a warning."
          icon={<Terminal className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Bundled command database ({COMMAND_NAMES.length})
          </h3>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter commands…"
            className="h-8 text-xs"
          />
          <div className="flex flex-wrap gap-1 max-h-[140px] overflow-auto">
            {knownCommands.map((n) => (
              <Badge
                key={n}
                variant="outline"
                className="text-[10px] font-mono cursor-pointer hover:bg-muted"
                onClick={() => setCommand(n + " ")}
              >
                {n}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Recognized operators: {OPERATORS.map((o) => o.token).join("  ·  ")}
          </p>
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
            <div className="space-y-1 max-h-[180px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => setCommand(h.command)}
                  className="block w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.stageCount} stage{h.stageCount !== 1 ? "s" : ""}</Badge>
                    {h.dangerCount > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-red-600">
                        <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />{h.dangerCount} warning{h.dangerCount !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600">
                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />clean
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 font-mono text-[10px] text-foreground/80 truncate">{h.command}</code>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & honesty:</strong> All parsing, classification, and explanation run entirely in your browser — the pasted command never leaves this device. Explanations come from a curated, versioned offline manpage/tldr snapshot of common GNU/BSD tools; it can lag your exact local version, and uncommon tools may be missing. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TokenRow({
  token,
  selected,
  onSelect,
}: {
  token: ExplainedToken;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = TYPE_COLOR[token.type] ?? TYPE_COLOR.positional;
  return (
    <button
      onClick={onSelect}
      className={`block w-full text-left rounded border px-2 py-1 text-xs transition-colors ${
        selected ? "ring-2 ring-primary" : ""
      } ${color}`}
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] font-mono">{TYPE_LABEL[token.type] ?? token.type}</Badge>
        <code className="font-mono font-semibold text-xs">{token.raw || "(empty)"}</code>
        {token.unknown && <Badge variant="outline" className="text-[9px] text-muted-foreground">unknown</Badge>}
        {token.danger && (
          <Badge variant="outline" className="text-[9px] text-red-600">
            <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />danger
          </Badge>
        )}
      </div>
      {token.description && (
        <p className="text-[11px] mt-0.5 text-foreground/80">{token.description}</p>
      )}
      {token.dangerMessage && (
        <p className="text-[11px] mt-0.5 text-red-700 dark:text-red-300">⚠ {token.dangerMessage}</p>
      )}
    </button>
  );
}
