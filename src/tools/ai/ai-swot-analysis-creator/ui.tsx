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
  INDUSTRY_TEMPLATES,
  INDUSTRY_BY_ID,
  generateSwot,
  regenerateQuadrant,
  validateSwot,
  renderMarkdown,
  renderJson,
  renderHtmlMatrix,
  renderTowsTable,
  prioritizeTows,
  buildLlmRequestBody,
  parseLlmSwotResponse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Quadrant,
  type SwotItem,
  type SwotMatrix,
  type HistoryEntry,
} from "./logic";
import {
  LayoutGrid, History, Wand2, AlertTriangle, RefreshCw, Sparkles,
} from "lucide-react";

const QUADRANTS: { id: Quadrant; label: string; color: string }[] = [
  { id: "strengths", label: "Strengths", color: "emerald" },
  { id: "weaknesses", label: "Weaknesses", color: "rose" },
  { id: "opportunities", label: "Opportunities", color: "sky" },
  { id: "threats", label: "Threats", color: "amber" },
];

export default function AiSwotAnalysisCreator() {
  const [subject, setSubject] = useState("");
  const [industry, setIndustry] = useState<string>("saas");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [maxPerQuadrant, setMaxPerQuadrant] = useState(6);
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [matrix, setMatrix] = useState<SwotMatrix | null>(null);
  const [editing, setEditing] = useState<Quadrant | null>(null);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.subject) setSubject(p.subject);
      if (p.industry) setIndustry(p.industry);
      if (p.goal) setGoal(p.goal);
      if (p.description) setDescription(p.description);
      if (p.subject || p.description) toast.info("Loaded from share link");
    }
  }, []);

  const validation = useMemo(() => (matrix ? validateSwot(matrix) : null), [matrix]);
  const sortedTows = useMemo(() => (matrix ? prioritizeTows(matrix.tows) : []), [matrix]);
  const markdown = useMemo(() => (matrix ? renderMarkdown(matrix) : ""), [matrix]);
  const json = useMemo(() => (matrix ? renderJson(matrix) : ""), [matrix]);
  const htmlMatrix = useMemo(() => (matrix ? renderHtmlMatrix(matrix) : ""), [matrix]);
  const htmlTows = useMemo(() => (matrix ? renderTowsTable(matrix) : ""), [matrix]);

  const handleGenerate = useCallback(() => {
    if (!subject.trim()) {
      toast.error("Enter a subject first");
      return;
    }
    const m = generateSwot({
      subject,
      industry,
      goal,
      description,
      maxPerQuadrant,
    });
    setMatrix(m);
    const total = m.strengths.length + m.weaknesses.length + m.opportunities.length + m.threats.length;
    saveHistory({ ts: Date.now(), subject, industry, itemCount: total });
    setHistory(loadHistory());
    if (m.warnings.length > 0) toast.info(`Generated with ${m.warnings.length} warning(s)`);
    else toast.success(`Generated ${total} bullets + ${m.tows.length} TOWS actions`);
  }, [subject, industry, goal, description, maxPerQuadrant]);

  const handleEditQuadrant = useCallback((q: Quadrant) => {
    if (!matrix) return;
    setEditing(q);
    setEditText(matrix[q].map((i) => i.text).join("\n"));
  }, [matrix]);

  const handleSaveQuadrant = useCallback(() => {
    if (!matrix || !editing) return;
    const items: SwotItem[] = editText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => {
        // Preserve existing impact if text matches, else default 3
        const existing = matrix[editing].find((i) => i.text === text);
        return { text, impact: existing?.impact ?? 3, feasibility: 0 };
      });
    const next = regenerateQuadrant(matrix, editing, items);
    setMatrix(next);
    setEditing(null);
    setEditText("");
    toast.success(`Updated ${editing}`);
  }, [matrix, editing, editText]);

  const handleCancelEdit = useCallback(() => {
    setEditing(null);
    setEditText("");
  }, []);

  const handleUpdateImpact = useCallback((q: Quadrant, idx: number, impact: number) => {
    if (!matrix) return;
    const next = { ...matrix };
    const arr = [...next[q]];
    arr[idx] = { ...arr[idx], impact };
    next[q] = arr;
    next.tows = regenerateQuadrant(next, q, arr).tows;
    setMatrix(next);
  }, [matrix]);

  const handleLlmEnhance = useCallback(async () => {
    if (!apiKey.trim()) { toast.error("Paste an API key to use LLM enhancement"); return; }
    if (!subject.trim()) { toast.error("Enter a subject first"); return; }
    if (!matrix) { toast.error("Generate a baseline SWOT first"); return; }
    setLlmLoading(true);
    try {
      const body = buildLlmRequestBody({ apiKey, subject, industry, description, goal });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body,
      });
      if (!res.ok) {
        toast.error(`LLM error: ${res.status}`);
        return;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      const next = parseLlmSwotResponse(text, matrix);
      if (!next) {
        toast.error("LLM response was not valid SWOT JSON");
        return;
      }
      setMatrix(next);
      toast.success("LLM-enhanced SWOT applied");
    } catch (e) {
      toast.error(`LLM fetch failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, subject, industry, description, goal, matrix]);

  const handleClear = useCallback(() => {
    setMatrix(null);
    setSubject("");
    setGoal("");
    setDescription("");
    setEditing(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const quadrantColorClass = (color: string): string => {
    switch (color) {
      case "emerald": return "border-emerald-500/40 bg-emerald-500/5";
      case "rose": return "border-rose-500/40 bg-rose-500/5";
      case "sky": return "border-sky-500/40 bg-sky-500/5";
      case "amber": return "border-amber-500/40 bg-amber-500/5";
      default: return "border-border bg-background";
    }
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="swot-subject" className="text-xs">Subject (company, product, project, career)</Label>
              <Input
                id="swot-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Acme SaaS — a B2B startup"
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Industry template</Label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-9 text-xs rounded border bg-background px-2 mt-1"
              >
                {INDUSTRY_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="swot-goal" className="text-xs">Goal (optional — e.g. "Grow ARR 2x in 12 months")</Label>
            <Input
              id="swot-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Grow ARR 2x in 12 months"
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <Label htmlFor="swot-desc" className="text-xs">Description (the more detail, the more specific the bullets)</Label>
            <Textarea
              id="swot-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"Bootstrapped SaaS with recurring subscription revenue. Solo founder. Strong brand in a niche. AI-native features shipping fast. Big-tech incumbent risk."}
              className="min-h-[100px] resize-y text-xs mt-1"
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              {description.length} chars — keywords like "recurring", "single founder", "AI", "incumbent" auto-enrich specific quadrants.
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Max bullets per quadrant: {maxPerQuadrant}</Label>
              <input
                type="range"
                min={3}
                max={10}
                value={maxPerQuadrant}
                onChange={(e) => setMaxPerQuadrant(parseInt(e.target.value, 10))}
                className="w-40 mt-1"
              />
            </div>
            <Button onClick={handleGenerate} className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" /> Generate SWOT
            </Button>
            <ClearButton onClick={handleClear} disabled={!matrix && !subject && !description} />
          </div>
        </CardContent>
      </Card>

      {matrix ? (
        <>
          {validation && !validation.valid && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{validation.errors.join("; ")}</span>
            </div>
          )}
          {matrix.warnings.length > 0 && (
            <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              {matrix.warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4" /> {matrix.subject}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{INDUSTRY_BY_ID[matrix.industry]?.label ?? matrix.industry}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{matrix.strengths.length + matrix.weaknesses.length + matrix.opportunities.length + matrix.threats.length} bullets</Badge>
                  <Badge variant="secondary" className="text-[10px]">{matrix.tows.length} TOWS</Badge>
                </div>
              </div>
              {matrix.goal && <p className="text-xs text-muted-foreground"><strong className="text-foreground">Goal:</strong> {matrix.goal}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {QUADRANTS.map((q) => (
                  <div key={q.id} className={`rounded-lg border p-3 ${quadrantColorClass(q.color)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold capitalize text-foreground">{q.label}</h4>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditQuadrant(q.id)}
                          title="Edit quadrant"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleGenerate}
                          title="Regenerate (re-runs full SWOT)"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {editing === q.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[100px] text-xs font-mono"
                          placeholder={"One bullet per line"}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveQuadrant}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {matrix[q.id].map((item, i) => (
                          <li key={i} className="text-xs flex items-start gap-2">
                            <span className="text-muted-foreground mt-0.5">•</span>
                            <span className="flex-1 text-foreground">{item.text}</span>
                            <select
                              value={item.impact}
                              onChange={(e) => handleUpdateImpact(q.id, i, parseInt(e.target.value, 10))}
                              className="h-6 text-[10px] rounded border bg-background px-1"
                              title="Impact (1-5)"
                            >
                              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </li>
                        ))}
                        {matrix[q.id].length === 0 && (
                          <li className="text-xs text-muted-foreground italic">No items — click edit to add.</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> TOWS Strategy Actions ({sortedTows.length})
              </h3>
              <p className="text-xs text-muted-foreground">Sorted by impact × feasibility score (highest first). SO = use Strengths for Opportunities; ST = defend against Threats; WO = fix Weaknesses to capture Opportunities; WT = mitigate Weaknesses against Threats.</p>
              <div className="space-y-1 max-h-[320px] overflow-auto">
                {sortedTows.map((a, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="secondary" className="text-[10px]">{a.strategy}</Badge>
                      <Badge variant="outline" className="text-[10px]">score {a.score}</Badge>
                      <span className="text-[10px] text-muted-foreground">impact {a.impact} × feasibility {a.feasibility}</span>
                    </div>
                    <span className="text-foreground">{a.action}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">Markdown source</h3>
              <pre className="max-h-[240px] overflow-auto rounded border bg-muted/40 p-3 text-[10px] font-mono whitespace-pre-wrap">
                {markdown}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => markdown} label="Copy Markdown" />
                <DownloadButton getText={() => markdown} filename="swot-analysis.md" mime="text/markdown" label="Download .md" />
                <CopyButton getText={() => json} label="Copy JSON" />
                <DownloadButton getText={() => json} filename="swot-analysis.json" mime="application/json" label="Download .json" />
                <CopyButton getText={() => htmlMatrix} label="Copy HTML matrix" />
                <DownloadButton getText={() => `<!doctype html><html><head><meta charset="utf-8"><title>${matrix.subject} — SWOT</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#222}.swot-matrix{display:grid;gap:12px}.swot-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.swot-cell{border:1px solid #ddd;border-radius:8px;padding:16px}.swot-cell h3{margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em}.swot-strengths{background:#ecfdf5}.swot-weaknesses{background:#fff1f2}.swot-opportunities{background:#f0f9ff}.swot-threats{background:#fffbeb}.swot-cell ul{margin:0;padding-left:18px}.swot-cell li{margin:4px 0;font-size:13px}.impact{color:#888;font-size:11px}.tows-table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}.tows-table th,.tows-table td{border:1px solid #ddd;padding:6px 10px;text-align:left}.tows-table th{background:#f5f5f5}</style></head><body><h1>SWOT: ${matrix.subject}</h1>${htmlMatrix}<h2 style="margin-top:24px">TOWS Strategy Actions</h2>${htmlTows}</body></html>`} filename="swot-analysis.html" mime="text/html" label="Download .html" />
                <ShareButton getUrl={() => buildShareUrl({ subject, industry, goal, description })} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate a SWOT + TOWS analysis"
          hint="Enter a subject (company, product, project, or career), pick an industry template, optionally add a goal and description, then click Generate. The 2×2 matrix and TOWS actions fill in below — fully editable."
          icon={<LayoutGrid className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Optional BYO-key LLM enhancement
          </h3>
          <p className="text-xs text-muted-foreground">
            On-device templates give concrete starter bullets, but a BYO-key LLM (e.g. OpenAI gpt-4o-mini) can refine them with your specific context. Paste a key (kept in memory only — never stored) and the request goes directly from your browser.
          </p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            className="h-9 text-xs font-mono"
          />
          <Button variant="outline" size="sm" onClick={handleLlmEnhance} disabled={llmLoading || !matrix} className="gap-1.5">
            {llmLoading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {llmLoading ? "Calling LLM…" : "Refine quadrants with LLM"}
          </Button>
          {!matrix && <p className="text-[10px] text-muted-foreground">Generate a baseline SWOT first so the LLM has structure to refine.</p>}
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
                  <Badge variant="outline" className="mr-2">{h.industry}</Badge>
                  <Badge variant="outline" className="mr-2">{h.itemCount} bullets</Badge>
                  <span className="text-foreground">{h.subject}</span>
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
            <strong className="text-foreground">Privacy & honesty:</strong> All generation, enrichment, TOWS derivation, and rendering run locally in your browser — your subject, goal, and description never leave this device unless you explicitly paste an API key for LLM enhancement (and even then the request goes directly to the model endpoint you specify). SWOT is a starting framework, not validated strategy or business advice — verify the bullets with real data before acting. No watermark, no forced sign-up, no upload. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
