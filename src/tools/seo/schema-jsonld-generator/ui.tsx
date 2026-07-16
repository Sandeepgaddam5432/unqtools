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
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  SCHEMA_TEMPLATES,
  SCHEMA_TYPES,
  validateValues,
  generateSchema,
  getRequiredFields,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type SchemaType,
  type HistoryEntry,
} from "./logic";
import { ExternalLink, History, BookOpen, CheckCircle2 } from "lucide-react";

export default function SchemaJsonLdGenerator() {
  const [type, setType] = useState<SchemaType>("Article");
  const [values, setValues] = useState<Record<string, string>>({});
  const [customRaw, setCustomRaw] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.type) {
        setType(parsed.type);
        setValues(parsed.values);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const template = useMemo(() => SCHEMA_TEMPLATES[type], [type]);
  const requiredFields = useMemo(() => getRequiredFields(type), [type]);
  const validation = useMemo(() => validateValues(type, values), [type, values]);

  const output = useMemo(() => {
    try {
      const custom: Record<string, unknown> = {};
      if (customRaw.trim()) {
        // Try to parse as JSON object
        try {
          const parsed = JSON.parse(`{${customRaw}}`);
          Object.assign(custom, parsed);
        } catch {
          // Treat as key=value lines
          for (const line of customRaw.split(/\n+/)) {
            const [k, ...v] = line.split("=");
            if (k) custom[k.trim()] = v.join("=").trim();
          }
        }
      }
      return generateSchema(type, values, custom);
    } catch {
      return "";
    }
  }, [type, values, customRaw]);

  const update = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleTypeChange = useCallback((t: SchemaType) => {
    setType(t);
    setValues({});
    setCustomRaw("");
  }, []);

  const handleClear = useCallback(() => {
    setValues({});
    setCustomRaw("");
    toast.info("Form cleared");
  }, []);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({ ts: Date.now(), type, snippet: output });
      setHistory(loadHistory());
    }
  }, [output, type]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Schema type</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as SchemaType)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEMA_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <a href={buildSchemaDocsLink(type)} target="_blank" rel="noopener noreferrer">
                  <BookOpen className="h-3.5 w-3.5" /> Schema.org docs
                </a>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{template.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {requiredFields.map((f) => (
              <Badge key={f.key} variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> {f.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {template.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`sf-${f.key}`} className="flex items-center gap-1.5">
                  {f.label}
                  {f.required && <span className="text-destructive">*</span>}
                </Label>
                {f.type === "array" ? (
                  <Textarea
                    id={`sf-${f.key}`}
                    value={values[f.key] || ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="min-h-[100px] font-mono text-xs resize-y"
                  />
                ) : (
                  <Input
                    id={`sf-${f.key}`}
                    type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                    value={values[f.key] || ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-props">Custom properties (key=value per line, or JSON)</Label>
            <Textarea
              id="custom-props"
              value={customRaw}
              onChange={(e) => setCustomRaw(e.target.value)}
              placeholder={"sku=ABC123\ncolor=red\nor { \"sku\": \"ABC123\", \"color\": \"red\" }"}
              className="min-h-[80px] font-mono text-xs resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated JSON-LD</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton getText={() => output} filename="schema.jsonld" mime="application/ld+json" />
              <ShareButton getUrl={() => buildShareUrl(type, values)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={buildGoogleRichResultsLink(values.url || "")} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Google Rich Results test
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Fill the required fields to generate JSON-LD"
          hint={`Required for ${type}: ${requiredFields.map((f) => f.label).join(", ")}`}
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
                <button
                  key={i}
                  onClick={() => {
                    setType(h.type);
                    setValues({});
                    toast.info(`Loaded ${h.type} from history`);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <span className="font-medium">{h.type}</span>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> JSON-LD generation is pure string templating in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
