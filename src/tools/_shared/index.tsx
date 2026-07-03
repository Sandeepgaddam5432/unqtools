"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, Share2, Trash2, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/** Copy button — copies text to clipboard with toast feedback. */
export function CopyButton({
  getText,
  label = "Copy",
  successLabel = "Copied!",
  disabled,
  size = "sm",
}: {
  getText: () => string | Promise<string>;
  label?: string;
  successLabel?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
}) {
  const [done, setDone] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      const text = await getText();
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success(successLabel);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [getText, successLabel]);

  return (
    <Button variant="outline" size={size} onClick={handleCopy} disabled={disabled} className="gap-1.5">
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? successLabel : label}
    </Button>
  );
}

/** Download button — triggers a browser download for a string. */
export function DownloadButton({
  getText,
  filename,
  label = "Download",
  disabled,
  mime = "text/plain",
  size = "sm",
}: {
  getText: () => string | Promise<string>;
  filename: string;
  label?: string;
  disabled?: boolean;
  mime?: string;
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
}) {
  const handleDownload = useCallback(async () => {
    try {
      const text = await getText();
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${filename}`);
    } catch {
      toast.error("Could not download file");
    }
  }, [getText, filename, mime]);

  return (
    <Button variant="outline" size={size} onClick={handleDownload} disabled={disabled} className="gap-1.5">
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

/** Share link button — copies a shareable URL to clipboard. */
export function ShareButton({
  getUrl,
  label = "Share link",
  disabled,
  size = "sm",
}: {
  getUrl: () => string | Promise<string>;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
}) {
  const handleShare = useCallback(async () => {
    try {
      const url = await getUrl();
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not copy share link");
    }
  }, [getUrl]);

  return (
    <Button variant="ghost" size={size} onClick={handleShare} disabled={disabled} className="gap-1.5">
      <Share2 className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

/** Clear button — clears state via callback. */
export function ClearButton({
  onClick,
  disabled,
  label = "Clear",
  size = "sm",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
}) {
  return (
    <Button variant="ghost" size={size} onClick={onClick} disabled={disabled} className="gap-1.5">
      <Trash2 className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

/** Run button — primary action button. */
export function RunButton({
  onClick,
  disabled,
  label = "Run",
  loading = false,
  size = "sm",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  loading?: boolean;
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
}) {
  return (
    <Button size={size} onClick={onClick} disabled={disabled || loading} className="gap-1.5">
      {loading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {loading ? "Working…" : label}
    </Button>
  );
}

/** Error banner — friendly error display. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/** Empty state — shown when output is empty. */
export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center min-h-[120px]">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Action bar — container for Run/Copy/Download/Reset buttons. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
