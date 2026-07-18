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
  CREATOR_TYPES,
  parseInputs,
  generateAll,
  wrapHtmlScriptTag,
  wrapAllHtmlScriptTags,
  renderText,
  renderCsv,
  checkGoogleRichResultsCompliance,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CreatorType,
  type VideoInputs,
  type HistoryEntry,
} from "./logic";
import { Video, History, AlertCircle, CheckCircle2, Code2, ListVideo, AlertTriangle } from "lucide-react";

export default function VideoSchemaGenerator() {
  const [form, setForm] = useState<VideoInputs>({
    videoTitle: "",
    videoDescription: "",
    videoUrl: "",
    thumbnailUrl: "",
    uploadDate: "",
    duration: "",
    contentRating: "",
    creatorName: "",
    creatorType: "Person",
    viewsCount: "",
    likesCount: "",
    chaptersText: "",
    includeBreadcrumb: false,
    breadcrumbItems: "",
    pageUrl: "",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<"json" | "html" | "report">("json");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setForm((prev) => ({ ...prev, ...p }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const inputs = useMemo(() => parseInputs(form), [form]);
  const result = useMemo(() => generateAll(inputs), [inputs]);
  const text = useMemo(() => renderText(result, inputs), [result, inputs]);
  const csv = useMemo(() => renderCsv(result, inputs), [result, inputs]);
  const jsonStr = useMemo(() => JSON.stringify(result.videoObject, null, 2), [result]);
  const htmlStr = useMemo(() => wrapAllHtmlScriptTags(result), [result]);
  const mainHtmlStr = useMemo(() => wrapHtmlScriptTag(result.videoObject), [result]);
  const grc = useMemo(() => checkGoogleRichResultsCompliance(inputs), [inputs]);

  const hasInput = Boolean(inputs.videoTitle || inputs.videoDescription || inputs.videoUrl || inputs.duration);

  const handleSaveHistory = useCallback(() => {
    if (hasInput) {
      saveHistory({
        ts: Date.now(),
        videoTitle: inputs.videoTitle.slice(0, 60),
        durationIso: result.summary.durationIso,
        validationStatus: result.summary.validationStatus,
        clipCount: result.summary.clipCount,
      });
      setHistory(loadHistory());
    }
  }, [hasInput, inputs, result]);

  const handleClear = useCallback(() => {
    setForm({
      videoTitle: "", videoDescription: "", videoUrl: "", thumbnailUrl: "",
      uploadDate: "", duration: "", contentRating: "", creatorName: "",
      creatorType: "Person", viewsCount: "", likesCount: "", chaptersText: "",
      includeBreadcrumb: false, breadcrumbItems: "", pageUrl: "",
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const statusColor = (s: string) =>
    s === "valid" ? "text-emerald-600 dark:text-emerald-400"
    : s === "warnings" ? "text-amber-600 dark:text-amber-400"
    : s === "errors" ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vsg-title">Video title *</Label>
              <Input
                id="vsg-title"
                value={form.videoTitle}
                onChange={(e) => setForm((f) => ({ ...f, videoTitle: e.target.value }))}
                placeholder="How to Bake Chocolate Chip Cookies"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vsg-thumb">Thumbnail URL *</Label>
              <Input
                id="vsg-thumb"
                value={form.thumbnailUrl}
                onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                placeholder="https://example.com/thumb.jpg"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vsg-desc">Description *</Label>
            <Textarea
              id="vsg-desc"
              value={form.videoDescription}
              onChange={(e) => setForm((f) => ({ ...f, videoDescription: e.target.value }))}
              placeholder="A detailed description of the video content (50+ chars recommended)."
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vsg-vurl">Video URL <span className="text-[11px] text-muted-foreground">(content or embed)</span></Label>
              <Input
                id="vsg-vurl"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder="https://example.com/video.mp4"
              />
              <p className="text-[10px] text-muted-foreground">
                {form.videoUrl && (result.videoObject.embedUrl ? "→ classified as embedUrl" : result.videoObject.contentUrl ? "→ classified as contentUrl" : "")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vsg-date">Upload date * <span className="text-[11px] text-muted-foreground">(YYYY-MM-DD)</span></Label>
              <Input
                id="vsg-date"
                type="date"
                value={form.uploadDate}
                onChange={(e) => setForm((f) => ({ ...f, uploadDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vsg-dur">Duration * <span className="text-[11px] text-muted-foreground">(PT4M13S / HH:MM:SS / sec)</span></Label>
              <Input
                id="vsg-dur"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="4:13"
              />
              <p className="text-[10px] text-muted-foreground">
                {result.summary.durationIso ? `→ ISO 8601: ${result.summary.durationIso}` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vsg-creator">Creator name</Label>
              <Input
                id="vsg-creator"
                value={form.creatorName}
                onChange={(e) => setForm((f) => ({ ...f, creatorName: e.target.value }))}
                placeholder="Baking With Beth"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vsg-ctype">Creator type</Label>
              <select
                id="vsg-ctype"
                value={form.creatorType}
                onChange={(e) => setForm((f) => ({ ...f, creatorType: e.target.value as CreatorType }))}
                className="w-full h-9 text-xs rounded border bg-background px-2"
              >
                {CREATOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vsg-rating">Content rating <span className="text-[11px] text-muted-foreground">(optional)</span></Label>
              <Input
                id="vsg-rating"
                value={form.contentRating}
                onChange={(e) => setForm((f) => ({ ...f, contentRating: e.target.value }))}
                placeholder="MPAA PG-13"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vsg-views">Views count <span className="text-[11px] text-muted-foreground">(optional)</span></Label>
              <Input
                id="vsg-views"
                value={form.viewsCount}
                onChange={(e) => setForm((f) => ({ ...f, viewsCount: e.target.value }))}
                placeholder="15432"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vsg-likes">Likes count <span className="text-[11px] text-muted-foreground">(optional)</span></Label>
              <Input
                id="vsg-likes"
                value={form.likesCount}
                onChange={(e) => setForm((f) => ({ ...f, likesCount: e.target.value }))}
                placeholder="987"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vsg-chapters">Chapters <span className="text-[11px] text-muted-foreground">(0:00 Intro format, one per line)</span></Label>
            <Textarea
              id="vsg-chapters"
              value={form.chaptersText}
              onChange={(e) => setForm((f) => ({ ...f, chaptersText: e.target.value }))}
              placeholder={"0:00 Intro\n1:30 Mixing dry ingredients\n3:00 Baking\n5:30 Cool and serve"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              {result.summary.clipCount} chapter(s) detected · {result.clips.length} Clip schema entries generated
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vsg-purl">Page URL <span className="text-[11px] text-muted-foreground">(URL hosting the video — for SeekToAction)</span></Label>
            <Input
              id="vsg-purl"
              value={form.pageUrl}
              onChange={(e) => setForm((f) => ({ ...f, pageUrl: e.target.value }))}
              placeholder="https://example.com/videos/cookies"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.includeBreadcrumb}
                onChange={(e) => setForm((f) => ({ ...f, includeBreadcrumb: e.target.checked }))}
              />
              Include BreadcrumbList companion schema
            </label>
            {form.includeBreadcrumb && (
              <Textarea
                value={form.breadcrumbItems}
                onChange={(e) => setForm((f) => ({ ...f, breadcrumbItems: e.target.value }))}
                placeholder={"Home\nVideos\nCookies Tutorial"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Video className="h-4 w-4" /> Schema summary
                </h3>
                <Badge variant="outline" className={`text-xs ${statusColor(result.summary.validationStatus)}`}>
                  {result.summary.validationStatus}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Required fields" value={`${result.summary.requiredFieldsProvided}/${result.summary.requiredFieldsCount}`} highlight={result.summary.requiredFieldsProvided === result.summary.requiredFieldsCount ? "good" : "bad"} />
                <Stat label="Optional fields" value={`${result.summary.optionalFieldsProvided}/${result.summary.optionalFieldsCount}`} />
                <Stat label="Clips" value={result.summary.clipCount} />
                <Stat label="Duration (ISO)" value={result.summary.durationIso || "invalid"} highlight={result.summary.durationIso ? "good" : "bad"} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className={result.summary.hasSeekToAction ? "text-emerald-600" : "text-muted-foreground"}>
                  SeekToAction: {result.summary.hasSeekToAction ? "yes" : "no"}
                </Badge>
                <Badge variant="outline" className={result.summary.hasBreadcrumb ? "text-emerald-600" : "text-muted-foreground"}>
                  Breadcrumb: {result.summary.hasBreadcrumb ? "yes" : "no"}
                </Badge>
                <Badge variant="outline" className={grc.compliant ? "text-emerald-600" : "text-amber-600"}>
                  Google rich results: {grc.compliant ? "compliant" : "non-compliant"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {(result.validation.errors.length > 0 || result.validation.warnings.length > 0) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Validation report
                </h3>
                {result.validation.errors.length > 0 && (
                  <div className="space-y-1">
                    {result.validation.errors.map((e, i) => (
                      <div key={`e${i}`} className="flex items-start gap-2 text-xs rounded border border-red-500/30 bg-red-500/5 px-2 py-1">
                        <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="text-red-700 dark:text-red-400"><code>{e.field}</code> — {e.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.validation.warnings.length > 0 && (
                  <div className="space-y-1">
                    {result.validation.warnings.map((w, i) => (
                      <div key={`w${i}`} className="flex items-start gap-2 text-xs rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1">
                        <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span className="text-amber-700 dark:text-amber-400"><code>{w.field}</code> — {w.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="h-4 w-4" /> Generated markup
                </h3>
                <div className="flex gap-1">
                  <Button size="sm" variant={tab === "json" ? "default" : "outline"} onClick={() => setTab("json")} className="h-7 text-xs">JSON-LD</Button>
                  <Button size="sm" variant={tab === "html" ? "default" : "outline"} onClick={() => setTab("html")} className="h-7 text-xs">HTML tag</Button>
                  <Button size="sm" variant={tab === "report" ? "default" : "outline"} onClick={() => setTab("report")} className="h-7 text-xs">Report</Button>
                </div>
              </div>
              {tab === "json" && (
                <pre className="text-[11px] font-mono rounded border bg-muted/30 p-3 overflow-auto max-h-[400px] whitespace-pre-wrap break-all">{jsonStr}</pre>
              )}
              {tab === "html" && (
                <pre className="text-[11px] font-mono rounded border bg-muted/30 p-3 overflow-auto max-h-[400px] whitespace-pre-wrap break-all">{htmlStr}</pre>
              )}
              {tab === "report" && (
                <pre className="text-[11px] font-mono rounded border bg-muted/30 p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">{text}</pre>
              )}

              {result.clips.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-[11px] space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <ListVideo className="h-3 w-3" /> Clip schema ({result.clips.length})
                  </div>
                  {result.clips.map((c, i) => (
                    <div key={i} className="font-mono flex flex-wrap gap-2">
                      <span className="text-muted-foreground">{c.startOffset}-{c.endOffset}s</span>
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-blue-600 dark:text-blue-400 truncate">{c.url}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return tab === "html" ? htmlStr : tab === "report" ? text : jsonStr; }} label={tab === "html" ? "Copy HTML" : tab === "report" ? "Copy report" : "Copy JSON"} />
                <DownloadButton getText={() => { handleSaveHistory(); return jsonStr; }} filename="video-schema.json" mime="application/json" label="Download .json" />
                <DownloadButton getText={() => { handleSaveHistory(); return mainHtmlStr; }} filename="video-schema.html" mime="text/html" label="Download .html" />
                <DownloadButton getText={() => csv} filename="video-schema.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter video metadata to generate VideoObject JSON-LD schema"
          hint="Fill in the required fields (title, description, thumbnail URL, upload date, duration). Optional fields add creator, interaction stats, chapters (Clip + SeekToAction), and BreadcrumbList companion schema."
          icon={<Video className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${statusColor(h.validationStatus)}`}>{h.validationStatus}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.clipCount} clips</Badge>
                  {h.durationIso && <Badge variant="outline" className="text-[10px] font-mono">{h.durationIso}</Badge>}
                  <span className="text-foreground truncate flex-1">{h.videoTitle}</span>
                  <span className="text-muted-foreground text-[10px]">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All schema generation and validation runs locally in your browser. No data is sent to any server. History is stored in localStorage on this device only.
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
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
    </div>
  );
}
