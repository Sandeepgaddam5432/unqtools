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
  STYLES,
  SOURCE_TYPES,
  STYLE_LABELS,
  SOURCE_TYPE_LABELS,
  parseAuthors,
  isValidDoi,
  isValidYear,
  buildCitation,
  formatCitation,
  formatInText,
  sortBibliography,
  computeStats,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  stripMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CitationStyle,
  type SourceType,
  type CitationFields,
  type CitationEntry,
  type HistoryEntry,
} from "./logic";
import { BookOpen, Plus, History, Quote, ListOrdered, Trash2 } from "lucide-react";

export default function CitationGenerator() {
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [sourceType, setSourceType] = useState<SourceType>("book");
  const [title, setTitle] = useState("");
  const [authorsText, setAuthorsText] = useState("");
  const [year, setYear] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publisherLocation, setPublisherLocation] = useState("");
  const [journal, setJournal] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  const [url, setUrl] = useState("");
  const [accessedDate, setAccessedDate] = useState("");
  const [doi, setDoi] = useState("");
  const [edition, setEdition] = useState("");
  const [siteName, setSiteName] = useState("");
  const [university, setUniversity] = useState("");
  const [city, setCity] = useState("");
  const [conference, setConference] = useState("");
  const [dayMonth, setDayMonth] = useState("");
  const [bibliography, setBibliography] = useState<CitationEntry[]>([]);
  const [autoSort, setAutoSort] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setStyle(p.style);
      setSourceType(p.sourceType);
      const f = p.fields;
      if (f.title) setTitle(f.title);
      if (f.authors && f.authors.length > 0) {
        setAuthorsText(f.authors.map((a) => `${a.last}, ${a.first}`.trim().replace(/,$/, "")).join("; "));
      }
      if (f.year) setYear(f.year);
      if (f.publisher) setPublisher(f.publisher ?? "");
      if (f.publisherLocation) setPublisherLocation(f.publisherLocation ?? "");
      if (f.journal) setJournal(f.journal ?? "");
      if (f.volume) setVolume(f.volume ?? "");
      if (f.issue) setIssue(f.issue ?? "");
      if (f.pages) setPages(f.pages ?? "");
      if (f.url) setUrl(f.url ?? "");
      if (f.accessedDate) setAccessedDate(f.accessedDate ?? "");
      if (f.doi) setDoi(f.doi ?? "");
      if (p.style || p.sourceType || f.title) toast.info("Loaded from share link");
    }
  }, []);

  const fields: CitationFields = useMemo(() => {
    const f: CitationFields = {
      title: title.trim() || undefined,
      authors: parseAuthors(authorsText),
      year: year.trim() || undefined,
      publisher: publisher.trim() || undefined,
      publisherLocation: publisherLocation.trim() || undefined,
      journal: journal.trim() || undefined,
      volume: volume.trim() || undefined,
      issue: issue.trim() || undefined,
      pages: pages.trim() || undefined,
      url: url.trim() || undefined,
      accessedDate: accessedDate.trim() || undefined,
      doi: doi.trim() || undefined,
      edition: edition.trim() || undefined,
      siteName: siteName.trim() || undefined,
      university: university.trim() || undefined,
      city: city.trim() || undefined,
      conference: conference.trim() || undefined,
      dayMonth: dayMonth.trim() || undefined,
    };
    return f;
  }, [title, authorsText, year, publisher, publisherLocation, journal, volume, issue,
      pages, url, accessedDate, doi, edition, siteName, university, city, conference, dayMonth]);

  const preview = useMemo(() => {
    if (!title && !authorsText && !year && !publisher && !journal && !url) return "";
    return formatCitation(style, sourceType, fields);
  }, [style, sourceType, fields, title, authorsText, year, publisher, journal, url]);

  const previewInText = useMemo(() => {
    if (!title && !authorsText && !year) return "";
    return formatInText(style, fields);
  }, [style, fields, title, authorsText, year]);

  const sortedBib = useMemo(
    () => (autoSort ? sortBibliography(bibliography) : bibliography),
    [bibliography, autoSort],
  );
  const stats = useMemo(() => computeStats(bibliography), [bibliography]);
  const textOut = useMemo(() => renderText(sortedBib), [sortedBib]);
  const htmlOut = useMemo(() => renderHtml(sortedBib), [sortedBib]);
  const mdOut = useMemo(() => renderMarkdown(sortedBib), [sortedBib]);
  const csvOut = useMemo(() => renderCsv(sortedBib), [sortedBib]);

  const doiValid = doi ? isValidDoi(doi) : true;
  const yearValid = year ? isValidYear(year) : true;

  const handleAdd = useCallback(() => {
    if (!title && !authorsText) {
      toast.error("Add at least a title or author");
      return;
    }
    if (doi && !doiValid) {
      toast.error("DOI format is invalid");
      return;
    }
    if (year && !yearValid) {
      toast.error("Year must be a 4-digit number");
      return;
    }
    const entry = buildCitation(style, sourceType, fields);
    setBibliography((prev) => [...prev, entry]);
    saveHistory({
      ts: Date.now(),
      style,
      sourceType,
      title: title || "(untitled)",
      formatted: stripMarkdown(entry.formatted),
    });
    setHistory(loadHistory());
    toast.success("Added to bibliography");
    // Reset title/authors only
    setTitle("");
    setAuthorsText("");
  }, [style, sourceType, fields, title, authorsText, doi, doiValid, year, yearValid]);

  const handleClearForm = useCallback(() => {
    setTitle(""); setAuthorsText(""); setYear(""); setPublisher("");
    setPublisherLocation(""); setJournal(""); setVolume(""); setIssue("");
    setPages(""); setUrl(""); setAccessedDate(""); setDoi(""); setEdition("");
    setSiteName(""); setUniversity(""); setCity(""); setConference(""); setDayMonth("");
    toast.info("Form cleared");
  }, []);

  const handleClearBib = useCallback(() => {
    setBibliography([]);
    toast.info("Bibliography cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleShareCurrent = useCallback(() => {
    return buildShareUrl(style, sourceType, fields);
  }, [style, sourceType, fields]);

  // Reusable field input
  const Field = (props: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    invalid?: boolean;
  }) => (
    <div className="space-y-1">
      <Label htmlFor={props.id} className="text-xs">{props.label}</Label>
      <Input
        id={props.id}
        value={props.value}
        type={props.type ?? "text"}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={`h-8 text-xs ${props.invalid ? "border-red-500" : ""}`}
      />
    </div>
  );

  // Show/hide fields based on source type
  const showField = (key: string): boolean => {
    const map: Record<SourceType, string[]> = {
      book: ["authors", "year", "title", "edition", "publisher", "publisherLocation", "doi"],
      "journal-article": ["authors", "year", "title", "journal", "volume", "issue", "pages", "doi"],
      website: ["authors", "year", "title", "siteName", "url", "accessedDate"],
      newspaper: ["authors", "year", "title", "journal", "dayMonth", "pages", "url"],
      magazine: ["authors", "year", "title", "journal", "dayMonth", "pages", "url"],
      "conference-paper": ["authors", "year", "title", "conference", "publisher", "pages", "doi"],
      thesis: ["authors", "year", "title", "university", "city", "doi"],
    };
    return map[sourceType].includes(key);
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cit-style" className="text-xs">Citation style</Label>
              <select
                id="cit-style"
                value={style}
                onChange={(e) => setStyle(e.target.value as CitationStyle)}
                className="h-8 text-xs w-full rounded border bg-background px-2"
              >
                {STYLES.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cit-type" className="text-xs">Source type</Label>
              <select
                id="cit-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="h-8 text-xs w-full rounded border bg-background px-2"
              >
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cit-authors" className="text-xs">
              Authors (one per line or semicolon-separated; "Last, First" or "First Last")
            </Label>
            <Textarea
              id="cit-authors"
              value={authorsText}
              onChange={(e) => setAuthorsText(e.target.value)}
              placeholder={"Smith, John\nDoe, Jane"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="cit-title" label="Title" value={title} onChange={setTitle} placeholder="Book/article title" />
            <Field id="cit-year" label="Year" value={year} onChange={setYear} placeholder="2024" invalid={year !== "" && !yearValid} />
            {showField("edition") && <Field id="cit-edition" label="Edition" value={edition} onChange={setEdition} placeholder="2nd" />}
            {showField("publisher") && <Field id="cit-publisher" label="Publisher" value={publisher} onChange={setPublisher} placeholder="Scribner" />}
            {showField("publisherLocation") && <Field id="cit-loc" label="Publisher location" value={publisherLocation} onChange={setPublisherLocation} placeholder="New York" />}
            {showField("journal") && <Field id="cit-journal" label={sourceType === "newspaper" ? "Newspaper" : sourceType === "magazine" ? "Magazine" : "Journal"} value={journal} onChange={setJournal} placeholder="Nature" />}
            {showField("volume") && <Field id="cit-vol" label="Volume" value={volume} onChange={setVolume} placeholder="10" />}
            {showField("issue") && <Field id="cit-issue" label="Issue" value={issue} onChange={setIssue} placeholder="2" />}
            {showField("pages") && <Field id="cit-pages" label="Pages" value={pages} onChange={setPages} placeholder="1-25" />}
            {showField("siteName") && <Field id="cit-site" label="Site name" value={siteName} onChange={setSiteName} placeholder="Example.com" />}
            {showField("url") && <Field id="cit-url" label="URL" value={url} onChange={setUrl} placeholder="https://example.com" />}
            {showField("accessedDate") && <Field id="cit-accessed" label="Accessed date" value={accessedDate} onChange={setAccessedDate} placeholder="YYYY-MM-DD" type="text" />}
            {showField("doi") && <Field id="cit-doi" label="DOI" value={doi} onChange={setDoi} placeholder="10.1234/abc" invalid={doi !== "" && !doiValid} />}
            {showField("conference") && <Field id="cit-conf" label="Conference" value={conference} onChange={setConference} placeholder="ICML 2024" />}
            {showField("university") && <Field id="cit-uni" label="University" value={university} onChange={setUniversity} placeholder="MIT" />}
            {showField("city") && <Field id="cit-city" label="City" value={city} onChange={setCity} placeholder="Cambridge" />}
            {showField("dayMonth") && <Field id="cit-daymonth" label="Day Month" value={dayMonth} onChange={setDayMonth} placeholder="15 Mar." />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add to bibliography
            </Button>
            <ClearButton onClick={handleClearForm} label="Clear form" />
            <ShareButton getUrl={handleShareCurrent} />
            {doi && !doiValid && <Badge variant="destructive" className="text-[10px]">Invalid DOI</Badge>}
            {year && !yearValid && <Badge variant="destructive" className="text-[10px]">Invalid year</Badge>}
          </div>
        </CardContent>
      </Card>

      {(preview || previewInText) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Quote className="h-4 w-4" /> Live preview ({STYLE_LABELS[style]})
            </h3>
            {preview && (
              <div className="rounded border bg-background px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words">
                {stripMarkdown(preview)}
              </div>
            )}
            {previewInText && (
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold">In-text:</span>{" "}
                <span className="font-mono text-foreground">{previewInText}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {bibliography.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListOrdered className="h-4 w-4" /> Bibliography ({bibliography.length})
              </h3>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSort}
                  onChange={(e) => setAutoSort(e.target.checked)}
                />
                Sort alphabetically
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total" value={stats.total} />
              <Stat label="APA" value={stats.byStyle.apa} />
              <Stat label="MLA" value={stats.byStyle.mla} />
              <Stat label="Other" value={stats.byStyle.chicago + stats.byStyle.harvard} />
            </div>

            <div className="space-y-1 max-h-[500px] overflow-auto">
              {sortedBib.map((e, i) => (
                <div key={e.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[e.style]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{SOURCE_TYPE_LABELS[e.sourceType]}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">#{i + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setBibliography((prev) => prev.filter((b) => b.id !== e.id))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="font-mono break-words">{stripMarkdown(e.formatted)}</div>
                  <div className="text-[10px] text-muted-foreground">In-text: <span className="font-mono">{e.inText}</span></div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton getText={() => textOut} label="Copy text" />
              <DownloadButton getText={() => textOut} filename="bibliography.txt" mime="text/plain" label="Download .txt" />
              <DownloadButton getText={() => htmlOut} filename="bibliography.html" mime="text/html" label="Download HTML" />
              <DownloadButton getText={() => mdOut} filename="bibliography.md" mime="text/markdown" label="Download MD" />
              <DownloadButton getText={() => csvOut} filename="bibliography.csv" mime="text/csv" label="Download CSV" />
              <ClearButton onClick={handleClearBib} label="Clear bibliography" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Build your bibliography"
          hint="Fill in the fields above, pick a citation style and source type, then click 'Add to bibliography'. Preview shows live formatting. Multiple downloads supported: .txt, .html, .md, .csv."
          icon={<BookOpen className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{STYLE_LABELS[h.style]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{SOURCE_TYPE_LABELS[h.sourceType]}</Badge>
                  <span className="font-mono">{h.title}</span>
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
            <strong className="text-foreground">Privacy:</strong> All citation generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
