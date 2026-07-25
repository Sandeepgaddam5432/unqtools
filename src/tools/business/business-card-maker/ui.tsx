"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { computeLayout, validateInput, toVCard, toPlainText, DEFAULT_INPUT, type CardInput } from "./logic";

export default function BusinessCardMaker() {
  const [input, setInput] = useState<CardInput>({ ...DEFAULT_INPUT });
  const validation = useMemo(() => validateInput(input), [input]);
  const layout = useMemo(() => computeLayout(input.layout), [input.layout]);
  const vcard = useMemo(() => toVCard(input), [input]);
  const text = useMemo(() => toPlainText(input), [input]);

  const patch = (p: Partial<CardInput>) => setInput((prev) => ({ ...prev, ...p }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Layout</Label>
            <select value={input.layout} onChange={(e) => patch({ layout: e.target.value as CardInput["layout"] })} className="mt-1 w-full h-9 text-sm rounded border bg-background px-2">
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name" value={input.name} onChange={(v) => patch({ name: v })} />
            <Field label="Title" value={input.title} onChange={(v) => patch({ title: v })} />
            <Field label="Company" value={input.company} onChange={(v) => patch({ company: v })} />
            <Field label="Email" value={input.email} onChange={(v) => patch({ email: v })} />
            <Field label="Phone" value={input.phone} onChange={(v) => patch({ phone: v })} />
            <Field label="Website" value={input.website} onChange={(v) => patch({ website: v })} />
            <div className="col-span-2">
              <Field label="Address" value={input.address} onChange={(v) => patch({ address: v })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Accent color</Label>
              <input type="color" value={input.accent} onChange={(e) => patch({ accent: e.target.value })} className="mt-1 h-9 w-full rounded border" />
            </div>
          </div>
          {!validation.ok && <ErrorBanner message={validation.errors.join("; ")} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Preview ({layout.widthMm}×{layout.heightMm} mm)</p>
            <div className="flex gap-2">
              <CopyButton getText={() => vcard} label="Copy vCard" />
              <DownloadButton getText={() => vcard} filename="contact.vcf" mime="text/vcard" label="Download vCard" />
              <DownloadButton getText={() => text} filename="card.txt" label="Text" />
            </div>
          </div>
          <div
            className="mx-auto rounded-md shadow-md overflow-hidden"
            style={{ width: 360, height: 200, background: "#fff", color: "#111" }}
          >
            <div className="h-2 w-full" style={{ background: input.accent }} />
            <div className="p-5 space-y-1" style={{ fontFamily: "sans-serif" }}>
              <p className="text-lg font-bold">{input.name || "—"}</p>
              <p className="text-sm" style={{ color: input.accent }}>{input.title}</p>
              <p className="text-sm font-medium">{input.company}</p>
              <div className="text-[11px] text-gray-600 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span>{input.email}</span>
                <span>{input.phone}</span>
                <span>{input.website}</span>
                <span className="col-span-2">{input.address}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">{input.layout}</Badge>
            <Badge variant="outline" className="text-[10px]">{layout.safeMarginMm}mm safe margin</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all generation runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-8 text-xs" />
    </div>
  );
}
