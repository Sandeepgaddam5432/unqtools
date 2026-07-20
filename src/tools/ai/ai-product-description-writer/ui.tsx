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
  ShoppingBag, History, Key, Sparkles, Wand2, AlertTriangle,
  FileText, ListChecks, Eye,
} from "lucide-react";
import {
  HISTORY_MAX,
  PRODUCT_TYPES,
  TONES,
  LENGTHS,
  FORMATS,
  DEFAULT_INPUT,
  SAMPLE_PRODUCTS,
  HONESTY_NOTES,
  validateProductInput,
  translateAllFeatures,
  generateAll,
  generateVariant,
  computeStats,
  renderMarkdown,
  renderCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  formatLabel,
  type ProductInput,
  type Format,
  type DensityStatus,
} from "./logic";

const DENSITY_COLORS: Record<DensityStatus, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

const DENSITY_BG: Record<DensityStatus, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};

const FORMAT_ICONS: Record<Format, React.ReactNode> = {
  "paragraph": <FileText className="h-3.5 w-3.5" />,
  "amazon-bullets": <ListChecks className="h-3.5 w-3.5" />,
  "shopify": <ShoppingBag className="h-3.5 w-3.5" />,
  "etsy": <Eye className="h-3.5 w-3.5" />,
  "meta": <FileText className="h-3.5 w-3.5" />,
};

export default function AiProductDescriptionWriter() {
  const [input, setInput] = useState<ProductInput>({ ...DEFAULT_INPUT });
  const [featuresText, setFeaturesText] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [history, setHistory] = useState<ReturnType<typeof loadHistory>>([]);
  const [activeFormat, setActiveFormat] = useState<Format>("paragraph");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [overrideText, setOverrideText] = useState<Partial<Record<Format, string>>>({});
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkResults, setBulkResults] = useState<{ text: string; wordCount: number }[] | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-product-description-writer:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      const merged = { ...DEFAULT_INPUT, ...parsed };
      setInput(merged);
      if (merged.features?.length) setFeaturesText(merged.features.join("\n"));
      if (merged.keywords?.length) setKeywordsText(merged.keywords.join(", "));
      if (Object.keys(parsed).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  // Sync features/keywords text with input.
  const features = useMemo(
    () => featuresText.split("\n").map((s) => s.trim()).filter(Boolean),
    [featuresText],
  );
  const keywords = useMemo(
    () => keywordsText.split(",").map((s) => s.trim()).filter(Boolean),
    [keywordsText],
  );

  const mergedInput = useMemo<ProductInput>(
    () => ({ ...input, features, keywords }),
    [input, features, keywords],
  );

  const validationErrors = useMemo(() => validateProductInput(mergedInput), [mergedInput]);
  const isValid = validationErrors.length === 0;

  const benefits = useMemo(
    () => translateAllFeatures(features, input.audience || "customers"),
    [features, input.audience],
  );

  const allDescriptions = useMemo(
    () => isValid ? generateAll(mergedInput) : [],
    [isValid, mergedInput],
  );

  const activeDescription = useMemo(() => {
    if (allDescriptions.length === 0) return null;
    const base = allDescriptions.find((d) => d.format === activeFormat) ?? allDescriptions[0];
    const override = overrideText[base.format];
    return override ? { ...base, text: override, wordCount: override.split(/\s+/).filter(Boolean).length, charCount: override.length } : base;
  }, [allDescriptions, activeFormat, overrideText]);

  const variant = useMemo(
    () => isValid ? generateVariant(mergedInput) : null,
    [isValid, mergedInput],
  );

  const stats = useMemo(
    () => activeDescription ? computeStats(activeDescription, mergedInput) : null,
    [activeDescription, mergedInput],
  );

  const markdown = useMemo(
    () => activeDescription ? renderMarkdown(activeDescription, mergedInput) : "",
    [activeDescription, mergedInput],
  );

  const csv = useMemo(() => renderCsv(allDescriptions), [allDescriptions]);

  const update = useCallback(<K extends keyof ProductInput>(k: K, v: ProductInput[K]) => {
    setInput((prev) => ({ ...prev, [k]: v }));
    setOverrideText({});
  }, []);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    setFeaturesText("");
    setKeywordsText("");
    setOverrideText({});
    setBulkCsv("");
    setBulkResults(null);
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((s: { label: string; input: ProductInput }) => {
    setInput({ ...s.input });
    setFeaturesText(s.input.features.join("\n"));
    setKeywordsText(s.input.keywords.join(", "));
    setOverrideText({});
    toast.info(`Loaded sample: ${s.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!activeDescription || !input.name) return;
    saveHistory({
      ts: Date.now(),
      name: input.name,
      type: input.type,
      format: activeDescription.format,
      wordCount: activeDescription.wordCount,
      preview: activeDescription.text.slice(0, 120),
    });
    setHistory(loadHistory());
  }, [activeDescription, input.name, input.type]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleUseVariant = useCallback(() => {
    if (!variant) return;
    setOverrideText((prev) => ({ ...prev, paragraph: variant.text }));
    setActiveFormat("paragraph");
    toast.success("Variant applied to paragraph");
  }, [variant]);

  const handleEnhanceWithLlm = useCallback(async () => {
    if (!llmKey) {
      setLlmError("Enter an API key first.");
      return;
    }
    if (!isValid) {
      setLlmError("Fix input errors first.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("unqtools:ai-product-description-writer:llm-key", llmKey);
      }
      const prompt = buildLlmPrompt(mergedInput, activeFormat);
      const endpoint = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = llmProvider === "openai"
        ? { "Content-Type": "application/json", "Authorization": `Bearer ${llmKey}` }
        : {
          "Content-Type": "application/json",
          "x-api-key": llmKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
      const body = llmProvider === "openai"
        ? JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an e-commerce copywriter." },
            { role: "user", content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.6,
        })
        : JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 600,
          system: "You are an e-commerce copywriter.",
          messages: [{ role: "user", content: prompt }],
        });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = await res.json();
      const out = llmProvider === "openai"
        ? json.choices?.[0]?.message?.content ?? ""
        : json.content?.[0]?.text ?? "";
      const parsed = renderLlmResult(out);
      setOverrideText((prev) => ({ ...prev, [activeFormat]: parsed.text }));
      if (parsed.warnings.length > 0) {
        toast.warning(`LLM output flagged ${parsed.warnings.length} honesty warning(s)`);
      } else {
        toast.success("LLM enhancement applied");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, isValid, mergedInput, activeFormat]);

  const handleRunBulk = useCallback(() => {
    if (!bulkCsv.trim()) {
      toast.error("Paste CSV first");
      return;
    }
    try {
      // Inline import to avoid circular deps in case logic imports break tree-shake.
      const { processBulkCsv } = require("./logic") as typeof import("./logic");
      const descs = processBulkCsv(bulkCsv);
      setBulkResults(descs.map((d) => ({ text: d.text, wordCount: d.wordCount })));
      toast.success(`Generated ${descs.length} descriptions`);
    } catch {
      toast.error("Bulk CSV failed");
    }
  }, [bulkCsv]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Inputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pdw-name">Product name</Label>
              <Input
                id="pdw-name"
                value={input.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Aurora Stainless Steel Gooseneck Kettle"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdw-brand">Brand</Label>
              <Input
                id="pdw-brand"
                value={input.brand}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="Aurora"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pdw-audience">Target audience</Label>
              <Input
                id="pdw-audience"
                value={input.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="home baristas and pour-over coffee enthusiasts"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdw-price">Price (optional)</Label>
              <Input
                id="pdw-price"
                value={input.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="$79"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdw-features">Features (one per line)</Label>
            <Textarea
              id="pdw-features"
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={"1.0L stainless steel body\nPrecision gooseneck spout\nErgonomic stay-cool handle\n1-year warranty"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdw-kw">SEO keywords (comma-separated)</Label>
            <Input
              id="pdw-kw"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="pour over kettle, gooseneck kettle, stainless steel kettle"
              className="font-mono text-xs"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Product type</Label>
              <select
                value={input.type}
                onChange={(e) => update("type", e.target.value as ProductInput["type"])}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {PRODUCT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tone</Label>
              <select
                value={input.tone}
                onChange={(e) => update("tone", e.target.value as ProductInput["tone"])}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Length</Label>
              <select
                value={input.length}
                onChange={(e) => update("length", e.target.value as ProductInput["length"])}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {LENGTHS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdw-cta" className="text-[11px]">Call to action (optional)</Label>
              <Input
                id="pdw-cta"
                value={input.callToAction}
                onChange={(e) => update("callToAction", e.target.value)}
                placeholder="Brew better today — add to cart."
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SAMPLE_PRODUCTS.map((s) => (
              <Button key={s.label} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleSample(s)}>
                + {s.label}
              </Button>
            ))}
          </div>
          {validationErrors.length > 0 && (
            <ErrorBanner message={validationErrors.join(" ")} />
          )}
        </CardContent>
      </Card>

      {/* Feature → Benefit */}
      {benefits.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Feature → Benefit translator ({benefits.length})
            </h3>
            <div className="space-y-1 max-h-[260px] overflow-auto">
              {benefits.map((b, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="font-mono text-muted-foreground text-[10px]">FEATURE</div>
                  <div className="text-foreground">{b.feature}</div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px] mt-1">BENEFIT</div>
                  <div className="text-foreground">{b.benefit}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Format tabs + output */}
      {isValid && activeDescription ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> {formatLabel(activeDescription.format)}
              </h3>
              <div className="flex flex-wrap gap-1">
                {FORMATS.map((f) => (
                  <Button
                    key={f.value}
                    size="sm"
                    variant={activeFormat === f.value ? "default" : "outline"}
                    className="h-7 text-[11px] gap-1"
                    onClick={() => setActiveFormat(f.value)}
                  >
                    {FORMAT_ICONS[f.value]} {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <pre className="rounded border bg-muted/40 p-3 overflow-auto max-h-[400px] text-[12px] whitespace-pre-wrap font-sans leading-relaxed">
{activeDescription.text}
            </pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return activeDescription.text; }} label="Copy text" />
              <DownloadButton
                getText={() => { handleSaveHistory(); return activeDescription.text; }}
                filename={`product-description-${activeDescription.format}.txt`}
                mime="text/plain"
                label="Download .txt"
              />
              <DownloadButton
                getText={() => markdown}
                filename="product-description.md"
                mime="text/markdown"
                label="Download .md"
              />
              <DownloadButton
                getText={() => csv}
                filename="product-descriptions.csv"
                mime="text/csv"
                label="Download CSV (all 5)"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(mergedInput); }} />
              <ClearButton onClick={handleClear} />
            </div>
            {variant && activeFormat === "paragraph" && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">A/B variant</span>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={handleUseVariant}>
                    Use this variant
                  </Button>
                </div>
                <pre className="rounded border bg-muted/20 p-2 text-[11px] whitespace-pre-wrap font-sans">
{variant.text}
                </pre>
              </div>
            )}
            <div className="pt-2 border-t">
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setShowLlm((v) => !v)}>
                <Key className="h-3 w-3 mr-1" /> {showLlm ? "Hide" : "BYO key LLM"} — enhance {formatLabel(activeDescription.format)}
              </Button>
              {showLlm && (
                <div className="space-y-2 pt-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                      className="h-9 text-xs rounded border bg-background px-2"
                    >
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                      <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                    </select>
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder="Paste API key (stored locally)"
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={handleEnhanceWithLlm} disabled={llmLoading || !llmKey}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> {llmLoading ? "Working…" : "Enhance with LLM"}
                  </Button>
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Fill in the product form to generate descriptions"
          hint="Enter a name, at least one feature, and a target audience. The translator converts each feature into a buyer-facing benefit, and we output five format-correct variants."
          icon={<ShoppingBag className="h-8 w-8" />}
        />
      )}

      {/* Stats */}
      {stats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Stats & SEO
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Words" value={stats.totalWords} />
              <Stat label="Characters" value={stats.totalChars} />
              <Stat label="Sentences" value={stats.sentenceCount} />
              <Stat label="Avg words/sentence" value={stats.avgWordsPerSentence} />
              <Stat label="Reading time" value={`${stats.readingTimeSeconds}s`} />
              <Stat label="Benefits" value={stats.benefitCount} />
              <Stat label="Has CTA" value={stats.hasCallToAction ? "yes" : "no"} />
              <Stat label="Warnings" value={stats.honestyWarnings.length} highlight={stats.honestyWarnings.length > 0 ? "bad" : undefined} />
            </div>
            {stats.keywordDensities.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Keyword density</div>
                {stats.keywordDensities.map((kd) => {
                  const pct = Math.min(100, Math.round((kd.density / 5) * 100));
                  return (
                    <div key={kd.keyword} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono">{kd.keyword}</span>
                        <span className={`font-mono ${DENSITY_COLORS[kd.status]}`}>
                          {kd.count}× · {kd.density}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${DENSITY_BG[kd.status]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {stats.honestyWarnings.length > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Honesty warnings — verify before publishing
                </div>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                  {stats.honestyWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk CSV */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" /> Bulk CSV mode
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Header: <code className="font-mono">name,type,features,audience,tone,length,keywords</code>. Separate features with <code className="font-mono">|</code>, keywords with <code className="font-mono">,</code>.
          </p>
          <Textarea
            value={bulkCsv}
            onChange={(e) => setBulkCsv(e.target.value)}
            placeholder={"name,type,features,audience,tone,length,keywords\nTest Kettle,physical,stainless steel body|precision spout,home baristas,professional,short,pour over kettle"}
            className="min-h-[80px] resize-y font-mono text-xs"
          />
          <Button size="sm" onClick={handleRunBulk} disabled={!bulkCsv.trim()}>
            Generate descriptions
          </Button>
          {bulkResults && bulkResults.length > 0 && (
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {bulkResults.map((r, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px] mr-2">{r.wordCount}w</Badge>
                  <span className="text-foreground">{r.text.slice(0, 200)}{r.text.length > 200 ? "…" : ""}</span>
                </div>
              ))}
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
                <History className="h-4 w-4" /> Recent ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  className="w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted/40"
                  onClick={() => {
                    setInput((prev) => ({ ...prev, name: h.name, type: h.type }));
                    toast.info(`Restored: ${h.name}`);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatLabel(h.format)}</Badge>
                    <span className="font-mono text-muted-foreground truncate">{h.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{h.wordCount}w</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{h.preview}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Honesty notes */}
      <Card>
        <CardContent className="p-3 space-y-1">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Honesty notes
          </h4>
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
            {HONESTY_NOTES.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
