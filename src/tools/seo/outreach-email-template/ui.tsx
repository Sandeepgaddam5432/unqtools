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
  TEMPLATE_INFO,
  generateEmail,
  validateInput,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type OutreachInput,
  type TemplateType,
  type Tone,
  type HistoryEntry,
} from "./logic";
import { History, Mail, Clock, Type, Hash } from "lucide-react";

const TONES: { value: Tone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
];

export default function OutreachEmailTemplate() {
  const [input, setInput] = useState<OutreachInput>({
    template: "guest-post",
    tone: "friendly",
    recipientName: "",
    recipientSite: "",
    yourName: "",
    yourSite: "",
    yourEmail: "",
    topic: "",
    yourArticleTitle: "",
    theirArticleUrl: "",
    brokenLinkUrl: "",
    replacementUrl: "",
    customMessage: "",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed } as OutreachInput));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateInput(input), [input]);
  const email = useMemo(() => generateEmail(input), [input]);
  const activeTemplate = useMemo(
    () => TEMPLATE_INFO.find((t) => t.type === input.template),
    [input.template],
  );

  const update = useCallback(<K extends keyof OutreachInput>(key: K, val: string) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  }, []);

  const setTemplate = useCallback((t: string) => {
    setInput((prev) => ({ ...prev, template: t as TemplateType }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.ok) {
      saveHistory({
        ts: Date.now(),
        template: input.template,
        tone: input.tone,
        recipient: input.recipientName,
        snippet: email.subject.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [validation, input, email]);

  const handleClear = useCallback(() => {
    setInput({
      template: input.template,
      tone: input.tone,
      recipientName: "",
      recipientSite: "",
      yourName: "",
      yourSite: "",
      yourEmail: "",
      topic: "",
      yourArticleTitle: "",
      theirArticleUrl: "",
      brokenLinkUrl: "",
      replacementUrl: "",
      customMessage: "",
    });
    toast.info("Form cleared");
  }, [input.template, input.tone]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const showBrokenLinkFields = input.template === "broken-link";
  const showArticleFields = input.template === "guest-post" || input.template === "backlink-request";
  const showTheirArticleField = input.template === "backlink-request";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oet-template">Template</Label>
              <Select value={input.template} onValueChange={setTemplate}>
                <SelectTrigger id="oet-template"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_INFO.map((t) => (
                    <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oet-tone">Tone</Label>
              <Select value={input.tone} onValueChange={(v) => update("tone", v)}>
                <SelectTrigger id="oet-tone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeTemplate && (
            <p className="text-xs text-muted-foreground">{activeTemplate.description}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Your info</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oet-yourname">Your name *</Label>
              <Input
                id="oet-yourname"
                value={input.yourName}
                onChange={(e) => update("yourName", e.target.value)}
                placeholder="Alex Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oet-yoursite">Your site *</Label>
              <Input
                id="oet-yoursite"
                value={input.yourSite}
                onChange={(e) => update("yourSite", e.target.value)}
                placeholder="https://mysite.com"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="oet-youremail">Your email (optional)</Label>
              <Input
                id="oet-youremail"
                value={input.yourEmail}
                onChange={(e) => update("yourEmail", e.target.value)}
                placeholder="alex@mysite.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Recipient info</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oet-recipientname">Recipient name *</Label>
              <Input
                id="oet-recipientname"
                value={input.recipientName}
                onChange={(e) => update("recipientName", e.target.value)}
                placeholder="Sarah Lee"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oet-recipientsite">Recipient site *</Label>
              <Input
                id="oet-recipientsite"
                value={input.recipientSite}
                onChange={(e) => update("recipientSite", e.target.value)}
                placeholder="example-blog.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Email content</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="oet-topic">Topic *</Label>
              <Input
                id="oet-topic"
                value={input.topic}
                onChange={(e) => update("topic", e.target.value)}
                placeholder="Running tips for beginners"
              />
            </div>
            {showArticleFields && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="oet-articletitle">Your article title</Label>
                <Input
                  id="oet-articletitle"
                  value={input.yourArticleTitle}
                  onChange={(e) => update("yourArticleTitle", e.target.value)}
                  placeholder="The Beginner's Guide to Running"
                />
              </div>
            )}
            {showTheirArticleField && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="oet-theirarticle">Their article URL (where you want a link from)</Label>
                <Input
                  id="oet-theirarticle"
                  value={input.theirArticleUrl}
                  onChange={(e) => update("theirArticleUrl", e.target.value)}
                  placeholder="https://example-blog.com/running-article"
                />
              </div>
            )}
            {showBrokenLinkFields && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="oet-brokenlink">Broken link URL *</Label>
                  <Input
                    id="oet-brokenlink"
                    value={input.brokenLinkUrl}
                    onChange={(e) => update("brokenLinkUrl", e.target.value)}
                    placeholder="https://broken.example.com/page"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oet-replacement">Replacement URL (yours) *</Label>
                  <Input
                    id="oet-replacement"
                    value={input.replacementUrl}
                    onChange={(e) => update("replacementUrl", e.target.value)}
                    placeholder="https://mysite.com/article"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="oet-custom">Custom message (optional)</Label>
              <Textarea
                id="oet-custom"
                value={input.customMessage}
                onChange={(e) => update("customMessage", e.target.value)}
                placeholder="Any additional context or ask you want to include."
                className="min-h-[80px] text-xs resize-y"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {validation.errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
          {validation.errors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {validation.ok ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Subject line</Label>
                <CopyButton getText={() => email.subject} label="Copy subject" size="icon-sm" />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm font-medium">
                {email.subject}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Email body</Label>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return email.body; }}
                    label="Copy email"
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ input }); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {email.body}
              </pre>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Type className="h-3 w-3" /> {email.wordCount} words
                </span>
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3 w-3" /> {email.charCount} chars
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> ~{email.estimatedReadTime} min read
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Fill in the required fields to generate your email"
          hint="Pick a template, fill in your info and recipient info, then we'll generate the subject line and body. Required fields are marked with *."
          icon={<Mail className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.template}</Badge>
                  <Badge variant="outline" className="mr-2">{h.tone}</Badge>
                  <span className="text-muted-foreground">{h.snippet}</span>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Email
            generation is pure string manipulation. History is stored in
            localStorage on this device only. We don't send emails — copy the
            output into your mail client.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
