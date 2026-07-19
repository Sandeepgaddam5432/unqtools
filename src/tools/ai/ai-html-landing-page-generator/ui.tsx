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
  HISTORY_KEY,
  HISTORY_MAX,
  TEMPLATE_LABELS,
  TEMPLATE_DESCRIPTIONS,
  DEFAULT_THEME,
  FONT_PRESETS,
  SAMPLE_PROMPTS,
  normalizeLine,
  normalizeText,
  parseFeatures,
  parseTestimonials,
  parsePricing,
  parseFaqs,
  parseSchedule,
  parseProjects,
  matchTemplate,
  extractBusinessName,
  extractTagline,
  buildPage,
  buildPreviewSrcDoc,
  toReactComponent,
  renderPlainText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type TemplateId,
  type Theme,
  type LandingInputs,
  type GeneratedPage,
  type HistoryEntry,
} from "./logic";
import {
  LayoutTemplate, Eye, Code2, FileCode, History, Key, Sparkles,
  AlertCircle, Smartphone, Monitor,
} from "lucide-react";

export default function AiHtmlLandingPageGenerator() {
  // Template + prompt
  const [template, setTemplate] = useState<TemplateId>("saas");
  const [prompt, setPrompt] = useState("");

  // Basic inputs
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [cta, setCta] = useState("Get Started");
  const [ctaSecondary, setCtaSecondary] = useState("Learn more");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");

  // Section content (multi-line text inputs)
  const [featuresText, setFeaturesText] = useState("");
  const [testimonialsText, setTestimonialsText] = useState("");
  const [pricingText, setPricingText] = useState("");
  const [faqsText, setFaqsText] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [projectsText, setProjectsText] = useState("");

  // Social
  const [twitter, setTwitter] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");

  // Section toggles
  const [sections, setSections] = useState({
    features: true,
    testimonials: true,
    pricing: true,
    faq: true,
    schedule: false,
    projects: false,
  });

  // Theme
  const [theme, setTheme] = useState<Theme>({ ...DEFAULT_THEME });

  // Output
  const [page, setPage] = useState<GeneratedPage | null>(null);
  const [tab, setTab] = useState<"preview" | "html" | "react" | "text">("preview");
  const [previewWidth, setPreviewWidth] = useState<"responsive" | "mobile">("responsive");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");

  // Optional LLM
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-html-landing:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.template) setTemplate(p.template);
      if (p.businessName !== undefined) setBusinessName(p.businessName);
      if (p.tagline !== undefined) setTagline(p.tagline);
      if (p.description !== undefined) setDescription(p.description);
      if (p.cta !== undefined) setCta(p.cta);
      if (p.ctaSecondary !== undefined) setCtaSecondary(p.ctaSecondary ?? "");
      if (p.url !== undefined) setUrl(p.url ?? "");
      if (p.email !== undefined) setEmail(p.email ?? "");
      if (p.theme) setTheme(p.theme);
      if (p.businessName || p.template || p.tagline) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const matchPreview = useMemo(() => {
    if (!prompt.trim()) return null;
    return matchTemplate(prompt);
  }, [prompt]);

  const inputs: LandingInputs = useMemo(() => ({
    template,
    businessName: normalizeLine(businessName),
    tagline: normalizeLine(tagline),
    description: normalizeLine(description),
    cta: normalizeLine(cta),
    ctaSecondary: normalizeLine(ctaSecondary) || undefined,
    url: normalizeLine(url) || undefined,
    features: parseFeatures(featuresText),
    testimonials: parseTestimonials(testimonialsText),
    pricing: parsePricing(pricingText),
    faqs: parseFaqs(faqsText),
    schedule: parseSchedule(scheduleText),
    projects: parseProjects(projectsText),
    email: normalizeLine(email) || undefined,
    social: {
      twitter: normalizeLine(twitter) || undefined,
      github: normalizeLine(github) || undefined,
      linkedin: normalizeLine(linkedin) || undefined,
    },
    sections,
    theme,
  }), [
    template, businessName, tagline, description, cta, ctaSecondary, url, email,
    featuresText, testimonialsText, pricingText, faqsText, scheduleText, projectsText,
    twitter, github, linkedin, sections, theme,
  ]);

  const reactCode = useMemo(() => page ? toReactComponent(page) : "", [page]);
  const plainText = useMemo(() => page ? renderPlainText(page) : "", [page]);
  const previewDoc = useMemo(() => page ? buildPreviewSrcDoc(page) : "", [page]);

  const handleGenerate = useCallback(() => {
    setError("");
    if (!businessName.trim() && !tagline.trim() && !prompt.trim()) {
      setError("Enter a prompt or at least a business name + tagline.");
      return;
    }
    const p = buildPage(inputs);
    setPage(p);
    setTab("preview");
    saveHistory({
      ts: Date.now(),
      template,
      businessName: inputs.businessName || "(untitled)",
      sectionCount: p.sectionCount,
      bytes: p.bytes,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${TEMPLATE_LABELS[template]} page (${(p.bytes / 1024).toFixed(1)} KB)`);
  }, [businessName, tagline, prompt, inputs, template]);

  const handlePromptFill = useCallback(() => {
    if (!prompt.trim()) return;
    const m = matchTemplate(prompt);
    setTemplate(m.template);
    const name = extractBusinessName(prompt);
    const tag = extractTagline(prompt);
    if (name) setBusinessName(name);
    if (tag) setTagline(tag);
    if (tag && !description) setDescription(tag);
    if (m.confidence > 0) {
      toast.info(`Matched ${TEMPLATE_LABELS[m.template]} template (${m.confidence}% confidence)`);
    } else {
      toast.info("Filled business name + tagline from prompt");
    }
  }, [prompt, description]);

  const handleSamplePrompt = useCallback((s: string) => {
    setPrompt(s);
    const m = matchTemplate(s);
    setTemplate(m.template);
    setBusinessName(extractBusinessName(s));
    setTagline(extractTagline(s));
    setDescription(extractTagline(s));
    toast.info(`Loaded sample — ${TEMPLATE_LABELS[m.template]} template`);
  }, []);

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleThemeChange = (patch: Partial<Theme>) => {
    setTheme((prev) => ({ ...prev, ...patch }));
  };

  const handleClear = useCallback(() => {
    setPrompt("");
    setBusinessName("");
    setTagline("");
    setDescription("");
    setCta("Get Started");
    setCtaSecondary("Learn more");
    setUrl("");
    setEmail("");
    setFeaturesText("");
    setTestimonialsText("");
    setPricingText("");
    setFaqsText("");
    setScheduleText("");
    setProjectsText("");
    setTwitter("");
    setGithub("");
    setLinkedin("");
    setSections({ features: true, testimonials: true, pricing: true, faq: true, schedule: false, projects: false });
    setTheme({ ...DEFAULT_THEME });
    setPage(null);
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
      if (llmKey) localStorage.setItem("unqtools:ai-html-landing:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-html-landing:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!businessName.trim() && !prompt.trim()) {
      toast.error("Enter a business name or prompt first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      const llmPrompt = buildLlmPrompt(inputs);
      const apiUrl = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: llmPrompt.system },
            { role: "user", content: llmPrompt.user },
          ],
          temperature: 0.4,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 8192,
          messages: [{ role: "user", content: `${llmPrompt.system}\n\n${llmPrompt.user}` }],
        };
      }
      const res = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setLlmError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const html = renderLlmResult(rawText);
      if (!html || !html.includes("<html")) {
        setLlmError("LLM did not return a valid HTML document");
        toast.error("LLM response was not valid HTML");
        setLlmLoading(false);
        return;
      }
      const llmPage: GeneratedPage = {
        ...page!,
        id: `llm-${Date.now()}`,
        html,
        bytes: html.length,
        hasSeoMeta: /<title>/.test(html) && /<meta name="description"/.test(html),
        hasOpenGraph: /property="og:title"/.test(html),
        hasTwitterCard: /name="twitter:card"/.test(html),
        hasJsonLd: /application\/ld\+json/.test(html),
        hasDarkMode: /prefers-color-scheme: dark/.test(html) || /data-theme="dark"/.test(html),
        warnings: ["LLM-generated — review before publishing."],
      };
      setPage(llmPage);
      setTab("html");
      toast.success("LLM-generated page loaded");
    } catch (e) {
      setLlmError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, businessName, prompt, inputs, page]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Prompt + template */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lp-prompt">Describe your business / product (optional)</Label>
            <Textarea
              id="lp-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={"e.g., TaskFlow — project management SaaS for small teams"}
              className="min-h-[60px] resize-y text-sm"
            />
            {matchPreview && matchPreview.confidence > 0 && (
              <div className="text-xs text-muted-foreground">
                Detected: <Badge variant="outline" className="text-[10px] ml-1">{TEMPLATE_LABELS[matchPreview.template]}</Badge>
                <span className="ml-2">confidence {matchPreview.confidence}%</span>
                {matchPreview.matched.length > 0 && (
                  <span className="ml-2">matched: {matchPreview.matched.join(", ")}</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {SAMPLE_PROMPTS.map((s) => (
                <Button
                  key={s}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleSamplePrompt(s)}
                >+ {s.split("—")[0].trim()}</Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePromptFill}
              disabled={!prompt.trim()}
              className="mt-1"
            >
              Fill fields from prompt
            </Button>
          </div>

          <div>
            <Label className="text-xs">Template</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
              {(Object.keys(TEMPLATE_LABELS) as TemplateId[]).map((t) => (
                <Button
                  key={t}
                  variant={template === t ? "default" : "outline"}
                  size="sm"
                  className="h-auto py-2 flex flex-col items-center gap-0.5"
                  onClick={() => setTemplate(t)}
                >
                  <span className="text-xs font-semibold">{TEMPLATE_LABELS[t]}</span>
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{TEMPLATE_DESCRIPTIONS[template]}</p>
          </div>
        </CardContent>
      </Card>

      {/* Basic inputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <LayoutTemplate className="h-4 w-4" /> Content
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs" htmlFor="lp-bn">Business name</Label>
              <Input id="lp-bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Inc." className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="lp-tg">Tagline</Label>
              <Input id="lp-tg" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Build anything, faster" className="h-9 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs" htmlFor="lp-d">Description (hero subtitle + meta description)</Label>
              <Textarea id="lp-d" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The all-in-one platform for modern teams." className="min-h-[50px] text-sm" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="lp-c">Primary CTA</Label>
              <Input id="lp-c" value={cta} onChange={(e) => setCta(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="lp-cs">Secondary CTA (optional)</Label>
              <Input id="lp-cs" value={ctaSecondary} onChange={(e) => setCtaSecondary(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="lp-u">Canonical URL (optional)</Label>
              <Input id="lp-u" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://acme.example.com" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="lp-e">Contact email (optional)</Label>
              <Input id="lp-e" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@acme.example.com" className="h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Sections</h3>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {(Object.keys(sections) as (keyof typeof sections)[]).map((k) => (
                <label key={k} className="flex items-center gap-1 cursor-pointer capitalize">
                  <input
                    type="checkbox"
                    checked={sections[k]}
                    onChange={() => toggleSection(k)}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>

          {sections.features && (
            <div>
              <Label className="text-xs">Features (one per line: <code>Title: Description</code>)</Label>
              <Textarea
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder={"Fast: Blazing fast performance\nSecure: End-to-end encryption\nEasy: No code required"}
                className="min-h-[80px] text-xs font-mono mt-1"
              />
            </div>
          )}
          {sections.testimonials && (
            <div>
              <Label className="text-xs">Testimonials (one per line: <code>Quote | Author | Role</code>)</Label>
              <Textarea
                value={testimonialsText}
                onChange={(e) => setTestimonialsText(e.target.value)}
                placeholder={"Love it! | Jane Doe | CEO of ExampleCo\nGame-changer | John Smith | CTO of DevCo"}
                className="min-h-[60px] text-xs font-mono mt-1"
              />
            </div>
          )}
          {sections.pricing && (
            <div>
              <Label className="text-xs">Pricing (one per line: <code>Name | Price | Period | feat1; feat2 | CTA</code>)</Label>
              <Textarea
                value={pricingText}
                onChange={(e) => setPricingText(e.target.value)}
                placeholder={"Starter | $0 | mo | 1 user; 5 projects | Start free\nPro | $29 | mo | 10 users; Unlimited | Choose Pro"}
                className="min-h-[60px] text-xs font-mono mt-1"
              />
            </div>
          )}
          {sections.faq && (
            <div>
              <Label className="text-xs">FAQs (one per line: <code>Question | Answer</code>)</Label>
              <Textarea
                value={faqsText}
                onChange={(e) => setFaqsText(e.target.value)}
                placeholder={"Is there a free plan? | Yes, the Starter plan is free forever.\nCan I cancel anytime? | Yes, from your account settings."}
                className="min-h-[60px] text-xs font-mono mt-1"
              />
            </div>
          )}
          {sections.schedule && (
            <div>
              <Label className="text-xs">Schedule (one per line: <code>Time | Title | Speaker</code>)</Label>
              <Textarea
                value={scheduleText}
                onChange={(e) => setScheduleText(e.target.value)}
                placeholder={"9:00 | Welcome | Jane Doe\n10:00 | Keynote | John Smith"}
                className="min-h-[60px] text-xs font-mono mt-1"
              />
            </div>
          )}
          {sections.projects && (
            <div>
              <Label className="text-xs">Projects (one per line: <code>Title | Description | tags | URL</code>)</Label>
              <Textarea
                value={projectsText}
                onChange={(e) => setProjectsText(e.target.value)}
                placeholder={"Acme Site | Marketing site | React, Tailwind | https://acme.com\nMobile App | Fitness app | React Native | https://app.acme.com"}
                className="min-h-[60px] text-xs font-mono mt-1"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Theme</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Primary</Label>
              <input
                type="color"
                value={theme.primary}
                onChange={(e) => handleThemeChange({ primary: e.target.value })}
                className="block w-full h-9 rounded border bg-background cursor-pointer"
              />
            </div>
            <div>
              <Label className="text-xs">Accent</Label>
              <input
                type="color"
                value={theme.accent}
                onChange={(e) => handleThemeChange({ accent: e.target.value })}
                className="block w-full h-9 rounded border bg-background cursor-pointer"
              />
            </div>
            <div>
              <Label className="text-xs">Radius ({theme.radius}px)</Label>
              <input
                type="range"
                min={0}
                max={32}
                value={theme.radius}
                onChange={(e) => handleThemeChange({ radius: Number.parseInt(e.target.value, 10) })}
                className="block w-full"
              />
            </div>
            <div>
              <Label className="text-xs">Font</Label>
              <select
                value={theme.font}
                onChange={(e) => handleThemeChange({ font: e.target.value })}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {FONT_PRESETS.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={theme.darkMode}
              onChange={(e) => handleThemeChange({ darkMode: e.target.checked })}
            />
            Include dark-mode CSS + toggle button
          </label>
        </CardContent>
      </Card>

      {/* Action bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate page" />
            <ShareButton getUrl={() => buildShareUrl({ inputs })} disabled={!page} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      {page && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileCode className="h-4 w-4" /> {TEMPLATE_LABELS[page.template]} — {(page.bytes / 1024).toFixed(1)} KB · {page.sectionCount} sections
              </h3>
              <div className="flex gap-1">
                <Button variant={tab === "preview" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setTab("preview")}>
                  <Eye className="h-3 w-3" /> Preview
                </Button>
                <Button variant={tab === "html" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setTab("html")}>
                  <Code2 className="h-3 w-3" /> HTML
                </Button>
                <Button variant={tab === "react" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setTab("react")}>
                  <Code2 className="h-3 w-3" /> React
                </Button>
                <Button variant={tab === "text" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setTab("text")}>
                  <FileCode className="h-3 w-3" /> Text
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <Badge variant={page.hasSeoMeta ? "secondary" : "outline"}>SEO meta</Badge>
              <Badge variant={page.hasOpenGraph ? "secondary" : "outline"}>Open Graph</Badge>
              <Badge variant={page.hasTwitterCard ? "secondary" : "outline"}>Twitter Card</Badge>
              <Badge variant={page.hasJsonLd ? "secondary" : "outline"}>JSON-LD</Badge>
              <Badge variant={page.hasDarkMode ? "secondary" : "outline"}>Dark mode</Badge>
              <Badge variant={page.a11y.hasSemanticLandmarks ? "secondary" : "outline"}>Semantic HTML</Badge>
              <Badge variant={page.a11y.hasSkipLink ? "secondary" : "outline"}>Skip link</Badge>
              <Badge variant={page.a11y.hasLang ? "secondary" : "outline"}>Lang attr</Badge>
            </div>

            {page.warnings.length > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                {page.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
            {page.a11y.issues.length > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                {page.a11y.issues.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            {tab === "preview" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={previewWidth === "responsive" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPreviewWidth("responsive")}
                  >
                    <Monitor className="h-3 w-3" /> Desktop
                  </Button>
                  <Button
                    variant={previewWidth === "mobile" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPreviewWidth("mobile")}
                  >
                    <Smartphone className="h-3 w-3" /> Mobile
                  </Button>
                </div>
                <iframe
                  title="Landing page preview"
                  srcDoc={previewDoc}
                  sandbox="allow-same-origin"
                  className={`w-full h-[600px] rounded border bg-white ${previewWidth === "mobile" ? "max-w-[400px] mx-auto" : ""}`}
                />
              </div>
            )}
            {tab === "html" && (
              <pre className="rounded border bg-background p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[600px] overflow-auto">
                {page.html}
              </pre>
            )}
            {tab === "react" && (
              <pre className="rounded border bg-background p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[600px] overflow-auto">
                {reactCode}
              </pre>
            )}
            {tab === "text" && (
              <pre className="rounded border bg-background p-3 text-xs whitespace-pre-wrap max-h-[600px] overflow-auto">
                {plainText}
              </pre>
            )}

            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => page.html} label="Copy HTML" />
              <DownloadButton
                getText={() => page.html}
                filename={`${(businessName || "landing").toLowerCase().replace(/\s+/g, "-")}.html`}
                mime="text/html"
                label="Download .html"
              />
              <CopyButton getText={() => reactCode} label="Copy React" />
              <CopyButton getText={() => plainText} label="Copy text" />
            </div>
          </CardContent>
        </Card>
      )}

      {!page && (
        <EmptyState
          title="Fill in your business details and click Generate"
          hint="Or click a sample prompt above to auto-fill. Five templates available: SaaS, App, Product, Event, Portfolio."
          icon={<LayoutTemplate className="h-8 w-8" />}
        />
      )}

      {/* Optional LLM */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Optional: enhance with LLM (BYO key)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowLlm((s) => !s)}>
              {showLlm ? "Hide" : "Show"}
            </Button>
          </div>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Optional: bring your own OpenAI or Anthropic API key for a more polished, context-aware landing page. The key is stored only in this browser&apos;s localStorage and the request goes directly from your browser to the provider. Always review LLM-generated code before publishing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Provider</Label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">API key (stored locally)</Label>
                  <Input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveLlmKey}>
                  <Key className="h-3.5 w-3.5" /> Save key locally
                </Button>
                <Button
                  size="sm"
                  onClick={handleLlmEnhance}
                  disabled={llmLoading || !llmKey || !page}
                  className="gap-1.5"
                >
                  {llmLoading ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {llmLoading ? "Working…" : "Enhance with LLM"}
                </Button>
              </div>
              {llmError && <ErrorBanner message={llmError} />}
            </div>
          )}
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className="mr-2">{TEMPLATE_LABELS[h.template]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.sectionCount} sections</Badge>
                  <span className="text-muted-foreground">{h.businessName}</span>
                  <span className="text-muted-foreground ml-2">· {(h.bytes / 1024).toFixed(1)} KB · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All template matching and HTML/CSS generation runs locally. Inputs and history are stored only in this browser. The only network call is if you paste your own LLM API key — that goes directly from your browser to the provider you choose.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Suppress unused-import lint for symbols kept for context
export type _Unused = typeof HISTORY_KEY | typeof HISTORY_MAX | HistoryEntry;
