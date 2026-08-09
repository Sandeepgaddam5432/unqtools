"use client";

/** Create PDF Form (Builder) — real UI. */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSignature, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { buildForm, type FieldKind, type FieldSpec } from "./logic";

const KIND_LABELS: Record<FieldKind, string> = {
  text: "Text input",
  checkbox: "Checkbox",
  radio: "Radio group",
  dropdown: "Dropdown",
};

export default function FormBuilder() {
  const [fields, setFields] = useState<FieldSpec[]>([{ kind: "text", label: "Full name" }]);
  const [title, setTitle] = useState("Untitled Form");
  const [margin, setMargin] = useState("48");
  const [fontSize, setFontSize] = useState("12");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  function addField(kind: FieldKind) {
    setFields((prev) => [...prev, { kind, label: `Field ${prev.length + 1}` }]);
    setResult(null);
  }

  function update(i: number, patch: Partial<FieldSpec>) {
    setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    setResult(null);
  }

  function remove(i: number) {
    setFields((prev) => prev.filter((_, j) => j !== i));
    setResult(null);
  }

  async function run() {
    if (fields.length === 0) {
      setError("Add at least one field.");
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    setReport("");
    const r = await buildForm({ fields, title: title || undefined, margin: Number(margin) || 48, fontSize: Number(fontSize) || 12 });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setReport(`${r.output.fieldsCreated} field(s) · ${r.output.pagesUsed} page(s)`);
      toast.success("Form created!");
    } else {
      setError(r.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="fb-title">Form title</Label>
          <Input id="fb-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fb-margin">Margin (pt)</Label>
          <Input id="fb-margin" type="number" min={20} max={100} value={margin} onChange={(e) => setMargin(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fb-size">Font size</Label>
          <Input id="fb-size" type="number" min={8} max={20} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
        </div>
      </div>

      {/* Field list */}
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground w-24 shrink-0">{KIND_LABELS[f.kind]}</span>
              <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" className="flex-1" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove field" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {(f.kind === "radio" || f.kind === "dropdown") && (
              <Input
                value={(f.options ?? []).join(", ")}
                onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="Options, comma separated"
                className="text-sm"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => addField("text")}>
          <Plus className="h-3.5 w-3.5" /> Text
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => addField("checkbox")}>
          <Plus className="h-3.5 w-3.5" /> Checkbox
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => addField("radio")}>
          <Plus className="h-3.5 w-3.5" /> Radio
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => addField("dropdown")}>
          <Plus className="h-3.5 w-3.5" /> Dropdown
        </Button>
      </div>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={fields.length === 0} loading={working} label="Create PDF form" />
        <ClearButton onClick={() => { setFields([]); setResult(null); setError(""); setReport(""); }} disabled={fields.length === 0 && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <FileSignature className="h-4 w-4" /> Form ready • {formatBytes(result.length)}
            </p>
            {report && <p className="text-xs text-muted-foreground mt-0.5">{report}</p>}
          </div>
          <Button onClick={() => downloadBytes(result, `${(title || "form").replace(/[^\w]+/g, "-").toLowerCase()}.pdf`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — the form is generated entirely in your browser. Fields are interactive (fillable in any PDF viewer).
      </p>
    </div>
  );
}
