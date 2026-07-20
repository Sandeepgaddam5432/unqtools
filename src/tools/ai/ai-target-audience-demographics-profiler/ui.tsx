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
  CATEGORY_TEMPLATES,
  CATEGORY_LABELS,
  TONE_LABELS,
  PRODUCT_PRESETS,
  profileAudience,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  type Category,
  type Tone,
  type ProfileResult,
  type HistoryEntry,
} from "./logic";
import { Users, Sparkles, History, Key, ShieldCheck } from "lucide-react";

export default function AITargetAudienceDemographicsProfiler() {
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState<Category>("generic");
  const [tone, setTone] = useState<Tone>("formal");
  const [segmentCount, setSegmentCount] = useState<1 | 2 | 3>(1);
  const [seed, setSeed] = useState(42);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.product) setProduct(p.product);
      setCategory(p.category);
      setTone(p.tone);
      setSegmentCount(p.segmentCount);
      if (p.product) toast.info("Loaded from share link");
    }
  }, []);

  const md = useMemo(() => (result ? renderMarkdown(result) : ""), [result]);
  const json = useMemo(() => (result ? renderJson(result) : ""), [result]);

  const handleProfile = useCallback(() => {
    if (!product.trim()) {
      toast.error("Please describe your product first");
      return;
    }
    const r = profileAudience({ product: product.trim(), category, tone, segmentCount, seed });
    setResult(r);
    saveHistory({
      ts: Date.now(),
      product: product.trim(),
      category,
      segmentCount,
      topScore: Math.max(...r.segments.map((s) => s.icpScore)),
    });
    setHistory(loadHistory());
    toast.success(`Generated ${segmentCount} segment${segmentCount > 1 ? "s" : ""}`);
  }, [product, category, tone, segmentCount, seed]);

  const handleClear = useCallback(() => {
    setProduct("");
    setCategory("generic");
    setTone("formal");
    setSegmentCount(1);
    setResult(null);
    toast.info("Cleared");
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
          <div className="space-y-1.5">
            <Label htmlFor="product">Product description</Label>
            <Textarea
              id="product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Describe your product in 1-3 sentences. E.g. 'A meditation app for busy professionals.'"
              className="min-h-[80px] resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PRODUCT_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => { setProduct(p.product); setCategory(p.category); }}
              >+ {p.label}</Button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Segments</Label>
              <select
                value={segmentCount}
                onChange={(e) => setSegmentCount(Number(e.target.value) as 1 | 2 | 3)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                <option value={1}>1 (Primary)</option>
                <option value={2}>2 (Primary + Secondary)</option>
                <option value={3}>3 (Primary + Secondary + Tertiary)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Seed (for reproducibility)</Label>
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
                className="h-9 w-32 text-sm"
              />
            </div>
            <Button onClick={handleProfile} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Generate profile
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>
              Random seed
            </Button>
            <ShareButton getUrl={() => buildShareUrl(product, category, tone, segmentCount)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {result.segments.length} segment{result.segments.length > 1 ? "s" : ""} generated
                </h3>
                <div className="flex gap-2">
                  <CopyButton getText={() => md} label="Copy MD" />
                  <DownloadButton getText={() => md} filename="audience-profile.md" mime="text/markdown" label="Download .md" />
                  <DownloadButton getText={() => json} filename="audience-profile.json" mime="application/json" label="Download JSON" />
                </div>
              </div>
              <div className="rounded border bg-amber-500/10 border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                <strong>⚠️ Honesty note:</strong> {result.honestyNote}
              </div>
            </CardContent>
          </Card>

          {result.segments.map((seg) => (
            <Card key={seg.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{seg.label} Segment</h3>
                  <Badge variant="secondary">ICP score: {seg.icpScore}/100</Badge>
                </div>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-medium text-foreground">{seg.persona.name}, {seg.persona.role}</div>
                  <div className="text-muted-foreground">Age {seg.persona.age} · {seg.persona.gender} · {seg.persona.location}</div>
                  <div className="text-muted-foreground">Income: {seg.persona.income}</div>
                  <div className="mt-1 italic text-foreground">"{seg.persona.quote}"</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground mb-1">Day in the life</div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {seg.persona.dayInTheLife.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-medium text-foreground mb-1">Goals</div>
                    <ul className="text-muted-foreground space-y-0.5">{seg.goals.map((g, i) => <li key={i}>• {g}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">Pains</div>
                    <ul className="text-muted-foreground space-y-0.5">{seg.pains.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">Channels</div>
                    <div className="text-muted-foreground">{seg.channels.join(", ")}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">Buying triggers</div>
                    <ul className="text-muted-foreground space-y-0.5">{seg.buyingTriggers.map((t, i) => <li key={i}>• {t}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">Objections</div>
                    <ul className="text-muted-foreground space-y-0.5">{seg.objections.map((o, i) => <li key={i}>• {o}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">Messaging angles</div>
                    <ul className="text-muted-foreground space-y-0.5">{seg.messagingAngles.map((m, i) => <li key={i}>• {m}</li>)}</ul>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 text-[10px]">
                  {(["fit", "urgency", "budget", "accessibility", "expansion"] as const).map((k) => (
                    <div key={k} className="rounded border bg-background px-2 py-1 text-center">
                      <div className="uppercase tracking-wide text-muted-foreground">{k.slice(0, 4)}</div>
                      <div className="font-semibold text-foreground">{seg.icpBreakdown[k]}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Ideal Customer Profile (ICP)
              </h3>
              <p className="text-xs text-muted-foreground">{result.icp.rationale}</p>
              <div className="text-xs font-medium text-foreground">ICP checklist:</div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {result.icp.checklist.map((c, i) => <li key={i}>☐ {c}</li>)}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Describe your product to generate an audience profile"
          hint="Pick a category, set tone and segment count, then click Generate. The tool produces ICP + persona cards with demographics, psychographics, goals, pains, channels, objections, and buying triggers."
          icon={<Users className="h-8 w-8" />}
        />
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.topScore}/100</Badge>
                  <Badge variant="outline" className="mr-2">{CATEGORY_LABELS[h.category]}</Badge>
                  <span className="text-foreground font-medium">{h.product}</span>
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
            <strong className="text-foreground">Privacy:</strong> All profiling runs locally. The only network call is if you paste your own LLM API key — that request goes directly from your browser to the LLM provider. History stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
