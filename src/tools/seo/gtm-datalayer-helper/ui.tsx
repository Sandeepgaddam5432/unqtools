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
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  EVENT_PRESETS,
  validateEvent,
  generatePushCode,
  generateInitCode,
  generateCustomEventTrigger,
  generateVariableDeclarations,
  generateJsonPreview,
  findPreset,
  countParams,
  GTM_DOCS_URL,
  DATALAYER_DOCS_URL,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
} from "./logic";
import { History, Tags, ExternalLink, Code2 } from "lucide-react";

export default function GtmDataLayerHelper() {
  const [eventName, setEventName] = useState("purchase");
  const [paramsJson, setParamsJson] = useState('{\n  "value": 99.99,\n  "currency": "USD",\n  "transaction_id": "T-12345"\n}');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.eventName !== undefined) {
        setEventName(parsed.eventName);
        if (parsed.paramsJson !== undefined) setParamsJson(parsed.paramsJson);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const event = useMemo(() => {
    let params: Record<string, string | number | boolean | undefined> = {};
    try {
      const parsed = JSON.parse(paramsJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        params = parsed as Record<string, string | number | boolean | undefined>;
      }
    } catch {
      // invalid JSON
    }
    return { name: eventName, params };
  }, [eventName, paramsJson]);

  const validation = useMemo(() => validateEvent(event), [event]);
  const paramCount = useMemo(() => countParams(event), [event]);

  const pushCode = useMemo(() => {
    try { return generatePushCode(event); } catch (e) { return `// Error: ${(e as Error).message}`; }
  }, [event]);

  const initCode = useMemo(() => generateInitCode(), []);
  const triggerConfig = useMemo(() => {
    try { return generateCustomEventTrigger(event); } catch (e) { return `// Error: ${(e as Error).message}`; }
  }, [event]);
  const variableDecls = useMemo(() => {
    try { return generateVariableDeclarations(event); } catch (e) { return `// Error: ${(e as Error).message}`; }
  }, [event]);
  const jsonPreview = useMemo(() => generateJsonPreview(event), [event]);
  const activePreset = useMemo(() => findPreset(eventName), [eventName]);

  const applyPreset = useCallback((name: string) => {
    const preset = findPreset(name);
    if (preset) {
      setEventName(preset.example.name);
      setParamsJson(JSON.stringify(preset.example.params, null, 2));
      toast.info(`Loaded preset: ${name}`);
    }
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.valid) {
      saveHistory({ ts: Date.now(), eventName: event.name, paramCount });
      setHistory(loadHistory());
    }
  }, [validation, event, paramCount]);

  const handleClear = useCallback(() => {
    setEventName("");
    setParamsJson("{}");
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gtm-name">Event name *</Label>
              <Input
                id="gtm-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="purchase"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, underscores. Max 40 chars.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gtm-preset">Apply preset</Label>
              <Select onValueChange={applyPreset} value="">
                <SelectTrigger id="gtm-preset"><SelectValue placeholder="Pick a preset" /></SelectTrigger>
                <SelectContent>
                  {EVENT_PRESETS.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gtm-params">Parameters (JSON)</Label>
            <Textarea
              id="gtm-params"
              value={paramsJson}
              onChange={(e) => setParamsJson(e.target.value)}
              placeholder={'{\n  "value": 99.99,\n  "currency": "USD"\n}'}
              className="min-h-[150px] font-mono text-xs resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {paramCount} active parameter{paramCount !== 1 ? "s" : ""} (max 25).
            </p>
          </div>
          {activePreset && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <strong className="text-foreground">{activePreset.name}:</strong> {activePreset.description}
              <div className="mt-1">Recommended params: {activePreset.recommendedParams.join(", ")}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {validation.errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
          {validation.errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {eventName.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> dataLayer.push code
                </Label>
                <CopyButton getText={() => { handleSaveHistory(); return pushCode; }} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {pushCode}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> dataLayer + GTM container init
                </Label>
                <CopyButton getText={() => initCode} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {initCode}
              </pre>
              <p className="text-xs text-muted-foreground">Replace GTM-XXXXXXX with your container ID.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> Custom event trigger (JSON config)
                </Label>
                <CopyButton getText={() => triggerConfig} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[300px]">
                {triggerConfig}
              </pre>
              <p className="text-xs text-muted-foreground">In GTM: Triggers → New → Custom Event → use the event name above.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> GTM variable declarations
                </Label>
                <CopyButton getText={() => variableDecls} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[300px]">
                {variableDecls}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> JSON preview
                </Label>
                <CopyButton getText={() => jsonPreview} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {jsonPreview}
              </pre>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ eventName, paramsJson }); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Enter an event name to generate dataLayer code"
          hint="Pick a preset (page_view, scroll, click, form_submit, purchase) or type a custom event name. Add parameters as JSON."
          icon={<Tags className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Event presets reference</h3>
            <div className="flex gap-2">
              <a href={GTM_DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                GTM docs <ExternalLink className="h-3 w-3" />
              </a>
              <a href={DATALAYER_DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                dataLayer docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="space-y-2">
            {EVENT_PRESETS.map((p) => (
              <div key={p.name} className="rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <code className="font-medium text-foreground">{p.name}</code>
                  <Button size="sm" variant="ghost" onClick={() => applyPreset(p.name)} className="text-xs">
                    Use preset
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1">{p.description}</p>
                <div className="text-muted-foreground mt-1">
                  <strong>Recommended params:</strong> {p.recommendedParams.join(", ")}
                </div>
              </div>
            ))}
          </div>
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
                <button
                  key={i}
                  onClick={() => {
                    setEventName(h.eventName);
                    toast.info(`Loaded ${h.eventName}`);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Badge variant="outline" className="mr-2">{h.paramCount} params</Badge>
                  <code className="font-mono">{h.eventName}</code>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Code generation is pure string manipulation. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
