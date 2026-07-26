"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  generateCitation,
  inTextCitation,
  validateSource,
  buildBibliography,
  sampleSource,
  STYLES,
  SOURCE_TYPES,
  type Author,
  type Source,
  type SourceType,
  type CitationStyle,
} from "./logic";

const EMPTY_SOURCE: Source = {
  type: "book",
  authors: [{ firstName: "", lastName: "" }],
  title: "",
  year: new Date().getFullYear(),
  publisher: "",
  journal: "",
  volume: undefined,
  issue: undefined,
  pages: "",
  url: "",
  accessedDate: "",
  publishedDate: "",
  city: "",
  edition: undefined,
  doi: "",
  conference: "",
  location: "",
};

export default function TextBibliographyCitation() {
  const [source, setSource] = useState<Source>({ ...sampleSource() });
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [showAllStyles, setShowAllStyles] = useState(true);
  const [bibliography, setBibliography] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const updateField = <K extends keyof Source>(key: K, value: Source[K]) => {
    setSource((s) => ({ ...s, [key]: value }));
  };

  const updateAuthor = (idx: number, field: keyof Author, value: string) => {
    setSource((s) => {
      const next = [...s.authors];
      next[idx] = { ...next[idx]!, [field]: value };
      return { ...s, authors: next };
    });
  };

  const addAuthor = () => {
    setSource((s) => ({ ...s, authors: [...s.authors, { firstName: "", lastName: "" }] }));
  };

  const removeAuthor = (idx: number) => {
    setSource((s) => ({ ...s, authors: s.authors.filter((_, i) => i !== idx) }));
  };

  const citation = useMemo(() => generateCitation(source, style), [source, style]);
  const inText = useMemo(() => inTextCitation(source, style), [source, style]);
  const validation = useMemo(() => validateSource(source), [source]);

  const allCitations = useMemo(() => {
    return STYLES.map((s) => ({ style: s.value, label: s.label, citation: generateCitation(source, s.value) }));
  }, [source]);

  const addToBibliography = useCallback(() => {
    const v = validateSource(source);
    if (!v.ok) {
      setError(v.reason ?? "Source is invalid.");
      setNotice(null);
      return;
    }
    setError(null);
    setBibliography((b) => [...b, { ...source, authors: source.authors.map((a) => ({ ...a })) }]);
    setNotice("Added to bibliography.");
  }, [source]);

  const buildBib = useCallback(() => {
    if (bibliography.length === 0) {
      setError("Bibliography is empty — add at least one source.");
      return;
    }
    setError(null);
    setNotice(`Bibliography rebuilt with ${bibliography.length} sources in ${style.toUpperCase()} style.`);
  }, [bibliography, style]);

  const bibLines = useMemo(() => buildBibliography(bibliography, style), [bibliography, style]);

  const loadSample = () => {
    setSource({ ...sampleSource() });
    setError(null);
    setNotice("Loaded sample source.");
  };

  const clearAll = () => {
    setSource({ ...EMPTY_SOURCE });
    setBibliography([]);
    setError(null);
    setNotice(null);
  };

  const bibText = useMemo(() => bibLines.map((l, i) => `${i + 1}. ${l}`).join("\n\n"), [bibLines]);

  const allCitationsText = useMemo(
    () => allCitations.map((c) => `[${c.label}]\n${c.citation}`).join("\n\n"),
    [allCitations],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Source type</Label>
              <select
                value={source.type}
                onChange={(e) => updateField("type", e.target.value as SourceType)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Citation style</Label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as CitationStyle)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Input
                type="number"
                value={source.year}
                onChange={(e) => updateField("year", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Authors</Label>
              <Button size="sm" variant="outline" onClick={addAuthor}>+ Add author</Button>
            </div>
            <div className="space-y-2">
              {source.authors.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="First name"
                    value={a.firstName}
                    onChange={(e) => updateAuthor(i, "firstName", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Last name"
                    value={a.lastName}
                    onChange={(e) => updateAuthor(i, "lastName", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeAuthor(i)}
                    disabled={source.authors.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={source.title} onChange={(e) => updateField("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {source.type === "book" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Publisher</Label>
                  <Input value={source.publisher ?? ""} onChange={(e) => updateField("publisher", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={source.city ?? ""} onChange={(e) => updateField("city", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Edition</Label>
                  <Input
                    type="number"
                    value={source.edition ?? ""}
                    onChange={(e) => updateField("edition", e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </>
            )}
            {source.type === "journal" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Journal</Label>
                  <Input value={source.journal ?? ""} onChange={(e) => updateField("journal", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Volume</Label>
                  <Input
                    type="number"
                    value={source.volume ?? ""}
                    onChange={(e) => updateField("volume", e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Issue</Label>
                  <Input
                    type="number"
                    value={source.issue ?? ""}
                    onChange={(e) => updateField("issue", e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </>
            )}
            {source.type === "website" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Site name (publisher)</Label>
                  <Input value={source.publisher ?? ""} onChange={(e) => updateField("publisher", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">URL</Label>
                  <Input value={source.url ?? ""} onChange={(e) => updateField("url", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Accessed date</Label>
                  <Input
                    type="date"
                    value={source.accessedDate ?? ""}
                    onChange={(e) => updateField("accessedDate", e.target.value)}
                  />
                </div>
              </>
            )}
            {source.type === "newspaper" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Newspaper</Label>
                  <Input value={source.publisher ?? ""} onChange={(e) => updateField("publisher", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Published date</Label>
                  <Input
                    type="date"
                    value={source.publishedDate ?? ""}
                    onChange={(e) => updateField("publishedDate", e.target.value)}
                  />
                </div>
              </>
            )}
            {source.type === "conference" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Conference</Label>
                  <Input value={source.conference ?? ""} onChange={(e) => updateField("conference", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Input value={source.location ?? ""} onChange={(e) => updateField("location", e.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Pages (e.g. 45-67)</Label>
              <Input value={source.pages ?? ""} onChange={(e) => updateField("pages", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">DOI (e.g. 10.1000/xyz)</Label>
              <Input value={source.doi ?? ""} onChange={(e) => updateField("doi", e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={addToBibliography}>Add to bibliography</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAllStyles((v) => !v)}>
              {showAllStyles ? "Hide" : "Show"} all styles
            </Button>
            <Button size="sm" variant="ghost" onClick={loadSample}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear all</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      {notice && !error && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{notice}</div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Citation ({STYLES.find((s) => s.value === style)?.label})
            </CardTitle>
            <div className="flex gap-2">
              <CopyButton getText={() => citation} />
              <DownloadButton getText={() => citation} filename={`citation-${style}.txt`} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 pt-0">
            <pre className="text-sm whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono">{citation}</pre>
            <div>
              <Label className="text-xs text-muted-foreground">In-text citation</Label>
              <pre className="mt-1 text-sm whitespace-pre-wrap rounded-md bg-muted/20 p-2 font-mono">{inText}</pre>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant={validation.ok ? "outline" : "destructive"}>
                {validation.ok ? "Valid source" : `Invalid: ${validation.reason}`}
              </Badge>
              <Badge variant="outline">{source.authors.length} author(s)</Badge>
              <Badge variant="outline">Type: {source.type}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {showAllStyles && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">All styles comparison</CardTitle>
              <CopyButton getText={() => allCitationsText} label="Copy all" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 p-4 pt-0">
              {allCitations.map((c) => (
                <div key={c.style} className="rounded-md border border-border/50 bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">{c.label}</div>
                  <p className="text-sm whitespace-pre-wrap break-words font-mono">{c.citation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Bibliography ({bibliography.length})</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={buildBib} disabled={bibliography.length === 0}>
                Rebuild
              </Button>
              <CopyButton getText={() => bibText} disabled={bibliography.length === 0} />
              <DownloadButton
                getText={() => bibText}
                filename={`bibliography-${style}.txt`}
                disabled={bibliography.length === 0}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 pt-0 space-y-2">
            {bibliography.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sources added yet. Fill the form and click “Add to bibliography”.</p>
            ) : (
              bibLines.map((l, i) => (
                <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm font-mono whitespace-pre-wrap break-words">
                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                  {l}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all citation generation runs locally in your browser. No data is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
