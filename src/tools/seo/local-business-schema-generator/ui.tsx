"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import {
  BUSINESS_TYPES,
  DAYS,
  defaultHours,
  validate,
  generate,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BusinessInput,
  type BusinessType,
  type DayHours,
  type DayOfWeek,
  type HistoryEntry,
} from "./logic";
import { History, Store, ExternalLink } from "lucide-react";

export default function LocalBusinessSchemaGenerator() {
  const [input, setInput] = useState<BusinessInput>({
    type: "Restaurant",
    name: "",
    description: "",
    url: "",
    image: "",
    telephone: "",
    email: "",
    streetAddress: "",
    addressLocality: "",
    addressRegion: "",
    postalCode: "",
    addressCountry: "",
    geoLat: "",
    geoLng: "",
    priceRange: "",
    ratingValue: "",
    reviewCount: "",
    areaServed: "",
    hours: defaultHours(),
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInput((prev) => ({
          ...prev,
          ...p,
          hours: p.hours ?? prev.hours,
        }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validate(input), [input]);
  const output = useMemo(() => {
    if (!validation.ok) return "";
    try {
      return generate(input);
    } catch {
      return "";
    }
  }, [input, validation.ok]);

  const setField = useCallback(<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setHour = useCallback((day: DayOfWeek, field: "open" | "close", value: string) => {
    setInput((prev) => ({
      ...prev,
      hours: prev.hours.map((h) => (h.day === day ? { ...h, [field]: value } : h)),
    }));
  }, []);

  const handleGenerate = useCallback(() => {
    setSubmitted(true);
    if (validation.ok) {
      saveHistory({
        ts: Date.now(),
        type: input.type,
        name: input.name,
        city: input.addressLocality,
      });
      setHistory(loadHistory());
      toast.success("Schema generated");
    } else {
      toast.error(validation.errors[0] ?? "Validation failed");
    }
  }, [validation, input]);

  const handleClear = useCallback(() => {
    setInput({
      type: "Restaurant",
      name: "",
      description: "",
      url: "",
      image: "",
      telephone: "",
      email: "",
      streetAddress: "",
      addressLocality: "",
      addressRegion: "",
      postalCode: "",
      addressCountry: "",
      geoLat: "",
      geoLng: "",
      priceRange: "",
      ratingValue: "",
      reviewCount: "",
      areaServed: "",
      hours: defaultHours(),
    });
    setSubmitted(false);
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
          <div className="space-y-1.5">
            <Label htmlFor="lb-type">Business type</Label>
            <Select value={input.type} onValueChange={(v) => setField("type", v as BusinessType)}>
              <SelectTrigger id="lb-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Business name *" value={input.name} onChange={(v) => setField("name", v)} placeholder="Joe's Pizza" id="lb-name" />
            <Field label="Telephone" value={input.telephone} onChange={(v) => setField("telephone", v)} placeholder="+1-555-123-4567" id="lb-tel" />
            <Field label="Website URL" value={input.url} onChange={(v) => setField("url", v)} placeholder="https://example.com" id="lb-url" />
            <Field label="Email" value={input.email} onChange={(v) => setField("email", v)} placeholder="info@example.com" id="lb-email" />
            <Field label="Image URL" value={input.image} onChange={(v) => setField("image", v)} placeholder="https://example.com/photo.jpg" id="lb-img" />
            <Field label="Price range" value={input.priceRange} onChange={(v) => setField("priceRange", v)} placeholder="$$" id="lb-price" />
            <Field label="Description" value={input.description ?? ""} onChange={(v) => setField("description", v)} placeholder="Family-friendly pizzeria" id="lb-desc" />
            <Field label="Area served" value={input.areaServed ?? ""} onChange={(v) => setField("areaServed", v)} placeholder="Springfield, IL" id="lb-area" />
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2">Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Street address *" value={input.streetAddress} onChange={(v) => setField("streetAddress", v)} placeholder="123 Main St" id="lb-street" />
              <Field label="City (addressLocality) *" value={input.addressLocality} onChange={(v) => setField("addressLocality", v)} placeholder="Springfield" id="lb-city" />
              <Field label="Region (state)" value={input.addressRegion} onChange={(v) => setField("addressRegion", v)} placeholder="IL" id="lb-region" />
              <Field label="Postal code" value={input.postalCode} onChange={(v) => setField("postalCode", v)} placeholder="62701" id="lb-zip" />
              <Field label="Country *" value={input.addressCountry} onChange={(v) => setField("addressCountry", v)} placeholder="US" id="lb-country" />
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2">Geo coordinates</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" value={input.geoLat ?? ""} onChange={(v) => setField("geoLat", v)} placeholder="39.78" id="lb-lat" />
              <Field label="Longitude" value={input.geoLng ?? ""} onChange={(v) => setField("geoLng", v)} placeholder="-89.65" id="lb-lng" />
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2">Aggregate rating</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rating value (0-5)" value={input.ratingValue ?? ""} onChange={(v) => setField("ratingValue", v)} placeholder="4.5" id="lb-rating" />
              <Field label="Review count" value={input.reviewCount ?? ""} onChange={(v) => setField("reviewCount", v)} placeholder="120" id="lb-reviews" />
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2">Opening hours</h4>
            <p className="text-xs text-muted-foreground mb-2">Leave blank for closed days.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {input.hours.map((h) => (
                <DayHoursRow key={h.day} hours={h} onChange={(f, v) => setHour(h.day, f, v)} />
              ))}
            </div>
          </div>

          {submitted && !validation.ok && (
            <ErrorBanner message={validation.errors.join("; ")} />
          )}
          {validation.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={!validation.ok}>Generate schema</Button>
            <ShareButton getUrl={() => buildShareUrl(input)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {output ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Store className="h-4 w-4" /> LocalBusiness JSON-LD
            </h3>
            <pre className="text-xs font-mono bg-muted/40 rounded p-3 overflow-auto max-h-[500px]">{output}</pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => output} label="Copy script tag" />
              <DownloadButton
                getText={() => output}
                filename="local-business.jsonld"
                mime="application/ld+json"
                label="Download .jsonld"
              />
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={buildGoogleRichResultsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Test in Rich Results
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <a href={buildSchemaDocsLink(input.type)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Schema.org docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Fill in business details to generate JSON-LD"
          hint="Required: name, street address, city, country. Optional: phone, hours, geo, rating."
          icon={<Store className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.type}</Badge>
                  <Badge variant="outline" className="mr-2">{h.name}</Badge>
                  <Badge variant="outline" className="mr-2">{h.city}</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> JSON-LD
            generation runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-xs" />
    </div>
  );
}

function DayHoursRow({
  hours,
  onChange,
}: {
  hours: DayHours;
  onChange: (field: "open" | "close", value: string) => void;
}) {
  return (
    <div className="rounded border bg-background p-2 space-y-1">
      <div className="text-xs font-medium">{hours.day}</div>
      <div className="grid grid-cols-2 gap-1">
        <Input
          type="time"
          value={hours.open}
          onChange={(e) => onChange("open", e.target.value)}
          className="text-xs h-8"
          aria-label={`${hours.day} open`}
        />
        <Input
          type="time"
          value={hours.close}
          onChange={(e) => onChange("close", e.target.value)}
          className="text-xs h-8"
          aria-label={`${hours.day} close`}
        />
      </div>
    </div>
  );
}
