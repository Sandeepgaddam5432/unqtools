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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  HEADLINE_CHAR_LIMIT,
  ABOUT_CHAR_LIMIT,
  TONE_LABELS,
  CTA_LABELS,
  ROLE_PRESETS,
  INDUSTRY_PRESETS,
  clean,
  countChars,
  extractKeywords,
  suggestKeywords,
  keywordGap,
  generateHeadlines,
  generateAbouts,
  scoreProfile,
  beforeAfterDiff,
  renderHeadlinesText,
  renderAboutsText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Tone,
  type Cta,
  type HeadlineVariant,
  type AboutVariant,
  type HistoryEntry,
  type ShareState,
  type KeywordGap,
} from "./logic";
import {
  Linkedin, Sparkles, Key, History, Wand2, TrendingUp,
  Gauge, CheckCircle2, AlertTriangle, ArrowRight, Type,
} from "lucide-react";

export default function AiLinkedinBioOptimizer() {
  const [profile, setProfile] = useState("");
  const [role, setRole] = useState("");
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState<Tone>("leadership");
  const [cta, setCta] = useState<Cta>("lets-connect");
  const [headlines, setHeadlines] = useState<HeadlineVariant[]>([]);
  const [abouts, setAbouts] = useState<AboutVariant[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [activeHeadline, setActiveHeadline] = useState(0);
  const [activeAbout, setActiveAbout] = useState(0);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmRationale, setLlmRationale] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-linkedin-bio-optimizer:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.role) setRole(p.role);
      if (p.industry) setIndustry(p.industry);
      if (p.tone) setTone(p.tone);
      if (p.cta) setCta(p.cta);
      if (p.role || p.industry) toast.info("Loaded from share link");
    }
  }, []);

  const extractedKeywords = useMemo(() => extractKeywords(profile, 12), [profile]);
  const suggestedKeywords = useMemo(
    () => suggestKeywords(role, industry, 10),
    [role, industry],
  );
  const gaps: KeywordGap[] = useMemo(
    () => keywordGap(profile, suggestedKeywords),
    [profile, suggestedKeywords],
  );

  const handleGenerate = useCallback(() => {
    const r = clean(role);
    if (!r) {
      setError("Enter your target role (e.g. 'Senior Product Manager').");
      toast.error("Target role required");
      return;
    }
    if (!clean(industry)) {
      setError("Enter your industry (e.g. 'SaaS').");
      toast.error("Industry required");
      return;
    }
    setError("");
    const hl = generateHeadlines(r, industry, cta, 12);
    const ab = generateAbouts(r, industry, cta, 4);
    setHeadlines(hl);
    setAbouts(ab);
    setActiveHeadline(0);
    setActiveAbout(0);
    saveHistory({
      ts: Date.now(),
      role: r,
      industry,
      tone,
      cta,
      headlineCount: hl.length,
      aboutCount: ab.length,
      topHeadlineScore: hl[0]?.score.overall ?? 0,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${hl.length} headlines + ${ab.length} About sections`);
  }, [role, industry, cta, tone]);

  const profileScore = useMemo(() => {
    if (headlines.length === 0 || abouts.length === 0) return null;
    return scoreProfile(headlines[activeHeadline] ?? headlines[0]!, abouts[activeAbout] ?? abouts[0]!);
  }, [headlines, abouts, activeHeadline, activeAbout]);

  const diff = useMemo(() => {
    if (headlines.length === 0) return null;
    const h = headlines[activeHeadline] ?? headlines[0]!;
    return beforeAfterDiff(profile, h.text);
  }, [headlines, activeHeadline, profile]);

  const shareState: ShareState = { role, industry, tone, cta };

  const handleClear = useCallback(() => {
    setHeadlines([]);
    setAbouts([]);
    setLlmRationale("");
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-linkedin-bio-optimizer:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-linkedin-bio-optimizer:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!clean(role) || !clean(industry)) {
      toast.error("Enter role and industry first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(profile, clean(role), clean(industry), tone, cta);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert LinkedIn profile copywriter." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(rawText);
      if (!parsed.ok) {
        setError(parsed.error);
        setLlmLoading(false);
        return;
      }
      const opt = parsed.optimization;
      const llmHeadline: HeadlineVariant = {
        id: `llm-${Date.now()}`,
        text: opt.headline,
        tone,
        cta,
        charCount: countChars(opt.headline),
        charLimit: HEADLINE_CHAR_LIMIT,
        exceedsLimit: countChars(opt.headline) > HEADLINE_CHAR_LIMIT,
        trimmed: false,
        keywords: opt.keywords,
        score: { overall: 0, keywordDensity: 0, clarity: 0, impact: 0, strengths: [], improvements: [] },
      };
      const llmAbout: AboutVariant = {
        id: `llm-${Date.now()}`,
        text: opt.about,
        tone,
        cta,
        charCount: countChars(opt.about),
        charLimit: ABOUT_CHAR_LIMIT,
        exceedsLimit: countChars(opt.about) > ABOUT_CHAR_LIMIT,
        trimmed: false,
        paragraphs: opt.about.split(/\n\n/),
        keywords: opt.keywords,
        score: { overall: 0, keywordDensity: 0, clarity: 0, impact: 0, strengths: [], improvements: [] },
      };
      setHeadlines((prev) => [llmHeadline, ...prev]);
      setAbouts((prev) => [llmAbout, ...prev]);
      setLlmRationale(opt.rationale);
      toast.success("LLM optimization added");
    } catch (err) {
      setError(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, profile, role, industry, tone, cta]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="li-profile">Paste your current LinkedIn profile or resume</Label>
            <Textarea
              id="li-profile"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder={"Paste your current headline, About, or resume here...\n\nThis is read locally only — nothing is uploaded."}
              className="min-h-[120px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {extractedKeywords.slice(0, 8).map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
              ))}
              {extractedKeywords.length > 0 && (
                <span className="text-[10px] text-muted-foreground self-center ml-1">
                  · {extractedKeywords.length} extracted keywords
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="li-role">Target role</Label>
              <Input id="li-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Product Manager" className="text-sm" />
              <div className="flex flex-wrap gap-1">
                {ROLE_PRESETS.slice(0, 5).map((r) => (
                  <Button key={r} variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setRole(r)}>+ {r}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li-industry">Industry</Label>
              <Input id="li-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" className="text-sm" />
              <div className="flex flex-wrap gap-1">
                {INDUSTRY_PRESETS.slice(0, 5).map((i) => (
                  <Button key={i} variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setIndustry(i)}>+ {i}</Button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Tone</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                <Button
                  key={t}
                  variant={tone === t ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTone(t)}
                >{TONE_LABELS[t]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Call-to-action</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(CTA_LABELS) as Cta[]).map((c) => (
                <Button
                  key={c}
                  variant={cta === c ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCta(c)}
                >{CTA_LABELS[c]}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Optimize my profile" />
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" /> BYO-key LLM
            </Button>
            <ClearButton onClick={handleClear} disabled={headlines.length === 0} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own LLM key
            </h3>
            <p className="text-xs text-muted-foreground">
              Stored only in this browser&apos;s localStorage. Calls go directly from your browser to the provider.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                className="h-9 text-xs rounded border bg-background px-2"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-… / sk-ant-…"
                className="flex-1 min-w-[200px] text-sm font-mono"
              />
              <Button variant="outline" size="sm" onClick={handleSaveLlmKey}>Save key</Button>
            </div>
            <Button size="sm" onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {llmLoading ? "Working…" : "Optimize with LLM"}
            </Button>
            {llmRationale && (
              <p className="text-xs text-muted-foreground italic mt-1">LLM rationale: {llmRationale}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Keyword gap analysis */}
      {(suggestedKeywords.length > 0 && profile) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Keyword gap analysis
            </h3>
            <p className="text-xs text-muted-foreground">
              Target keywords for {clean(role) || "your role"} in {clean(industry) || "your industry"} vs. your current profile.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.map((g) => (
                <Badge
                  key={g.keyword}
                  variant={g.present ? "default" : "outline"}
                  className="text-[10px]"
                  title={g.suggestion}
                >
                  {g.present ? "✓" : "✗"} {g.keyword}
                </Badge>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {gaps.filter((g) => g.present).length}/{gaps.length} present in your profile
            </div>
          </CardContent>
        </Card>
      )}

      {headlines.length > 0 && (
        <>
          {/* Profile score */}
          {profileScore && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Gauge className="h-4 w-4" /> Profile score
                  </h3>
                  <Badge variant={profileScore.overall >= 70 ? "default" : profileScore.overall >= 50 ? "secondary" : "destructive"} className="text-xs">
                    {profileScore.overall}/100
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <ScoreRow label="Headline" score={profileScore.headlineScore} breakdown={profileScore.breakdown.headline} />
                  <ScoreRow label="About" score={profileScore.aboutScore} breakdown={profileScore.breakdown.about} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Headlines */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Optimized headlines ({headlines.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {headlines.map((h, i) => (
                  <Button
                    key={h.id}
                    variant={i === activeHeadline ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setActiveHeadline(i)}
                  >
                    {i + 1} · {h.score.overall}
                  </Button>
                ))}
              </div>
              {headlines[activeHeadline] && (
                <HeadlineCard h={headlines[activeHeadline]} />
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => headlines[activeHeadline]?.text ?? ""} label="Copy headline" />
                <CopyButton getText={() => renderHeadlinesText(headlines)} label="Copy all headlines" />
                <DownloadButton getText={() => renderHeadlinesText(headlines)} filename="linkedin-headlines.txt" label="Download .txt" />
                <ShareButton getUrl={() => buildShareUrl(shareState)} />
              </div>
            </CardContent>
          </Card>

          {/* About sections */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Type className="h-4 w-4" /> Optimized About sections ({abouts.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {abouts.map((a, i) => (
                  <Button
                    key={a.id}
                    variant={i === activeAbout ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setActiveAbout(i)}
                  >
                    {i + 1} · {a.score.overall}
                  </Button>
                ))}
              </div>
              {abouts[activeAbout] && (
                <AboutCard a={abouts[activeAbout]} />
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => abouts[activeAbout]?.text ?? ""} label="Copy About" />
                <CopyButton getText={() => renderAboutsText(abouts)} label="Copy all Abouts" />
                <DownloadButton getText={() => renderAboutsText(abouts)} filename="linkedin-abouts.txt" label="Download .txt" />
                <DownloadButton getText={() => renderMarkdown(headlines, abouts)} filename="linkedin-optimization.md" mime="text/markdown" label="Download .md" />
                <DownloadButton getText={() => renderCsv(headlines, abouts)} filename="linkedin-optimization.csv" mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => renderJson(headlines, abouts)} filename="linkedin-optimization.json" mime="application/json" label="Download JSON" />
              </div>
            </CardContent>
          </Card>

          {/* Before/after diff */}
          {diff && headlines[activeHeadline] && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4" /> Before / after (headline #{activeHeadline + 1})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="rounded border bg-background p-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Before (your profile)</div>
                    <p className="text-muted-foreground line-clamp-3">{diff.before.slice(0, 200) || "(empty)"}</p>
                  </div>
                  <div className="rounded border bg-background p-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">After (optimized)</div>
                    <p className="text-foreground">{headlines[activeHeadline]!.text}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {headlines.length === 0 && (
        <EmptyState
          title="Optimize your LinkedIn headline and About section"
          hint="Paste your profile or resume, enter your target role and industry, pick a tone and CTA, then click Optimize. You'll get 10+ headline variants and several About sections, each scored on keyword density, clarity, and impact."
          icon={<Linkedin className="h-8 w-8" />}
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
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.topHeadlineScore}/100</Badge>
                  <span className="font-mono text-foreground">{h.role}</span>
                  <span className="text-muted-foreground ml-2">· {h.industry}</span>
                  <span className="text-muted-foreground ml-2">· {h.headlineCount} headlines</span>
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
            <strong className="text-foreground">Privacy:</strong> All optimization runs locally. History is stored in localStorage on this device only.
            {" "}
            <strong className="text-foreground">Honesty:</strong> Keep claims truthful — don&apos;t inflate titles or metrics. Keyword optimization aids discovery, not guarantees. We never scrape LinkedIn or store your data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreRow({
  label,
  score,
  breakdown,
}: {
  label: string;
  score: number;
  breakdown: { keywordDensity: number; clarity: number; impact: number; strengths: string[]; improvements: string[] };
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-base font-semibold">{score}/100</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
        <span>KW {breakdown.keywordDensity}/40</span>
        <span>Clarity {breakdown.clarity}/30</span>
        <span>Impact {breakdown.impact}/30</span>
      </div>
      {breakdown.strengths.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {breakdown.strengths.slice(0, 2).map((s, i) => (
            <div key={i} className="flex items-start gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
      {breakdown.improvements.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {breakdown.improvements.slice(0, 2).map((s, i) => (
            <div key={i} className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadlineCard({ h }: { h: HeadlineVariant }) {
  const pct = Math.min(100, (h.charCount / h.charLimit) * 100);
  const color = h.exceedsLimit
    ? "bg-red-500"
    : pct > 85
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <div className="space-y-2">
      <div className="rounded border bg-background p-3">
        <p className="text-sm font-medium text-foreground">{h.text}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] font-mono ${h.exceedsLimit ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
          {h.charCount}/{h.charLimit}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">{TONE_LABELS[h.tone]}</Badge>
        <Badge variant="outline" className="text-[10px]">{CTA_LABELS[h.cta]}</Badge>
        <Badge variant="secondary" className="text-[10px]">score {h.score.overall}/100</Badge>
        {h.trimmed && <Badge variant="outline" className="text-[10px]">trimmed</Badge>}
        {h.exceedsLimit && <Badge variant="destructive" className="text-[10px]">over limit</Badge>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <div>KW density<br /><span className="text-foreground font-mono">{h.score.keywordDensity}/40</span></div>
        <div>Clarity<br /><span className="text-foreground font-mono">{h.score.clarity}/30</span></div>
        <div>Impact<br /><span className="text-foreground font-mono">{h.score.impact}/30</span></div>
      </div>
    </div>
  );
}

function AboutCard({ a }: { a: AboutVariant }) {
  const pct = Math.min(100, (a.charCount / a.charLimit) * 100);
  const color = a.exceedsLimit
    ? "bg-red-500"
    : pct > 85
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <div className="space-y-2">
      <pre className="whitespace-pre-wrap rounded border bg-background p-3 text-sm font-sans">{a.text}</pre>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] font-mono ${a.exceedsLimit ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
          {a.charCount}/{a.charLimit}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">{TONE_LABELS[a.tone]}</Badge>
        <Badge variant="outline" className="text-[10px]">{CTA_LABELS[a.cta]}</Badge>
        <Badge variant="secondary" className="text-[10px]">score {a.score.overall}/100</Badge>
        {a.trimmed && <Badge variant="outline" className="text-[10px]">trimmed</Badge>}
      </div>
    </div>
  );
}
