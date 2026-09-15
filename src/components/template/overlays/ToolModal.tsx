"use client";

import { ArrowLeft, ExternalLink, Star, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/template-utils";
import type { FlatTool } from "@/lib/template-data";

interface Props {
  tool: FlatTool | null;
  onClose: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
}

/**
 * Full-screen overlay that launches a tool inline.
 *
 * The real tool component lives at `/tools/[id]` (lazy-loaded in
 * `tool-page-client.tsx`). Here we mirror the TOOL_UI_LOADERS map
 * exactly so the dashboard version is identical — except rendering
 * inside a modal instead of a route.
 *
 * If we don't have a loader for the tool, we fall back to linking
 * the user to the actual `/tools/[id]` page.
 */
const TOOL_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "json-formatter": () => import("@/tools/developer/json-formatter/ui"),
  base64: () => import("@/tools/developer/base64/ui"),
  "hash-generator": () => import("@/tools/developer/hash-generator/ui"),
  "url-encoder": () => import("@/tools/developer/url-encoder/ui"),
  "uuid-generator": () => import("@/tools/developer/uuid-generator/ui"),
  "color-picker": () => import("@/tools/image/color-picker/ui"),
  "image-resizer": () => import("@/tools/image/image-resizer/ui"),
  "image-compressor": () => import("@/tools/image/image-compressor/ui"),
  "word-character-counter": () => import("@/tools/text/word-character-counter/ui"),
  "case-converter": () => import("@/tools/text/case-converter/ui"),
  "password-generator": () => import("@/tools/network-security/password-generator/ui"),
  "totp-generator": () => import("@/tools/network-security/totp-generator/ui"),
  "qr-code-generator-image": () => import("@/tools/image/qr-code-generator-image/ui"),
};

export default function ToolModal({ tool, onClose, isFav, onToggleFav }: Props) {
  const [Loaded, setLoaded] = useState<React.ComponentType | null>(null);
  const [errored, setErrored] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!tool) {
      setLoaded(null);
      setErrored(false);
      return;
    }
    const loader = TOOL_LOADERS[tool.id];
    if (!loader) {
      setLoaded(null);
      setErrored(false);
      return;
    }
    let cancelled = false;
    setLoaded(null);
    setErrored(false);
    loader()
      .then((mod) => {
        if (!cancelled) setLoaded(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tool?.id]);

  // Esc to close
  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, onClose]);

  // Lock scroll
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = tool ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [tool]);

  return (
    <AnimatePresence>
      {tool && <ToolBody key={tool.id} tool={tool} onClose={onClose} isFav={isFav} onToggleFav={onToggleFav} Loaded={Loaded} errored={errored} router={router} />}
    </AnimatePresence>
  );
}

function ToolBody({
  tool,
  onClose,
  isFav,
  onToggleFav,
  Loaded,
  errored,
  router,
}: {
  tool: FlatTool;
  onClose: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
  Loaded: React.ComponentType | null;
  errored: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const Icon: LucideIcon = tool.icon;
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        role="dialog"
        aria-modal="true"
        aria-label={tool.name}
        className="fixed inset-3 z-[60] flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e1320]/95 shadow-[0_60px_100px_-30px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:inset-6 md:inset-10"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0b1018]/85 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tool"
            className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/75 transition-colors hover:bg-white/[0.1]"
          >
            <ArrowLeft className="size-4 sm:hidden" />
            <X className="size-4 hidden sm:block" />
          </button>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl text-white shadow-md ring-1 ring-white/20 bg-gradient-to-br",
              tool.category.iconTile
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-bold tracking-tight">
                {tool.name}
              </h2>
              <span className="hidden shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/55 sm:inline">
                {tool.category.short}
              </span>
            </div>
            <p className="truncate text-[11.5px] text-white/45">
              {tool.blurb}
            </p>
          </div>
          {onToggleFav && (
            <button
              type="button"
              onClick={onToggleFav}
              aria-pressed={isFav}
              aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
              className={cn(
                "flex size-9 cursor-pointer items-center justify-center rounded-full border transition-colors",
                isFav
                  ? "border-amber-300/40 bg-amber-300/[0.1] text-amber-300"
                  : "border-white/[0.08] bg-white/[0.05] text-white/55 hover:bg-white/[0.1]"
              )}
            >
              <Star className={cn("size-4", isFav && "fill-current")} />
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(tool.href)}
            className="hidden cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-white/75 transition-colors hover:bg-white/[0.1] sm:flex"
          >
            <ExternalLink className="size-3.5" />
            Open page
          </button>
        </div>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {Loaded ? (
            <Loaded />
          ) : errored ? (
            <p className="rounded-2xl border border-red-400/30 bg-red-400/[0.08] p-4 text-[13px] text-red-300">
              Failed to load the tool UI. Try opening the full page.
            </p>
          ) : (
            <ToolLoading openExternal={() => router.push(tool.href)} />
          )}
        </div>
      </motion.div>
    </>
  );
}

function ToolLoading({ openExternal }: { openExternal: () => void }) {
  // No loader registered for this tool — give users a polished fallback.
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg">
        <ArrowLeft className="size-5 rotate-45" />
      </span>
      <p className="text-[14px] font-semibold">Inline preview unavailable</p>
      <p className="max-w-sm text-[12.5px] text-white/55">
        This tool hasn&apos;t been wired into the dashboard modal yet. Open the full
        page to use it.
      </p>
      <button
        type="button"
        onClick={openExternal}
        className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 px-4 py-2 text-[12px] font-semibold text-white shadow-md ring-1 ring-white/20 hover:opacity-90"
      >
        <ExternalLink className="size-3.5" />
        Open full tool
      </button>
    </div>
  );
}
