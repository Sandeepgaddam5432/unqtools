"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, GitGraph, ExternalLink, AlertCircle, CheckCircle2,
  BookOpen, Code2, Sparkles,
} from "lucide-react";
import {
  DIAGRAM_TYPES,
  DIAGRAM_LABELS,
  TEMPLATES,
  SYNTAX_REFERENCE,
  defaultCode,
  detectType,
  validateCode,
  autoFormat,
  buildLiveUrl,
  buildMarkdownEmbed,
  buildMermaidCodeBlock,
  computeStats,
  getTemplate,
  getReference,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DiagramType,
  type HistoryEntry,
} from "./logic";

export default function MermaidDiagramLiveEditor() {
  const [code, setCode] = useState<string>(() => defaultCode());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "templates" | "reference">("editor");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setCode(parsed);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedType = useMemo(() => detectType(code), [code]);
  const validation = useMemo(() => validateCode(code), [code]);
  const stats = useMemo(() => computeStats(code), [code]);
  const liveUrl = useMemo(() => buildLiveUrl(code), [code]);
  const markdownEmbed = useMemo(() => buildMarkdownEmbed(code, DIAGRAM_LABELS[detectedType]), [code, detectedType]);
  const codeBlock = useMemo(() => buildMermaidCodeBlock(code, detectedType), [code, detectedType]);

  const handleFormat = useCallback(() => {
    setCode((c) => autoFormat(c));
    toast.success("Auto-formatted");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (code.trim()) {
      saveHistory({
        ts: Date.now(),
        type: detectedType,
        preview: code.slice(0, 80).replace(/\n/g, " "),
        liveUrl,
      });
      setHistory(loadHistory());
    }
  }, [code, detectedType, liveUrl]);

  const handleClear = useCallback(() => {
    setCode("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadTemplate = useCallback((type: DiagramType) => {
    const tpl = getTemplate(type);
    if (tpl) {
      setCode(tpl.code);
      setActiveTab("editor");
      toast.success(`Loaded ${tpl.label} template`);
    }
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant={activeTab === "editor" ? "default" : "outline"} size="sm"
              onClick={() => setActiveTab("editor")} className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> Editor
            </Button>
            <Button variant={activeTab === "templates" ? "default" : "outline"} size="sm"
              onClick={() => setActiveTab("templates")} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Templates
            </Button>
            <Button variant={activeTab === "reference" ? "default" : "outline"} size="sm"
              onClick={() => setActiveTab("reference")} className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Reference
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Type: {DIAGRAM_LABELS[detectedType]}
              </Badge>
              <Badge variant={validation.ok ? "secondary" : "destructive"} className="text-[10px]">
                {validation.ok ? "Valid" : `${validation.issues.filter((i) => i.severity === "error").length} error(s)`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeTab === "editor" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mmd-code">Mermaid source</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {stats.codeLines} code · {stats.commentLines} comment · {stats.blankLines} blank · {stats.charCount} chars
                  </span>
                </div>
                <Textarea
                  id="mmd-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={"flowchart TD\n  A --> B"}
                  className="min-h-[260px] resize-y font-mono text-xs"
                  spellCheck={false}
                />
              </div>

              {validation.issues.length > 0 && (
                <div className="space-y-1">
                  {validation.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded border p-2 text-xs ${
                        issue.severity === "error"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {issue.severity === "error"
                        ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <span className="font-mono">L{issue.line}</span>: {issue.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {validation.ok && code.trim() && (
                <div className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valid {DIAGRAM_LABELS[detectedType]} — open in mermaid.live to render & export.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return code; }}
                  label="Copy code"
                />
                <Button variant="outline" size="sm" onClick={handleFormat} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Auto-format
                </Button>
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-1.5" disabled={!code.trim()}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open in mermaid.live
                  </Button>
                </a>
                <CopyButton
                  getText={() => { handleSaveHistory(); return liveUrl; }}
                  label="Copy live URL"
                  disabled={!code.trim()}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(code); }} disabled={!code.trim()} />
                <ClearButton onClick={handleClear} disabled={!code.trim()} />
              </div>
            </CardContent>
          </Card>

          {code.trim() && validation.ok && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitGraph className="h-4 w-4" /> Export
                </h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">mermaid.live URL (base64)</Label>
                    <div className="rounded border bg-muted/30 p-2 font-mono text-[11px] break-all text-muted-foreground">
                      {liveUrl}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Markdown link</Label>
                    <Textarea readOnly value={markdownEmbed}
                      className="min-h-[60px] resize-y font-mono text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Mermaid code block (for Markdown renderers)</Label>
                    <Textarea readOnly value={codeBlock}
                      className="min-h-[80px] resize-y font-mono text-xs" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => markdownEmbed} label="Copy Markdown" />
                    <CopyButton getText={() => codeBlock} label="Copy code block" />
                    <DownloadButton
                      getText={() => code}
                      filename="diagram.mmd"
                      mime="text/plain"
                      label="Download .mmd"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === "templates" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Template gallery
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEMPLATES.map((tpl) => (
                <button key={tpl.type} type="button"
                  onClick={() => handleLoadTemplate(tpl.type)}
                  className="rounded border bg-background p-3 text-left hover:bg-accent hover:border-primary transition-colors">
                  <div className="text-sm font-medium text-foreground">{tpl.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{tpl.description}</div>
                  <pre className="mt-2 rounded bg-muted/30 p-2 font-mono text-[10px] overflow-auto max-h-[100px]">{tpl.code}</pre>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "reference" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Syntax reference
            </h3>
            <div className="space-y-2">
              {SYNTAX_REFERENCE.map((ref) => (
                <details key={ref.type} className="rounded border bg-background">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                    {ref.label}
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-muted-foreground">{ref.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {ref.keywords.map((k) => (
                        <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
                      ))}
                    </div>
                    <pre className="rounded bg-muted/30 p-2 font-mono text-[11px] overflow-auto">{ref.example}</pre>
                    <Button variant="outline" size="sm"
                      onClick={() => handleLoadTemplate(ref.type as DiagramType)}>
                      Load template
                    </Button>
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                <button key={i} type="button"
                  onClick={() => {
                    if (h.liveUrl) {
                      // Restore via the live URL is not possible without decoding base64; just open it
                      window.open(h.liveUrl, "_blank");
                    }
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{DIAGRAM_LABELS[h.type]}</Badge>
                    <span className="font-mono text-muted-foreground truncate flex-1">{h.preview}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All syntax validation, type detection, and URL encoding runs locally in your browser. The diagram is rendered by <code>mermaid.live</code> when you click "Open in mermaid.live" — no source code is uploaded to our servers. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
