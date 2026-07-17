"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  TEMPLATES,
  applyTemplate,
  suggestH2Topics,
  suggestH3Topics,
  validateInput,
  buildH1,
  totalWordTarget,
  renderMarkdown,
  renderHtml,
  renderJson,
  fillPlaceholders,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type OutlineSection,
  type OutlineInput,
  type OutlineTemplate,
  type HistoryEntry,
} from "./logic";
import {
  History,
  Plus,
  X,
  ListTree,
  ChevronUp,
  ChevronDown,
  Lightbulb,
} from "lucide-react";

const TEMPLATE_OPTIONS = Object.entries(TEMPLATES).map(([key, val]) => ({
  key: key as OutlineTemplate,
  label: val.label,
  description: val.description,
}));

function moveSection(sections: OutlineSection[], from: number, to: number): OutlineSection[] {
  if (from < 0 || from >= sections.length) return sections;
  if (to < 0 || to >= sections.length) return sections;
  const next = sections.slice();
  const [s] = next.splice(from, 1);
  next.splice(to, 0, s);
  return next;
}

export default function ContentOutlineGenerator() {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [secondaryKeywordsText, setSecondaryKeywordsText] = useState("");
  const [intro, setIntro] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [sections, setSections] = useState<OutlineSection[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.topic) {
        setTopic(parsed.topic);
        if (parsed.keyword) setKeyword(parsed.keyword);
        if (parsed.secondaryKeywords) setSecondaryKeywordsText(parsed.secondaryKeywords.join(", "));
        if (parsed.intro) setIntro(parsed.intro);
        if (parsed.conclusion) setConclusion(parsed.conclusion);
        if (parsed.sections) setSections(parsed.sections);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const input: OutlineInput = useMemo(
    () => ({
      topic,
      keyword,
      secondaryKeywords: secondaryKeywordsText
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      intro: intro || undefined,
      conclusion: conclusion || undefined,
      sections,
    }),
    [topic, keyword, secondaryKeywordsText, intro, conclusion, sections],
  );

  const validation = useMemo(() => validateInput(input), [input]);
  const h1Preview = useMemo(() => buildH1(topic, keyword), [topic, keyword]);
  const wordTotal = useMemo(() => totalWordTarget(sections), [sections]);
  const markdownOutput = useMemo(() => {
    try {
      if (!topic.trim()) return "";
      return renderMarkdown(input);
    } catch {
      return "";
    }
  }, [input, topic]);

  const h2Suggestions = useMemo(() => suggestH2Topics(topic), [topic]);

  const applyTemplateChoice = useCallback(
    (template: OutlineTemplate) => {
      const newSections = applyTemplate(template, topic, keyword);
      setSections(newSections);
      toast.success(`Applied ${TEMPLATES[template].label} template`);
    },
    [topic, keyword],
  );

  const addSection = useCallback(
    (level: 2 | 3) => {
      setSections((prev) => [...prev, { heading: "", level, wordTarget: 100 }]);
    },
    [],
  );
  const removeSection = useCallback((i: number) => {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateSection = useCallback(
    (i: number, key: keyof OutlineSection, val: unknown) => {
      setSections((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)),
      );
    },
    [],
  );
  const handleUp = useCallback(
    (i: number) => setSections((prev) => moveSection(prev, i, i - 1)),
    [],
  );
  const handleDown = useCallback(
    (i: number) => setSections((prev) => moveSection(prev, i, i + 1)),
    [],
  );

  const addH2Suggestion = useCallback((s: string) => {
    setSections((prev) => [...prev, { heading: s, level: 2, wordTarget: 200 }]);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (topic.trim()) {
      saveHistory({
        ts: Date.now(),
        topic,
        sectionCount: sections.length,
        snippet: markdownOutput.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [topic, sections.length, markdownOutput]);

  const handleClear = useCallback(() => {
    setTopic("");
    setKeyword("");
    setSecondaryKeywordsText("");
    setIntro("");
    setConclusion("");
    setSections([]);
    toast.info("Outline cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="co-topic">Topic *</Label>
              <Input
                id="co-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Email Marketing"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="co-keyword">Target keyword</Label>
              <Input
                id="co-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="email marketing tips"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="co-secondary">Secondary keywords (comma-separated)</Label>
            <Input
              id="co-secondary"
              value={secondaryKeywordsText}
              onChange={(e) => setSecondaryKeywordsText(e.target.value)}
              placeholder="email automation, drip campaign, newsletter"
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label htmlFor="co-template">Apply template</Label>
            <Select onValueChange={(v) => applyTemplateChoice(v as OutlineTemplate)}>
              <SelectTrigger id="co-template" className="mt-1">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label} — {t.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {h1Preview && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Generated H1</div>
              <div className="text-base font-semibold text-foreground mt-1">{h1Preview}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {h2Suggestions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Suggested H2 topics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {h2Suggestions.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  onClick={() => addH2Suggestion(s)}
                  className="text-xs h-auto py-1"
                >
                  + {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Sections ({sections.length}) · Target: {wordTotal} words
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addSection(2)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> H2
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addSection(3)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> H3
              </Button>
            </div>
          </div>
          {sections.map((s, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={s.level === 2 ? "default" : "outline"} className="text-xs">
                  H{s.level}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleUp(i)} disabled={i === 0} aria-label="Move up">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDown(i)} disabled={i === sections.length - 1} aria-label="Move down">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeSection(i)} aria-label="Remove">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                value={s.heading}
                onChange={(e) => updateSection(i, "heading", e.target.value)}
                placeholder="Section heading (use {topic} or {keyword} as placeholders)"
                className="text-sm"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`wt-${i}`} className="text-xs">Word target</Label>
                  <Input
                    id={`wt-${i}`}
                    type="number"
                    min={0}
                    value={s.wordTarget ?? ""}
                    onChange={(e) => updateSection(i, "wordTarget", e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
                    placeholder="200"
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor={`kp-${i}`} className="text-xs">Key points (one per line)</Label>
                  <Textarea
                    id={`kp-${i}`}
                    value={(s.keyPoints || []).join("\n")}
                    onChange={(e) => updateSection(i, "keyPoints", e.target.value.split("\n").filter(Boolean))}
                    placeholder={"Point one\nPoint two"}
                    className="mt-1 text-xs min-h-[40px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="co-intro">Introduction (optional)</Label>
            <Textarea
              id="co-intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Hook the reader and state the problem…"
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>
          <div>
            <Label htmlFor="co-conclusion">Conclusion (optional)</Label>
            <Textarea
              id="co-conclusion"
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="Recap and call to action…"
              className="mt-1 min-h-[60px] text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {markdownOutput ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Outline preview (Markdown)</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return markdownOutput; }} label="Copy .md" />
              <DownloadButton getText={() => markdownOutput} filename="outline.md" label="Download .md" />
              <DownloadButton
                getText={() => { try { return renderHtml(input); } catch { return ""; } }}
                filename="outline.html"
                mime="text/html"
                label="Download .html"
              />
              <DownloadButton
                getText={() => { try { return renderJson(input); } catch { return ""; } }}
                filename="outline.json"
                mime="application/json"
                label="Download .json"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[500px]">
            {markdownOutput}
          </pre>
        </div>
      ) : (
        <EmptyState
          title="Enter a topic to generate an outline"
          hint="Pick a template (or start from scratch), set word targets per section, and export as Markdown, HTML, or JSON."
          icon={<ListTree className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.sectionCount} sections</Badge>
                  <span className="text-muted-foreground">{h.topic}</span>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Outline
            generation runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
