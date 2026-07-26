"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { generateSignature, supportedSocialTypes, socialLabel, type SignatureInput, type SocialLink, type SignatureResult } from "./logic";

const SOCIAL_TYPES = supportedSocialTypes();

export default function EmailSignatureGenerator() {
  const [name, setName] = useState("Jane Doe");
  const [title, setTitle] = useState("Senior Engineer");
  const [company, setCompany] = useState("Acme Inc");
  const [email, setEmail] = useState("jane@acme.com");
  const [phone, setPhone] = useState("+1 555 0100");
  const [website, setWebsite] = useState("https://acme.com");
  const [address, setAddress] = useState("100 Market St, San Francisco, CA");
  const [tagline, setTagline] = useState("Building delightful tools");
  const [photoUrl, setPhotoUrl] = useState("");
  const [accent, setAccent] = useState("#2563eb");
  const [social, setSocial] = useState<SocialLink[]>([{ type: "linkedin", url: "https://linkedin.com/in/jane" }]);
  const [result, setResult] = useState<SignatureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateSocial = useCallback((idx: number, patch: Partial<SocialLink>) => {
    setSocial((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }, []);
  const addSocial = useCallback(() => {
    setSocial((prev) => [...prev, { type: "website", url: "" }]);
  }, []);
  const removeSocial = useCallback((idx: number) => {
    setSocial((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const run = useCallback(() => {
    const cfg: SignatureInput = {
      name, title, company, email, phone, website, address, tagline, photoUrl, accentColor: accent,
      social: social.filter((s) => s.url.trim().length > 0),
    };
    const r = generateSignature(cfg);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [name, title, company, email, phone, website, address, tagline, photoUrl, accent, social]);

  const sample = useCallback(() => {
    setName("John Smith"); setTitle("Product Manager"); setCompany("Globex");
    setEmail("john@globex.com"); setPhone("+44 20 7946 0958"); setWebsite("https://globex.com");
    setTagline("Customer-obsessed product builder"); setAccent("#0ea5e9");
    setSocial([{ type: "twitter", url: "https://twitter.com/john" }, { type: "github", url: "https://github.com/john" }]);
  }, []);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} aria-label="Website" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Address" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Tagline</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} aria-label="Tagline" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Photo URL (optional)</Label>
              <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} aria-label="Photo URL" placeholder="https://…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Accent colour</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 rounded border border-input" aria-label="Accent colour" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Accent hex" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Social links</Label>
            <div className="space-y-2">
              {social.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={s.type}
                    onChange={(e) => updateSocial(i, { type: e.target.value as SocialLink["type"] })}
                    aria-label="Social type"
                  >
                    {SOCIAL_TYPES.map((t) => <option key={t} value={t}>{socialLabel(t)}</option>)}
                  </select>
                  <Input value={s.url} onChange={(e) => updateSocial(i, { url: e.target.value })} placeholder="https://…" aria-label="Social URL" className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => removeSocial(i)}>Remove</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addSocial}>Add link</Button>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Generate signature</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="border border-border rounded p-4 bg-white" dangerouslySetInnerHTML={{ __html: result.html }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">HTML (table-based — most compatible)</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3 max-h-60 overflow-auto">{result.html}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">HTML (inline-CSS variant)</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3 max-h-60 overflow-auto">{result.htmlInline}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Plain text</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3">{result.text}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export signature</p>
              <div className="flex gap-2 flex-wrap">
                <CopyButton getText={() => result.html} label="Copy table HTML" />
                <CopyButton getText={() => result.htmlInline} label="Copy inline HTML" />
                <CopyButton getText={() => result.text} label="Copy text" />
                <DownloadButton getText={() => result.html} filename="email-signature.html" mime="text/html" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
