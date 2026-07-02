/**
 * CopyButton — copy-to-clipboard with success feedback + toast.
 */
import { useState } from "preact/hooks";
import { Check, Copy } from "lucide-preact";
import { Button, type ButtonProps } from "./Button";
import { toast } from "./Toast";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  getText: () => string | Promise<string>;
  label?: string;
  successLabel?: string;
  successToast?: string;
}

export function CopyButton({
  getText,
  label = "Copy",
  successLabel = "Copied",
  successToast,
  variant = "secondary",
  size = "sm",
  ...rest
}: CopyButtonProps) {
  const [done, setDone] = useState(false);

  async function onCopy() {
    try {
      const text = await getText();
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers / non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setDone(true);
      if (successToast) toast(successToast, "success");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast("Could not copy to clipboard", "error");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onCopy}
      icon={done ? <Check size={14} /> : <Copy size={14} />}
      {...rest}
    >
      {done ? successLabel : label}
    </Button>
  );
}

/**
 * DownloadButton — triggers a browser file download for text content.
 */
import { Download } from "lucide-preact";

export interface DownloadButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  filename: string;
  getText: () => string | Promise<string>;
  mime?: string;
  label?: string;
}

export function DownloadButton({
  filename,
  getText,
  mime = "text/plain",
  label = "Download",
  variant = "secondary",
  size = "sm",
  ...rest
}: DownloadButtonProps) {
  async function onDownload() {
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
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onDownload}
      icon={<Download size={14} />}
      {...rest}
    >
      {label}
    </Button>
  );
}

/**
 * ShareButton — uses Web Share API when available, falls back to copy-link.
 */
import { Share2 } from "lucide-preact";

export interface ShareButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  url?: string;
  title?: string;
  text?: string;
  label?: string;
}

export function ShareButton({
  url,
  title,
  text,
  label = "Share",
  variant = "secondary",
  size = "sm",
  ...rest
}: ShareButtonProps) {
  async function onShare() {
    const shareUrl = url ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl, title, text });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast("Link copied to clipboard", "success");
      } catch {
        toast("Could not share", "error");
      }
    }
  }

  return (
    <Button variant={variant} size={size} onClick={onShare} icon={<Share2 size={14} />} {...rest}>
      {label}
    </Button>
  );
}

/**
 * ErrorBanner — friendly error display with role=alert.
 */
import { AlertCircle } from "lucide-preact";
import type { JSX } from "preact";

export interface ErrorBannerProps {
  message: string;
  title?: string;
  children?: JSX.Element;
}

export function ErrorBanner({
  message,
  title = "Something went wrong",
  children,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      class="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4"
    >
      <AlertCircle size={18} class="mt-0.5 shrink-0 text-danger" />
      <div class="flex-1">
        <p class="text-sm font-medium text-danger">{title}</p>
        <p class="mt-0.5 text-sm text-fg-muted">{message}</p>
        {children}
      </div>
    </div>
  );
}
