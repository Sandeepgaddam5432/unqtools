"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Check, Clock, AlertCircle, Calendar, User, MapPin, MessageSquare, Award, Briefcase, GraduationCap, Heart } from "lucide-react";

const timelineVariants = cva("relative flex flex-col", {
  variants: {
    variant: { default: "gap-4", compact: "gap-2", spacious: "gap-8" },
    orientation: { vertical: "flex-col", horizontal: "flex-row" },
  },
  defaultVariants: { variant: "default", orientation: "vertical" },
});

const timelineItemVariants = cva("relative flex gap-3 pb-2", {
  variants: {
    orientation: { vertical: "flex-row", horizontal: "flex-col min-w-64 shrink-0" },
  },
  defaultVariants: { orientation: "vertical" },
});

export type TimelineStatus = "completed" | "in-progress" | "pending" | "error";

export interface TimelineItemData {
  id: string;
  title: string;
  description?: string;
  date?: string;
  status?: TimelineStatus;
  icon?: React.ElementType;
  metadata?: Record<string, string>;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof timelineVariants> {
  items: TimelineItemData[];
  showConnector?: boolean;
  onItemClick?: (item: TimelineItemData) => void;
}

const statusConfig: Record<TimelineStatus, { icon: React.ElementType; color: string; bgColor: string }> = {
  completed: { icon: Check, color: "text-green-500", bgColor: "bg-green-500/10" },
  "in-progress": { icon: Clock, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  pending: { icon: AlertCircle, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  error: { icon: AlertCircle, color: "text-red-500", bgColor: "bg-red-500/10" },
};

export function Timeline({
  items,
  className,
  variant,
  orientation = "vertical",
  showConnector = true,
  onItemClick,
  ...props
}: TimelineProps) {
  return (
    <div className={cn(timelineVariants({ variant, orientation }), className)} {...props}>
      {items.map((item, index) => {
        const status = item.status || "pending";
        const config = statusConfig[status];
        const Icon = item.icon || config.icon;
        const isLast = index === items.length - 1;

        return (
          <div
            key={item.id}
            className={cn(timelineItemVariants({ orientation }), onItemClick && "cursor-pointer")}
            onClick={() => onItemClick?.(item)}
          >
            {/* Indicator */}
            <div className="flex flex-col items-center">
              <div className={cn("flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0", config.bgColor, config.color, "border-current/20")}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && showConnector && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                {item.date && <span className="text-xs text-muted-foreground">{item.date}</span>}
              </div>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              )}
              {item.metadata && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <span key={key} className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
