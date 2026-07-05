"use client";

import React from "react";
import { MotionConfig } from "framer-motion";

/**
 * Client wrapper for MotionConfig — needed because layout.tsx is a server
 * component and MotionConfig is a client component.
 *
 * reducedMotion="user" respects prefers-reduced-motion: reduce.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
