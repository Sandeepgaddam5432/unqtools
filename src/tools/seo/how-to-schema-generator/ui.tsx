"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  validateInput,
  parseBulkSteps,
  parseList,
  generateHowToSchema,
  minutesToIsoDuration,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  moveStepUp,
  moveStepDown,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HowToStep,
  type HowToInput,
  type HistoryEntry,
} from "./logic";
import {
  History,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  ListOrdered,
  ExternalLink,
  Upload,
  BookOpen,
} from "lucide-react";

export default function HowToSchemaGenerator() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number | "">("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [suppliesText, setSuppliesText] = useState("");
  const [toolsText, setToolsText] = useState("");
  const [steps, setSteps] = useState<HowToStep[]>([
    { name: "", text: "", image: "" },
  ]);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        if (parsed.name) setName(parsed.name);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.totalTimeMinutes) setTotalTimeMinutes(parsed.totalTimeMinutes);
        if (parsed.estimatedCost) setEstimatedCost(parsed.estimatedCost);
        if (parsed.supplies) setSuppliesText(parsed.supplies.join(", "));
        if (parsed.tools) setToolsText(parsed.tools.join(", "));
        if (parsed.steps && parsed.steps.length > 0) setSteps(parsed.steps);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const input: HowToInput = useMemo(() => ({
    name,
    description: description || undefined,
    totalTimeMinutes: typeof totalTimeMinutes === "number" ? totalTimeMinutes : undefined,
    estimatedCost: estimatedCost || undefined,
    supplies: parseList(suppliesText),
    tools: parseList(toolsText),
    steps,
  }), [name, description, totalTimeMinutes, estimatedCost, suppliesText, toolsText, steps]);

  const validation = useMemo(() => validateInput(input), [input]);
  const isoTime = useMemo(
    () => (typeof totalTimeMinutes === "number" && totalTimeMinutes > 0
      ? minutesToIsoDuration(totalTimeMinutes)
      : ""),
    [totalTimeMinutes],
  );
  const output = useMemo(() => {
    try {
      if (!name.trim() || steps.length === 0) return "";
      return generateHowToSchema(input);
    } catch {
      return "";
    }
  }, [input, name, steps.length]);

  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, { name: "", text: "", image: "" }]);
  }, []);
  const removeStep = useCallback((i: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateStep = useCallback(
    (i: number, key: keyof HowToStep, val: string) => {
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)),
      );
    },
    [],
  );
  const handleUp = useCallback(
    (i: number) => setSteps((prev) => moveStepUp(prev, i)),
    [],
  );
  const handleDown = useCallback(
    (i: number) => setSteps((prev) => moveStepDown(prev, i)),
    [],
  );

  const importBulk = useCallback(() => {
    const parsed = parseBulkSteps(bulkText);
    if (parsed.length === 0) {
      toast.error("No valid steps found");
      return;
    }
    setSteps(parsed);
    setShowBulk(false);
    setBulkText("");
    toast.success(`Imported ${parsed.length} steps`);
  }, [bulkText]);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({
        ts: Date.now(),
        title: name,
        stepCount: steps.length,
        snippet: output.slice(0, 200),
      });
      setHistory(loadHistory());
    }
  }, [output, name, steps.length]);

  const handleClear = useCallback(() => {
    setName("");
    setDescription("");
    setTotalTimeMinutes("");
    setEstimatedCost("");
    setSuppliesText("");
    setToolsText("");
    setSteps([{ name: "", text: "", image: "" }]);
    setBulkText("");
    toast.info("Form cleared");
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
          <div>
            <Label htmlFor="ht-name">How-to title</Label>
            <Input
              id="ht-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How to Bake a Cake"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ht-desc">Description (optional)</Label>
            <Textarea
              id="ht-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A simple cake recipe."
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ht-time">Total time (minutes)</Label>
              <Input
                id="ht-time"
                type="number"
                min={0}
                value={totalTimeMinutes}
                onChange={(e) =>
                  setTotalTimeMinutes(
                    e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0),
                  )
                }
                placeholder="45"
                className="mt-1"
              />
              {isoTime && (
                <div className="text-xs text-muted-foreground mt-1">
                  ISO 8601: <code className="font-mono">{isoTime}</code>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="ht-cost">Estimated cost (e.g. $10 USD)</Label>
              <Input
                id="ht-cost"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="$10 USD"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ht-supplies">Supplies (comma-separated)</Label>
              <Textarea
                id="ht-supplies"
                value={suppliesText}
                onChange={(e) => setSuppliesText(e.target.value)}
                placeholder="flour, sugar, eggs, butter"
                className="mt-1 min-h-[60px] text-xs"
              />
            </div>
            <div>
              <Label htmlFor="ht-tools">Tools (comma-separated)</Label>
              <Textarea
                id="ht-tools"
                value={toolsText}
                onChange={(e) => setToolsText(e.target.value)}
                placeholder="mixer, oven, pan"
                className="mt-1 min-h-[60px] text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Steps ({steps.length})
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBulk((s) => !s)}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Bulk paste
              </Button>
              <Button size="sm" variant="outline" onClick={addStep} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add step
              </Button>
            </div>
          </div>
          {showBulk && (
            <div className="space-y-1.5">
              <Label htmlFor="ht-bulk">
                Bulk paste (Name | Text — one per line)
              </Label>
              <Textarea
                id="ht-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={
                  "Mix | Combine flour, sugar, baking powder\nBake | Pour into pan and bake 30 min"
                }
                className="min-h-[120px] font-mono text-xs resize-y"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={importBulk}
                disabled={!bulkText.trim()}
              >
                Import {bulkText ? `(${parseBulkSteps(bulkText).length} steps)` : ""}
              </Button>
            </div>
          )}
          {steps.map((s, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`sn-${i}`} className="text-xs">
                  Step #{i + 1}
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleUp(i)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDown(i)}
                    disabled={i === steps.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeStep(i)}
                    aria-label="Remove step"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                id={`sn-${i}`}
                value={s.name}
                onChange={(e) => updateStep(i, "name", e.target.value)}
                placeholder="Step name (e.g. Mix dry ingredients)"
              />
              <Textarea
                id={`st-${i}`}
                value={s.text}
                onChange={(e) => updateStep(i, "text", e.target.value)}
                placeholder="Detailed instructions for this step."
                className="min-h-[60px] text-xs"
              />
              <Input
                id={`si-${i}`}
                value={s.image || ""}
                onChange={(e) => updateStep(i, "image", e.target.value)}
                placeholder="Image URL (optional, https://...)"
                className="font-mono text-xs"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.slice(0, 5).map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
          {validation.warnings.length > 5 && (
            <div>• ...and {validation.warnings.length - 5} more</div>
          )}
        </div>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated HowTo JSON-LD</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton
                getText={() => output}
                filename="howto-schema.jsonld"
                mime="application/ld+json"
              />
              <ShareButton getUrl={() => buildShareUrl(input)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all max-h-[400px]">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a
                href={buildGoogleRichResultsLink("")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Google Rich Results test
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a
                href={buildSchemaDocsLink()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen className="h-3.5 w-3.5" /> Schema.org docs
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Add a title and at least one step"
          hint="Each step needs a name and instructions. Add images, supplies, and tools for richer results."
          icon={<ListOrdered className="h-8 w-8" />}
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
                <div
                  key={i}
                  className="rounded border bg-background px-3 py-2 text-xs"
                >
                  <Badge variant="outline" className="mr-2">
                    {h.stepCount} steps
                  </Badge>
                  <span className="text-muted-foreground">{h.title || "(untitled)"}</span>
                  <div className="text-muted-foreground/70 mt-1">
                    {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> HowTo schema
            generation runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
