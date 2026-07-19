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
  COLLAB_TYPES,
  TARGET_PLATFORMS,
  AUDIENCE_TIERS,
  COLLAB_TYPE_LABELS,
  PLATFORM_LABELS,
  AUDIENCE_LABELS,
  buildCollab,
  renderText,
  renderCsv,
  renderTrackerCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CollabType,
  type TargetPlatform,
  type AudienceTier,
  type HistoryEntry,
} from "./logic";
import { Handshake, History, Search, Mail, TrendingUp, Users, DollarSign, FileText, Gift, RefreshCw } from "lucide-react";

const DEFAULT_INPUT = {
  yourBrand: "",
  yourNiche: "",
  collabType: "influencer-outreach" as CollabType,
  targetPlatforms: [] as TargetPlatform[],
  audienceSizeTarget: "mid-10k-100k" as AudienceTier,
  budgetRange: "",
  yourValueProp: "",
};

export default function SocialMediaCollabFinder() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInput((prev) => ({
          ...prev,
          ...p,
          targetPlatforms: p.targetPlatforms ?? prev.targetPlatforms,
        }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const collab = useMemo(() => buildCollab(input), [input]);
  const hasInput = input.yourBrand.trim().length > 0 || input.yourNiche.trim().length > 0;

  const text = useMemo(() => renderText(collab), [collab]);
  const csv = useMemo(() => renderCsv(collab), [collab]);
  const tracker = useMemo(() => renderTrackerCsv(), []);

  const handleSaveHistory = useCallback(() => {
    if (hasInput) {
      saveHistory({
        ts: Date.now(),
        yourBrand: input.yourBrand,
        yourNiche: input.yourNiche,
        collabType: input.collabType,
        audienceSizeTarget: input.audienceSizeTarget,
        budgetRange: input.budgetRange,
      });
      setHistory(loadHistory());
    }
  }, [input, hasInput]);

  const updateField = useCallback(<K extends keyof typeof input>(key: K, value: (typeof input)[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePlatform = (p: TargetPlatform) => {
    setInput((prev) => ({
      ...prev,
      targetPlatforms: prev.targetPlatforms.includes(p)
        ? prev.targetPlatforms.filter((x) => x !== p)
        : [...prev.targetPlatforms, p],
    }));
  };

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-brand">Your brand</Label>
              <Input
                id="cf-brand"
                value={input.yourBrand}
                onChange={(e) => updateField("yourBrand", e.target.value)}
                placeholder="Acme Fitness"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-niche">Your niche</Label>
              <Input
                id="cf-niche"
                value={input.yourNiche}
                onChange={(e) => updateField("yourNiche", e.target.value)}
                placeholder="fitness, tech, cooking, travel…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-type">Collab type</Label>
              <select
                id="cf-type"
                value={input.collabType}
                onChange={(e) => updateField("collabType", e.target.value as CollabType)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {COLLAB_TYPES.map((t) => (
                  <option key={t} value={t}>{COLLAB_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-tier">Audience size target</Label>
              <select
                id="cf-tier"
                value={input.audienceSizeTarget}
                onChange={(e) => updateField("audienceSizeTarget", e.target.value as AudienceTier)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {AUDIENCE_TIERS.map((t) => (
                  <option key={t} value={t}>{AUDIENCE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-budget">Budget range</Label>
              <Input
                id="cf-budget"
                value={input.budgetRange}
                onChange={(e) => updateField("budgetRange", e.target.value)}
                placeholder="$500-$2000 or product-only"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-vp">Value proposition</Label>
              <Textarea
                id="cf-vp"
                value={input.yourValueProp}
                onChange={(e) => updateField("yourValueProp", e.target.value)}
                placeholder="We'd love to send you our new smart jump rope in exchange for an honest review."
                className="min-h-[60px] resize-y text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Target platforms</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {TARGET_PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={input.targetPlatforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                  />
                  {PLATFORM_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Partnership match
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Match score" value={`${collab.partnershipMatch.score}/100`} highlight={collab.partnershipMatch.score >= 75 ? "good" : collab.partnershipMatch.score < 50 ? "bad" : undefined} />
                <Stat label="Level" value={collab.partnershipMatch.level} highlight={collab.partnershipMatch.level === "high" ? "good" : collab.partnershipMatch.level === "low" ? "bad" : undefined} />
                <Stat label="Outreach queries" value={collab.summary.totalOutreachTargets} />
                <Stat label="Comp range" value={collab.compensation.low === 0 && collab.compensation.high === 0 ? "comm-only" : `$${collab.compensation.low}–$${collab.compensation.high}`} />
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                {collab.partnershipMatch.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {collab.searchQueries.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="h-4 w-4" /> Influencer search queries ({collab.searchQueries.length})
                </h3>
                <div className="space-y-1 max-h-[280px] overflow-auto">
                  {collab.searchQueries.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[q.platform]}</Badge>
                      <a
                        href={q.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 font-mono text-foreground truncate hover:text-primary hover:underline"
                      >
                        {q.query}
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Outreach email
              </h3>
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Subject</div>
                <div className="font-medium text-foreground">{collab.outreachEmail.subject}</div>
              </div>
              <pre className="text-[11px] font-mono whitespace-pre-wrap rounded border bg-muted/40 p-3 max-h-[280px] overflow-auto">
                {collab.outreachEmail.body}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Cross-promo partner niches
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {collab.crossPromoPartners.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]" title={p.reason}>
                    {p.niche}
                  </Badge>
                ))}
              </div>
              <div className="space-y-1 mt-2">
                {collab.crossPromoPartners.map((p, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    <strong className="text-foreground">{p.niche}:</strong> {p.reason}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {input.collabType === "affiliate" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Affiliate program structure
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Commission" value={`${collab.affiliateProgram.commissionPct}%`} />
                  <Stat label="Cookie window" value={`${collab.affiliateProgram.cookieDurationDays} days`} />
                </div>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-medium text-foreground">Payout terms</div>
                  <div className="text-muted-foreground">{collab.affiliateProgram.payoutTerms}</div>
                </div>
                <div className="text-[11px] text-muted-foreground">{collab.affiliateProgram.notes}</div>
              </CardContent>
            </Card>
          )}

          {collab.sponsoredBriefs.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Sponsored content briefs ({collab.sponsoredBriefs.length})
                </h3>
                <div className="space-y-2">
                  {collab.sponsoredBriefs.map((b) => (
                    <div key={b.platform} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="font-medium text-foreground mb-1">{PLATFORM_LABELS[b.platform]}</div>
                      <div className="text-[10px] text-muted-foreground mb-1">Deliverables:</div>
                      <ul className="list-disc pl-4 mb-1">
                        {b.deliverables.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                      <div className="text-[10px] text-muted-foreground mb-1">Timeline: <span className="text-foreground">{b.timeline}</span></div>
                      <div className="text-[10px] text-muted-foreground mb-1">Disclosure: <span className="text-foreground">{b.disclosure}</span></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {input.collabType === "giveaway-collab" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Gift className="h-4 w-4" /> Giveaway collab plan
                </h3>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-medium text-foreground mb-1">Prize split</div>
                  <div className="text-muted-foreground">{collab.giveawayPlan.prizeSplit}</div>
                </div>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-medium text-foreground mb-1">Mechanics</div>
                  <ul className="list-disc pl-4">
                    {collab.giveawayPlan.mechanics.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-medium text-foreground mb-1">Promotion schedule</div>
                  <ul className="list-disc pl-4">
                    {collab.giveawayPlan.promotionSchedule.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
                <div className="text-[11px] text-muted-foreground">{collab.giveawayPlan.rules}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" /> Follow-up sequence
              </h3>
              <div className="space-y-2">
                {collab.followUps.map((f) => (
                  <div key={f.step} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">Step {f.step}</Badge>
                      <Badge variant="secondary" className="text-[10px]">after {f.waitDays} days</Badge>
                      <span className="font-medium text-foreground">{f.subject}</span>
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground">{f.body}</pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Compensation estimate
              </h3>
              {collab.compensation.low === 0 && collab.compensation.high === 0 ? (
                <p className="text-xs text-muted-foreground">Commission-only — no fixed fee.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Low" value={`$${collab.compensation.low}`} />
                  <Stat label="Mid" value={`$${collab.compensation.mid}`} highlight="good" />
                  <Stat label="High" value={`$${collab.compensation.high}`} />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">{collab.compensation.notes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy plan" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="collab-outreach-plan.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="collab-summary.csv" mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => tracker} filename="outreach-tracker-template.csv" mime="text/csv" label="Tracker template" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your brand and niche to find collaboration opportunities"
          hint="The tool generates influencer search queries per platform, outreach emails, partnership compatibility scores, cross-promo partner suggestions, affiliate structures, sponsored briefs, giveaway plans, follow-ups, and compensation estimates."
          icon={<Handshake className="h-8 w-8" />}
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
                    setInput({
                      ...DEFAULT_INPUT,
                      yourBrand: h.yourBrand,
                      yourNiche: h.yourNiche,
                      collabType: h.collabType,
                      audienceSizeTarget: h.audienceSizeTarget,
                      budgetRange: h.budgetRange,
                    });
                    toast.info("Loaded from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{COLLAB_TYPE_LABELS[h.collabType]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{AUDIENCE_LABELS[h.audienceSizeTarget]}</Badge>
                    <span className="font-medium text-foreground">{h.yourBrand || "Untitled"}</span>
                    <span className="text-muted-foreground">· {h.yourNiche}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {h.budgetRange || "no budget set"} · {new Date(h.ts).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All query generation, email templating, and rendering runs locally. History is stored in localStorage on this device only.
          </p>
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
