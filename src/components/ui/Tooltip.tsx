/**
 * Tooltip — lightweight, hover/focus driven, accessible.
 * Renders inline; uses position:absolute relative to a wrapper span.
 */
import type { JSX } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";

export interface TooltipProps {
  text: string;
  children: JSX.Element;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ text, children, side = "top", delay = 300 }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onEnter() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(true), delay);
  }
  function onLeave() {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }

  const sideClass =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : side === "bottom"
        ? "top-full left-1/2 -translate-x-1/2 mt-2"
        : side === "left"
          ? "right-full top-1/2 -translate-y-1/2 mr-2"
          : "left-full top-1/2 -translate-y-1/2 ml-2";

  return (
    <span
      class="relative inline-flex"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          class={`absolute z-50 ${sideClass} bg-unq-text text-unq-bg pointer-events-none whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium shadow-md`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
