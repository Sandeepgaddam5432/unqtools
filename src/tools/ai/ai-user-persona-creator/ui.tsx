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
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  AUDIENCE_PRESETS,
  SAMPLE_INPUT,
  buildMultiplePersonas,
  renderPersonaMarkdown,
  renderPersonasMarkdown,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ProductType,
  type PersonaInput,
  type Persona,
  type HistoryEntry,
} from "./logic";
import {
  Users,
  History,
  Sparkles,
  Quote,
  Sun,
  Heart,
  Briefcase,
  Target,
  AlertTriangle,
  Eye,
  Lightbulb,
} from "lucide-react";

export default function AiUserPersonaCreator() {
  const [productType, setProductType] = useState<ProductType>("b2b-saas");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(3);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const { input } = parseShareUrl(window.location.hash);
      if (Object.keys(input).length > 0) {
        if (input.productType) setProductType(input.productType);
        if (input.productName !== undefined) setProductName(input.productName || "");
        if (input.productDescription !== undefined) setProductDescription(input.productDescription || "");
        if (input.audience !== undefined) setAudience(input.audience || "");
        if (input.count !== undefined) setCount(input.count);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const input: PersonaInput = useMemo(
    () => ({ productType, productName, productDescription, audience, count }),
    [productType, productName, productDescription, audience, count],
  );

  const personas = useMemo(() => buildMultiplePersonas(input), [input]);
  const stats = useMemo(() => computeStats(personas), [personas]);
  const combinedMd = useMemo(() => renderPersonasMarkdown(personas, input), [personas, input]);

  const handleGenerate = useCallback(() => {
    if (!productName.trim() && !productDescription.trim()) {
      toast.error("Add at least a product name or description");
      return;
    }
    if (personas.length > 0) {
      saveHistory({
        ts: Date.now(),
        productType,
        productName,
        count: personas.length,
        personaNames: personas.map((p) => p.fullName),
      });
      setHistory(loadHistory());
    }
    toast.success(`Generated ${personas.length} persona${personas.length === 1 ? "" : "s"}`);
  }, [productName, productDescription, personas, productType]);

  const handleLoadSample = useCallback(() => {
    setProductType(SAMPLE_INPUT.productType);
    setProductName(SAMPLE_INPUT.productName);
    setProductDescription(SAMPLE_INPUT.productDescription);
    setAudience(SAMPLE_INPUT.audience);
    setCount(SAMPLE_INPUT.count);
    toast.success("Loaded sample input");
  }, []);

  const handleClear = useCallback(() => {
    setProductName("");
    setProductDescription("");
    setAudience("");
    setCount(3);
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Product & audience
            </h3>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
              <Sparkles className="h-3 w-3 mr-1" /> Load sample
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="upc-pt">Product type</Label>
            <select
              id="upc-pt"
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
              className="w-full h-9 text-xs rounded border bg-background px-2"
            >
              {PRODUCT_TYPES.map((p) => (
                <option key={p} value={p}>{PRODUCT_TYPE_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="upc-pn">Product name</Label>
            <Input
              id="upc-pn"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., FlowDesk"
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="upc-pd">Product description</Label>
            <Textarea
              id="upc-pd"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="One paragraph: what does the product do, for whom, and why it's different?"
              className="min-h-[80px] resize-y text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="upc-au">Audience notes / research paste (optional)</Label>
            <Textarea
              id="upc-au"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Paste any user research, survey quotes, or audience segments. More detail = higher-confidence personas."
              className="min-h-[80px] resize-y text-xs"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {AUDIENCE_PRESETS.map((a) => (
                <Button
                  key={a.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  title={a.description}
                  onClick={() => setAudience((prev) => (prev ? `${prev}\n${a.description}` : a.description))}
                >+ {a.label}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="upc-cnt">Number of personas (1-4)</Label>
            <Input
              id="upc-cnt"
              type="number"
              min={1}
              max={4}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(4, parseInt(e.target.value, 10) || 1)))}
              className="h-9 text-xs w-24"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Regenerate
            </Button>
            <ShareButton getUrl={() => buildShareUrl(input)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {personas.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {stats.total} persona{stats.total === 1 ? "" : "s"} · {stats.distinctRoles} distinct role{stats.distinctRoles === 1 ? "" : "s"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total" value={stats.total} />
                <Stat label="High confidence" value={stats.byConfidence.high} highlight="good" />
                <Stat label="Medium confidence" value={stats.byConfidence.medium} />
                <Stat label="Low confidence" value={stats.byConfidence.low} highlight="bad" />
                <Stat label="Avg goals" value={stats.avgGoals.toFixed(1)} />
                <Stat label="Avg pains" value={stats.avgPains.toFixed(1)} />
                <Stat label="High tech" value={stats.byTechSavviness.high} />
                <Stat label="Low tech" value={stats.byTechSavviness.low} />
              </div>
            </CardContent>
          </Card>

          {personas.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId((id) => (id === p.id ? null : p.id))}
              input={input}
            />
          ))}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" /> Export all personas
              </h3>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre">
                {combinedMd}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => combinedMd} label="Copy all as Markdown" />
                <DownloadButton
                  getText={() => combinedMd}
                  filename={`personas-${productType}.md`}
                  mime="text/markdown"
                  label="Download .md"
                />
                <ShareButton getUrl={() => buildShareUrl(input)} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Add your product info to generate personas"
          hint="Pick a product type, name your product, describe it in a sentence, and (optionally) paste any user research. The tool generates 1-4 distinct personas, each with demographics, goals, pains, behaviors, motivations, an empathy map, and a day-in-the-life. Click 'Load sample' to try it."
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
                  <Badge variant="outline" className="mr-2">{PRODUCT_TYPE_LABELS[h.productType]}</Badge>
                  <Badge variant="secondary" className="mr-2">{h.count} persona{h.count === 1 ? "" : "s"}</Badge>
                  <span className="font-mono text-foreground">{h.productName || "(unnamed)"}</span>
                  <span className="text-muted-foreground ml-2">· {h.personaNames.join(", ")}</span>
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
            <strong className="text-foreground">Privacy:</strong> All persona generation runs locally. Your product description and audience notes never leave this device. History is stored in localStorage only.
            <span className="block mt-1">
              <strong className="text-foreground">Honesty:</strong> AI personas are hypotheses to validate with 5-8 real user interviews — not facts. Each persona is flagged with a confidence level and an explicit assumptions list.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PersonaCard({
  persona: p,
  expanded,
  onToggle,
  input,
}: {
  persona: Persona;
  expanded: boolean;
  onToggle: () => void;
  input: PersonaInput;
}) {
  const md = useMemo(() => renderPersonaMarkdown(p, input), [p, input]);
  const confidenceColor = p.confidence === "high" ? "secondary" : p.confidence === "medium" ? "outline" : "destructive";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{p.fullName}</h3>
              <Badge variant="outline" className="text-[10px]">{p.role}</Badge>
              <Badge variant={confidenceColor as "secondary" | "outline" | "destructive"} className="text-[10px]">
                {p.confidence} confidence
              </Badge>
            </div>
            <p className="text-xs italic text-muted-foreground">"{p.tagline}"</p>
          </div>
          <div className="flex gap-1">
            <CopyButton getText={() => md} label="Copy .md" size="sm" />
            <DownloadButton
              getText={() => md}
              filename={`persona-${p.name.first.toLowerCase()}-${p.name.last.toLowerCase()}.md`}
              mime="text/markdown"
              label="Download"
              size="sm"
            />
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {expanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>

        <div className="rounded border bg-muted/20 px-3 py-2 text-xs flex items-start gap-2">
          <Quote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <span className="italic text-foreground">{p.quote}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <Demographic label="Age" value={p.demographics.ageRange} />
          <Demographic label="Gender" value={p.demographics.gender} />
          <Demographic label="Industry" value={p.demographics.industry} />
          <Demographic label="Location" value={p.demographics.location} />
          <Demographic label="Income" value={p.demographics.incomeRange} />
          <Demographic label="Education" value={p.demographics.education} />
          <Demographic label="Household" value={p.demographics.household} />
          <Demographic label="Tech savvy" value={p.techSavviness} />
        </div>

        {expanded && (
          <div className="space-y-3 pt-2">
            <PersonaList icon={<Target className="h-3.5 w-3.5" />} title="Goals" items={p.goals} />
            <PersonaList icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Pains" items={p.pains} />
            <PersonaList icon={<Briefcase className="h-3.5 w-3.5" />} title="Behaviors" items={p.behaviors} />
            <PersonaList icon={<Heart className="h-3.5 w-3.5" />} title="Motivations" items={p.motivations} />
            <PersonaList icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Frustrations" items={p.frustrations} />
            <PersonaList icon={<Eye className="h-3.5 w-3.5" />} title="Preferred channels" items={p.preferredChannels} />

            <div className="rounded border bg-background px-3 py-2">
              <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Sun className="h-3.5 w-3.5" /> Day in the life
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {p.dayInTheLife.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            </div>

            <div className="rounded border bg-background px-3 py-2">
              <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Eye className="h-3.5 w-3.5" /> Empathy map
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <EmpathyCell label="Says" items={p.empathyMap.says} />
                <EmpathyCell label="Thinks" items={p.empathyMap.thinks} />
                <EmpathyCell label="Does" items={p.empathyMap.does} />
                <EmpathyCell label="Feels" items={p.empathyMap.feels} />
              </div>
            </div>

            <div className="rounded border bg-background px-3 py-2">
              <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Briefcase className="h-3.5 w-3.5" /> Jobs to be done
              </h4>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                {p.jobsToBeDone.map((j, i) => (
                  <div key={i} className="space-y-0.5">
                    <div><strong className="text-foreground">Functional:</strong> {j.functional}</div>
                    <div><strong className="text-foreground">Emotional:</strong> {j.emotional}</div>
                    <div><strong className="text-foreground">Social:</strong> {j.social}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border bg-background px-3 py-2">
              <h4 className="text-[11px] font-semibold text-foreground mb-1">Scenario</h4>
              <p className="text-[11px] text-muted-foreground">{p.scenario}</p>
            </div>

            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-1">
                <Lightbulb className="h-3.5 w-3.5" /> Honesty — {p.confidence} confidence
              </h4>
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                {p.assumptions.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonaList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-1">{icon} {title}</h4>
      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
        {items.map((it, i) => <li key={i}>• {it}</li>)}
      </ul>
    </div>
  );
}

function EmpathyCell({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded border bg-muted/20 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[11px] text-foreground">{items.join("; ")}</div>
    </div>
  );
}

function Demographic({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[11px] text-foreground">{value}</div>
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
    ? "text-amber-600 dark:text-amber-400"
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
