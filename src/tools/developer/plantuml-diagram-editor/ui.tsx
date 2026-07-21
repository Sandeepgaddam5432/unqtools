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
  BookOpen, Code2, Sparkles, Image as ImageIcon,
} from "lucide-react";
import {
  DIAGRAM_TYPES,
  DIAGRAM_LABELS,
  THEMES,
  TEMPLATES,
  SYNTAX_REFERENCE,
  PLANTUML_SERVER_BASE,
  defaultCode,
  detectType,
  validateCode,
  autoFormat,
  buildRenderUrl,
  buildMarkdownEmbed,
  buildPumlCodeBlock,
  decodeRenderUrl,
  computeStats,
  getTemplate,
  getReference,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DiagramType,
  type ExportFormat,
  type ThemeName,
  type HistoryEntry,
} from "./logic";

export default function PlantUmlDiagramEditor() {
  const [code, setCode] = useState<string>(() => defaultCode());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [theme, setTheme] = useState<ThemeName>("plain");
  const [activeTab, setActiveTab] = useState<"editor" | "templates" | "reference">("editor");
  const [decodeInput, setDecodeInput] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.code) {
        setCode(parsed.code);
        setTheme(parsed.theme);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedType = useMemo(() => detectType(code), [code]);
  const validation = useMemo(() => validateCode(code), [code]);
  const stats = useMemo(() => computeStats(code), [code]);
  const svgUrl = useMemo(() => buildRenderUrl(code, "svg", theme), [code, theme]);
  const pngUrl = useMemo(() => buildRenderUrl(code, "png", theme), [code, theme]);
  const asciiUrl = useMemo(() => buildRenderUrl(code, "uml", theme), [code, theme]);
  const markdownEmbed = useMemo(
    () => buildMarkdownEmbed(code, "svg", DIAGRAM_LABELS[detectedType]),
    [code, detectedType, theme],
  );
  const codeBlock = useMemo(() => buildPumlCodeBlock(code), [code]);

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
        renderUrl: svgUrl,
      });
      setHistory(loadHistory());
    }
  }, [code, detectedType, svgUrl]);

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

  const handleDecodeUrl = useCallback(() => {
    const decoded = decodeRenderUrl(decodeInput);
    if (decoded) {
      setCode(decoded);
      toast.success("Decoded render URL — source loaded");
      setActiveTab("editor");
    } else {
      toast.error("Could not decode URL — not a plantuml.com render URL");
    }
  }, [decodeInput]);

  const renderExportLink = (format: ExportFormat, label: string, url: string, icon: React.ReactNode) => (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex">
      <Button variant="outline" size="sm" className="gap-1.5" disabled={!code.trim()}>
        {icon}
        {label}
      </Button>
    </a>
  );

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
                  <Label htmlFor="puml-code">PlantUML source</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {stats.codeLines} code · {stats.commentLines} comment · {stats.blankLines} blank · {stats.charCount} chars
                  </span>
                </div>
                <Textarea
                  id="puml-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={"@startuml\nA --> B\n@enduml"}
                  className="min-h-[260px] resize-y font-mono text-xs"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="puml-theme" className="text-xs">Theme:</Label>
                <select
                  id="puml-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeName)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
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
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        {issue.line > 0 && <span className="font-mono">L{issue.line}</span>}
                        {issue.line > 0 ? ": " : ""}
                        {issue.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {validation.ok && code.trim() && (
                <div className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valid {DIAGRAM_LABELS[detectedType]} — open in plantuml.com to render & export.
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
                <a href={svgUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-1.5" disabled={!code.trim()}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open in plantuml.com
                  </Button>
                </a>
                <CopyButton
                  getText={() => { handleSaveHistory(); return svgUrl; }}
                  label="Copy render URL"
                  disabled={!code.trim()}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(code, theme); }} disabled={!code.trim()} />
                <ClearButton onClick={handleClear} disabled={!code.trim()} />
              </div>
            </CardContent>
          </Card>

          {code.trim() && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitGraph className="h-4 w-4" /> Render & Export
                </h3>
                <div className="flex flex-wrap gap-2">
                  {renderExportLink("svg", "Open SVG", svgUrl, <ImageIcon className="h-3.5 w-3.5" />)}
                  {renderExportLink("png", "Open PNG", pngUrl, <ImageIcon className="h-3.5 w-3.5" />)}
                  {renderExportLink("uml", "Open ASCII", asciiUrl, <Code2 className="h-3.5 w-3.5" />)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">SVG render URL</Label>
                    <Textarea readOnly value={svgUrl}
                      className="min-h-[60px] resize-y font-mono text-[11px]" />
                  </div>
                  <div>
                    <Label className="text-xs">PNG render URL</Label>
                    <Textarea readOnly value={pngUrl}
                      className="min-h-[60px] resize-y font-mono text-[11px]" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Markdown image embed</Label>
                  <Textarea readOnly value={markdownEmbed}
                    className="min-h-[60px] resize-y font-mono text-xs" />
                </div>

                <div>
                  <Label className="text-xs">PlantUML code block (for Markdown renderers)</Label>
                  <Textarea readOnly value={codeBlock}
                    className="min-h-[80px] resize-y font-mono text-xs" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => markdownEmbed} label="Copy Markdown" />
                  <CopyButton getText={() => codeBlock} label="Copy code block" />
                  <DownloadButton
                    getText={() => code}
                    filename="diagram.puml"
                    mime="text/plain"
                    label="Download .puml"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> Decode a plantuml.com URL
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste a render URL (e.g. <code>{PLANTUML_SERVER_BASE}/svg/&#123;encoded&#125;</code>) to extract the original PlantUML source.
              </p>
              <Textarea
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value)}
                placeholder="https://www.plantuml.com/plantuml/svg/SyfFKj2rKt3CoKnELR1Io4ZDoSa70000"
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <Button size="sm" onClick={handleDecodeUrl} disabled={!decodeInput.trim()} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Decode URL to source
              </Button>
            </CardContent>
          </Card>
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
                    if (h.renderUrl) {
                      window.open(h.renderUrl, "_blank");
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
            <strong className="text-foreground">Privacy:</strong> All syntax validation, type detection, and URL encoding runs locally in your browser. The diagram is rendered by <code>plantuml.com</code> when you click "Open in plantuml.com" — your source code is sent to the official server only when you open the render URL. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
