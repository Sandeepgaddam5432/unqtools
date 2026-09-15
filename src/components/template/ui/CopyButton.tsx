"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/template-utils";

interface Props {
  /** Static text to copy. For dynamic text use the getText variant below. */
  text?: string;
  /** Alternative: provide a function to lazy-resolve the text to copy. */
  getText?: () => string;
  iconOnly?: boolean;
  className?: string;
  label?: string;
  successLabel?: string;
}

export default function CopyButton({
  text,
  getText,
  iconOnly = false,
  className,
  label = "Copy",
  successLabel = "Copied",
}: Props) {
  const [done, setDone] = useState(false);

  const handle = useCallback(async () => {
    try {
      const value = getText ? getText() : (text ?? "");
      if (!value) return;
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* noop — clipboard might be unavailable */
    }
  }, [text, getText]);

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={done ? successLabel : label}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-white/75 transition-all",
        "hover:bg-white/[0.12] hover:text-white",
        done && "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-200",
        className
      )}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {!iconOnly && <span>{done ? successLabel : label}</span>}
    </button>
  );
}
