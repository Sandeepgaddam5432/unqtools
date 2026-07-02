/**
 * UnQTools UI — barrel export.
 *
 * Backwards-compatible with the original `ui.tsx` so existing tool UIs that
 * `import { Button, Input, Textarea, ... } from "../../../components/ui"`
 * keep working without changes. New code can also import from individual
 * files (`ui/Button`, `ui/Input`, etc.) for tree-shaking.
 */
export { Button, type ButtonProps } from "./ui/Button";
export { Input, type InputProps } from "./ui/Input";
export { Textarea, type TextareaProps } from "./ui/Textarea";
export { Select, type SelectProps, type SelectOption } from "./ui/Select";
export { Switch, Toggle, type SwitchProps } from "./ui/Switch";
export { Slider, type SliderProps } from "./ui/Slider";
export { Card, type CardProps } from "./ui/Card";
export { Badge, type BadgeProps } from "./ui/Badge";
export { Tabs, Segmented, type TabsProps, type SegmentedProps, type TabItem } from "./ui/Tabs";
export { Tooltip, type TooltipProps } from "./ui/Tooltip";
export { Dialog, type DialogProps } from "./ui/Dialog";
export { ToastContainer, toast, type ToastVariant } from "./ui/Toast";
export { Skeleton, EmptyState, type SkeletonProps, type EmptyStateProps } from "./ui/Skeleton";
export { FileDropzone, type FileDropzoneProps } from "./ui/FileDropzone";
export {
  CopyButton,
  DownloadButton,
  ShareButton,
  ErrorBanner,
  type CopyButtonProps,
  type DownloadButtonProps,
  type ShareButtonProps,
  type ErrorBannerProps,
} from "./ui/Actions";
export {
  Checkbox,
  RadioGroup,
  type CheckboxProps,
  type RadioGroupProps,
  type RadioOption,
} from "./ui/Checkbox";

// Re-export commonly used hooks for convenience
export { useState, useEffect, useRef, useMemo, useCallback } from "preact/hooks";
