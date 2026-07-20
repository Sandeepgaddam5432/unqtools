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
} from "../../_shared";
import { toast } from "sonner";
import {
  TRIP_TYPE_LABELS,
  PACE_LABELS,
  BUDGET_LABELS,
  INTEREST_LABELS,
  SAMPLE_DESTINATIONS,
  normalizeDestination,
  clampDays,
  normalizeInterests,
  parseInterestText,
  generateItinerary,
  regenerateDay,
  adjustPace,
  buildDayMapUrl,
  renderItineraryText,
  renderItineraryMarkdown,
  renderItineraryJson,
  buildIcsExport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmItinerary,
  type TripType,
  type Pace,
  type Budget,
  type Interest,
  type ItineraryInput,
  type ItineraryResult,
  type HistoryEntry,
} from "./logic";
import {
  Map as MapIcon, History, Sparkles, KeyRound, Loader2, ExternalLink,
  Calendar, Footprints, Wallet, RefreshCw, AlertTriangle, ChevronDown,
} from "lucide-react";

const TRIP_TYPES: TripType[] = ["city-break", "beach", "adventure", "cultural", "foodie"];
const PACES: Pace[] = ["relaxed", "balanced", "packed"];
const BUDGETS: Budget[] = ["budget", "mid-range", "luxury"];
const INTERESTS: Interest[] = [
  "history", "art", "nature", "nightlife", "shopping",
  "family", "photography", "wellness", "architecture", "local-life",
];

const KIND_COLORS: Record<string, string> = {
  activity: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  meal: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  transit: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  rest: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function AiTravelItineraryPlanner() {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);
  const [pace, setPace] = useState<Pace>("balanced");
  const [budget, setBudget] = useState<Budget>("mid-range");
  const [tripType, setTripType] = useState<TripType>("city-break");
  const [interests, setInterests] = useState<Interest[]>(["history", "local-life"]);
  const [startDate, setStartDate] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [result, setResult] = useState<ItineraryResult | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmText, setLlmText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.destination) {
        setDestination(p.destination);
        setDays(p.days);
        setPace(p.pace);
        setBudget(p.budget);
        setTripType(p.tripType);
        setInterests(p.interests);
        if (p.startDate) setStartDate(p.startDate);
        if (p.travelers) setTravelers(p.travelers);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const input: ItineraryInput = useMemo(
    () => ({
      destination: normalizeDestination(destination),
      days: clampDays(days),
      pace, budget, tripType, interests,
      startDate: startDate || undefined,
      travelers,
    }),
    [destination, days, pace, budget, tripType, interests, startDate, travelers],
  );

  const handleGenerate = useCallback(() => {
    const dest = normalizeDestination(destination);
    if (!dest) {
      toast.error("Enter a destination first");
      return;
    }
    try {
      const r = generateItinerary(input);
      setResult(r);
      setLlmText("");
      saveHistory({
        ts: Date.now(),
        destination: dest,
        days: r.days.length,
        tripType, pace, budget,
        stopCount: r.stats.totalStops,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${r.days.length}-day itinerary (${r.stats.totalStops} stops)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  }, [destination, input, tripType, pace, budget]);

  const handleClear = useCallback(() => {
    setDestination("");
    setResult(null);
    setLlmText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleInterest = useCallback((i: Interest) => {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }, []);

  const handleDetectInterests = useCallback(() => {
    const detected = parseInterestText(destination);
    if (detected.length > 0) {
      setInterests(detected);
      toast.success(`Detected: ${detected.map((i) => INTEREST_LABELS[i]).join(", ")}`);
    } else {
      toast.info("No interests detected from your destination");
    }
  }, [destination]);

  const handleRegenerate = useCallback((dayIndex: number) => {
    if (!result) return;
    const r2 = regenerateDay(result, dayIndex);
    setResult(r2);
    toast.success(`Day ${dayIndex} regenerated`);
  }, [result]);

  const handlePace = useCallback((newPace: Pace) => {
    setPace(newPace);
    if (result) {
      const r2 = adjustPace(result, newPace);
      setResult(r2);
      toast.success(`Pace set to ${PACE_LABELS[newPace]}`);
    }
  }, [result]);

  const handleLlmEnhance = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Paste your LLM API key first");
      return;
    }
    if (!input.destination) {
      toast.error("Generate an itinerary first");
      return;
    }
    setLlmLoading(true);
    try {
      const body = buildLlmRequestBody(input);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`LLM error: ${res.status} ${txt.slice(0, 120)}`);
      } else {
        const json = await res.json();
        const text = extractLlmItinerary(json);
        setLlmText(text);
        toast.success("LLM itinerary generated");
      }
    } catch {
      toast.error("LLM request failed");
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, input]);

  const shareUrl = useMemo(
    () => (input.destination ? buildShareUrl(input) : ""),
    [input],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dest">Destination (use → / "to" for multi-city)</Label>
              <Textarea
                id="dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Paris  or  Paris -> Lyon  or  Tokyo to Kyoto"
                rows={2}
              />
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_DESTINATIONS.slice(0, 6).map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setDestination(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="days">Days</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pax">Travelers</Label>
                <Input
                  id="pax"
                  type="number"
                  min={1}
                  max={20}
                  value={travelers}
                  onChange={(e) => setTravelers(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start date (optional)</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Trip type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value as TripType)}
                >
                  {TRIP_TYPES.map((t) => (
                    <option key={t} value={t}>{TRIP_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Interests</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleDetectInterests}>
                Detect from destination
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.map((i) => (
                <Button
                  key={i}
                  variant={interests.includes(i) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleInterest(i)}
                >
                  {INTEREST_LABELS[i]}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Pace</Label>
              <div className="flex gap-1.5">
                {PACES.map((p) => (
                  <Button
                    key={p}
                    variant={pace === p ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePace(p)}
                  >
                    {PACE_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Budget</Label>
              <div className="flex gap-1.5">
                {BUDGETS.map((b) => (
                  <Button
                    key={b}
                    variant={budget === b ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setBudget(b)}
                  >
                    {BUDGET_LABELS[b]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} label="Generate itinerary" />
            <ClearButton onClick={handleClear} disabled={!destination && !result} />
            <ShareButton getUrl={() => shareUrl} disabled={!shareUrl} />
            {result && (
              <>
                <CopyButton getText={() => renderItineraryText(result)} label="Copy text" />
                <DownloadButton
                  getText={() => renderItineraryMarkdown(result)}
                  filename={`${input.destination.replace(/\s+/g, "-").toLowerCase()}-itinerary.md`}
                  label="Download .md"
                  mime="text/markdown"
                />
                <DownloadButton
                  getText={() => buildIcsExport(result)}
                  filename={`${input.destination.replace(/\s+/g, "-").toLowerCase()}.ics`}
                  label="Download .ics"
                  mime="text/calendar"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatChip icon={<Calendar className="h-4 w-4" />} label="Days" value={String(result.days.length)} />
                <StatChip icon={<Sparkles className="h-4 w-4" />} label="Stops" value={String(result.stats.totalStops)} />
                <StatChip icon={<Footprints className="h-4 w-4" />} label="Walking / day" value={`${Math.round(result.days[0].walkingDistanceKm)} km`} />
                <StatChip icon={<Wallet className="h-4 w-4" />} label="Est. cost / day" value={String(result.stats.estimatedCostPerDay)} />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{result.verifyNote}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {result.days.map((day) => (
              <Card key={day.dayIndex}>
                <CardContent className="pt-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold">
                        Day {day.dayIndex}
                        {day.date && <span className="ml-2 text-sm font-normal text-muted-foreground">{day.date}</span>}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">· {day.city}</span>
                      </h3>
                      <p className="text-xs text-muted-foreground">{day.paceNote}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleRegenerate(day.dayIndex)} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                      </Button>
                      <a href={buildDayMapUrl(day)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="gap-1.5">
                          <MapIcon className="h-3.5 w-3.5" /> Map
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                  <ol className="space-y-2">
                    {day.stops.map((s) => (
                      <li key={s.id} className="flex gap-3 text-sm">
                        <div className="w-24 flex-shrink-0 font-mono text-xs text-muted-foreground">
                          {s.startTime}–{s.endTime}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${KIND_COLORS[s.kind] ?? ""}`}>
                              {s.kind}
                            </Badge>
                            <span className="font-medium">{s.name}</span>
                            {s.costEstimate != null && s.costEstimate > 0 && (
                              <span className="text-xs text-muted-foreground">~{s.costEstimate}</span>
                            )}
                            {s.openingHours && (
                              <span className="text-xs text-muted-foreground">⏰ {s.openingHours}</span>
                            )}
                          </div>
                          {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                          {s.verifyNote && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">⚠ {s.verifyNote}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>

          {result.localTips.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Local tips
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.localTips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!result && (
        <EmptyState
          title="No itinerary yet"
          hint="Enter a destination, choose your trip type and pace, then click Generate."
          icon={<MapIcon className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> Optional: enhance with your own LLM key
          </div>
          <p className="text-xs text-muted-foreground">
            Keys are stored only in this browser tab and sent directly to the LLM provider you choose — never to us.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
              {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {llmLoading ? "Working…" : "Enhance"}
            </Button>
          </div>
          {llmText && (
            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {llmText}
            </pre>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" /> History (last 20)
              </h3>
              <ClearButton onClick={handleClearHistory} label="Clear history" size="sm" />
            </div>
            <ul className="space-y-1 text-xs">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1">
                  <span className="font-medium">{h.destination}</span>
                  <Badge variant="outline" className="text-xs">{h.days}d</Badge>
                  <Badge variant="outline" className="text-xs">{TRIP_TYPE_LABELS[h.tripType]}</Badge>
                  <Badge variant="outline" className="text-xs">{PACE_LABELS[h.pace]}</Badge>
                  <Badge variant="outline" className="text-xs">{BUDGET_LABELS[h.budget]}</Badge>
                  <span className="text-muted-foreground">{h.stopCount} stops</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
