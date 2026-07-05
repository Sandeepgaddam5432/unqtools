"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ShamayimToggleSwitch } from "@/components/ui/shamayim-toggle-switch";
import {
  MessageSquare,
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
  Sparkles,
  ThumbsUp,
  Zap,
  Shield,
  Volume2,
  Wifi,
  Bluetooth,
  Monitor,
  Moon,
  Sun,
  MousePointerClick,
  Touchpad,
} from "lucide-react";
import { toast } from "sonner";

// ===== ANIMATION VARIANTS =====
const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ===== ALERT BANNER SECTION =====
function AlertBannerSection() {
  const [alerts, setAlerts] = useState({
    default: true,
    success: true,
    destructive: true,
    warning: true,
  });

  const dismissAlert = (key: keyof typeof alerts) => {
    setAlerts((prev) => ({ ...prev, [key]: false }));
  };

  const resetAlerts = () => {
    setAlerts({ default: true, success: true, destructive: true, warning: true });
  };

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <AlertCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Alert Banners</CardTitle>
                <CardDescription>All 4 variants with dismiss functionality</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={resetAlerts} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence>
            {alerts.default && (
              <AlertBanner
                variant="default"
                title="System Update Available"
                description="A new version of UnQWebTemplate is available. Update now to get the latest features."
                onDismiss={() => dismissAlert("default")}
                primaryAction={{ label: "Update Now", onClick: () => toast.info("Updating...") }}
                secondaryAction={{ label: "Later", onClick: () => dismissAlert("default") }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {alerts.success && (
              <AlertBanner
                variant="success"
                title="Deployment Successful"
                description="Your application has been deployed to production successfully."
                onDismiss={() => dismissAlert("success")}
                primaryAction={{ label: "View Deployment", onClick: () => toast.success("Opening deployment dashboard...") }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {alerts.destructive && (
              <AlertBanner
                variant="destructive"
                title="Critical Error Detected"
                description="Database connection failed. Please check your configuration and try again."
                onDismiss={() => dismissAlert("destructive")}
                primaryAction={{ label: "Retry Connection", onClick: () => toast.error("Retrying connection...") }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {alerts.warning && (
              <AlertBanner
                variant="warning"
                title="Storage Almost Full"
                description="You've used 92% of your storage quota. Consider upgrading your plan."
                onDismiss={() => dismissAlert("warning")}
                primaryAction={{ label: "Upgrade Plan", onClick: () => toast.warning("Opening upgrade page...") }}
                secondaryAction={{ label: "Manage Storage", onClick: () => toast.info("Opening storage manager...") }}
              />
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== TOAST NOTIFICATIONS SECTION =====
function ToastSection() {
  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Toast Notifications</CardTitle>
              <CardDescription>Click buttons to trigger different toast messages</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toast("Event created", { description: "Monday, January 3rd at 6:00 PM" })}
            >
              <Info className="h-4 w-4" /> Default
            </Button>
            <Button
              variant="outline"
              className="gap-2 hover:border-green-500/50 hover:text-green-500"
              onClick={() => toast.success("Changes saved", { description: "Your profile has been updated successfully." })}
            >
              <CheckCircle2 className="h-4 w-4" /> Success
            </Button>
            <Button
              variant="outline"
              className="gap-2 hover:border-red-500/50 hover:text-red-500"
              onClick={() => toast.error("Error occurred", { description: "Failed to save changes. Please try again." })}
            >
              <XCircle className="h-4 w-4" /> Error
            </Button>
            <Button
              variant="outline"
              className="gap-2 hover:border-yellow-500/50 hover:text-yellow-500"
              onClick={() => toast.warning("Warning", { description: "You are about to perform an irreversible action." })}
            >
              <AlertTriangle className="h-4 w-4" /> Warning
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toast("Message from Sarah", { description: "Hey! Can we discuss the new feature tomorrow?" })}
            >
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toast.promise(
                new Promise((resolve) => setTimeout(resolve, 2000)),
                { loading: "Processing...", success: "Done!", error: "Failed!" }
              )}
            >
              <Zap className="h-4 w-4" /> Promise
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                toast("Custom action", {
                  description: "With an action button",
                  action: { label: "Undo", onClick: () => toast.info("Action undone!") },
                });
              }}
            >
              <MousePointerClick className="h-4 w-4" /> With Action
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                toast("Event 1", { description: "First notification" });
                setTimeout(() => toast.success("Event 2", { description: "Second notification" }), 300);
                setTimeout(() => toast("Event 3", { description: "Third notification" }), 600);
              }}
            >
              <Sparkles className="h-4 w-4" /> Multiple
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== SHAMAYIM TOGGLE SWITCH SECTION =====
function ToggleSwitchSection() {
  const [states, setStates] = useState<Record<string, boolean>>({
    conic: true,
    dots: false,
    grid: true,
    waves: false,
    zigzag: true,
    checker: false,
    hex: true,
    linear: false,
  });

  const patterns = [
    { key: "conic", label: "Conic", pattern: "conic" as const },
    { key: "dots", label: "Dots", pattern: "dots" as const },
    { key: "grid", label: "Grid", pattern: "grid" as const },
    { key: "waves", label: "Waves", pattern: "waves" as const },
    { key: "zigzag", label: "Zigzag", pattern: "zigzag" as const },
    { key: "checker", label: "Checker", pattern: "checker" as const },
    { key: "hex", label: "Hex", pattern: "hex" as const },
    { key: "linear", label: "Linear", pattern: "linear" as const },
  ];

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Shamayim Toggle Switches</CardTitle>
              <CardDescription>Multiple toggle patterns with unique visual styles</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {patterns.map((p) => (
              <div key={p.key} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                <ShamayimToggleSwitch
                  defaultState={states[p.key]}
                  pattern={p.pattern}
                  onChange={(val) => setStates((prev) => ({ ...prev, [p.key]: val }))}
                />
                <div className="text-center">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{states[p.key] ? "On" : "Off"}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== PROGRESS BARS SECTION =====
function ProgressSection() {
  const progressData = [
    { label: "Project Alpha", value: 85, color: "bg-primary" },
    { label: "Project Beta", value: 62, color: "bg-primary/80" },
    { label: "Project Gamma", value: 45, color: "bg-primary/60" },
    { label: "Project Delta", value: 28, color: "bg-primary/40" },
    { label: "Storage Used", value: 72, color: "bg-primary" },
    { label: "API Quota", value: 91, color: "bg-red-500" },
  ];

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Progress Bars</CardTitle>
              <CardDescription>Different progress values and styles</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {progressData.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.value}%</span>
              </div>
              <Progress value={item.value} className="h-2.5" />
            </div>
          ))}

          <Separator className="my-4" />

          {/* Animated progress */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Animated Progress</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Progress value={75} className="h-3" />
                </div>
                <Badge variant="secondary">75%</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Progress value={50} className="h-4" />
                </div>
                <Badge variant="secondary">50%</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Progress value={30} className="h-5" />
                </div>
                <Badge variant="secondary">30%</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== SKELETON LOADERS SECTION =====
function SkeletonSection() {
  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Skeleton Loaders</CardTitle>
              <CardDescription>Loading states for cards, text, avatars</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card Skeleton */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Card Skeleton</p>
              <div className="rounded-xl border border-border/50 p-6 space-y-4">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 touch-target w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              </div>
            </div>

            {/* List Skeleton */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">List Skeleton</p>
              <div className="rounded-xl border border-border/50 p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Table Skeleton</p>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="bg-muted/30 p-4 flex gap-4">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 flex gap-4 border-t border-border/50">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Skeleton */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Profile Skeleton</p>
              <div className="rounded-xl border border-border/50 p-6 flex flex-col items-center space-y-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
                <div className="flex gap-4 w-full justify-center">
                  <Skeleton className="h-8 touch-target w-20 rounded-md" />
                  <Skeleton className="h-8 touch-target w-20 rounded-md" />
                </div>
              </div>
            </div>

            {/* Article Skeleton */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Article Skeleton</p>
              <div className="rounded-xl border border-border/50 p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>

            {/* Grid Skeleton */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Grid Skeleton</p>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <Skeleton className="h-16 w-full rounded-md" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== HOVER CARDS SECTION =====
function HoverCardSection() {
  const users = [
    { name: "Sandeep Gaddam", role: "Creator & Lead Dev", avatar: "SG", bio: "Full-stack developer passionate about UI/UX and open source.", stats: { projects: 24, followers: "2.4k", stars: "8.9k" } },
    { name: "Ava Thompson", role: "Senior Developer", avatar: "AT", bio: "React enthusiast and TypeScript advocate.", stats: { projects: 18, followers: "1.2k", stars: "3.5k" } },
    { name: "Marcus Chen", role: "Lead Designer", avatar: "MC", bio: "Design systems expert with an eye for detail.", stats: { projects: 15, followers: "980", stars: "2.1k" } },
  ];

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <MousePointerClick className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Hover Cards</CardTitle>
              <CardDescription>Hover over names to see user info cards</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-muted-foreground">Team members:</span>
              {users.map((user) => (
                <HoverCard key={user.name}>
                  <HoverCardTrigger asChild>
                    <Button variant="link" className="p-0 h-auto text-primary font-medium">
                      {user.name}
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-72">
                    <div className="flex gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{user.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold">{user.name}</h4>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{user.bio}</p>
                    <Separator className="my-3" />
                    <div className="flex justify-between text-xs">
                      <div className="text-center">
                        <p className="font-bold">{user.stats.projects}</p>
                        <p className="text-muted-foreground">Projects</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{user.stats.followers}</p>
                        <p className="text-muted-foreground">Followers</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{user.stats.stars}</p>
                        <p className="text-muted-foreground">Stars</p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>

            {/* Hover card with image */}
            <div className="p-4 rounded-xl bg-muted/20">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">SG</AvatarFallback>
                    </Avatar>
                    View Creator Profile
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="flex gap-4">
                    <Avatar className="h-14 w-14 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">SG</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-sm font-semibold">Sandeep Gaddam</h4>
                      <p className="text-xs text-primary">Creator of UnQWebTemplate</p>
                      <p className="mt-2 text-xs text-muted-foreground">Building premium web templates with modern technologies.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Sparkles className="h-3 w-3" /> Next.js
                    </Badge>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Zap className="h-3 w-3" /> TypeScript
                    </Badge>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Shield className="h-3 w-3" /> Tailwind
                    </Badge>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== TOOLTIP SECTION =====
function TooltipSection() {
  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Tooltips</CardTitle>
              <CardDescription>Hover to see tooltip positions and content</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap items-center justify-center gap-6 py-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Wifi className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Top: Network Status</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Bluetooth className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Right: Bluetooth</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Bottom: Volume Control</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Monitor className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Left: Display Settings</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Moon className="h-4 w-4" /> Dark Mode
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle between light and dark themes</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Shield className="h-4 w-4" /> Security
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage security and privacy settings</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-default">
                    <Sun className="h-4 w-4 text-primary-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Custom trigger element tooltip</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Rich tooltip example */}
            <div className="mt-4 p-4 rounded-xl bg-muted/20">
              <h4 className="text-sm font-semibold mb-3">Rich Tooltips with Content</h4>
              <div className="flex flex-wrap gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-default gap-1 px-3 py-1.5">
                      <Zap className="h-3 w-3" /> Performance
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-48">
                    <p className="font-medium">Performance Score</p>
                    <p className="text-xs text-muted-foreground mt-1">Your app scores 98/100 on Lighthouse performance audit.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-default gap-1 px-3 py-1.5">
                      <ThumbsUp className="h-3 w-3" /> UX Score
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-48">
                    <p className="font-medium">UX Rating</p>
                    <p className="text-xs text-muted-foreground mt-1">4.9/5.0 average rating from user feedback surveys.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-default gap-1 px-3 py-1.5">
                      <Shield className="h-3 w-3" /> Security
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-48">
                    <p className="font-medium">Security Grade</p>
                    <p className="text-xs text-muted-foreground mt-1">A+ security rating. All dependencies are up to date.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== MAIN PAGE =====
export default function FeedbackPage() {
  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="relative section-padding py-12 md:py-16 max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <Badge variant="secondary" className="mb-4 gap-1.5 px-3 py-1">
                <MessageSquare className="h-3 w-3" /> Feedback Showcase
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
                Feedback <span className="text-primary">Components</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Alert banners, toast notifications, toggle switches, progress indicators, skeleton loaders, hover cards, and tooltips.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-10 max-w-7xl mx-auto space-y-6">
          {/* Alert Banners */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <AlertBannerSection />
          </motion.div>

          {/* Toast + Toggle Switches */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ToastSection />
            <ToggleSwitchSection />
          </motion.div>

          {/* Progress Bars + Skeleton */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ProgressSection />
            <SkeletonSection />
          </motion.div>

          {/* Hover Cards + Tooltips */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <HoverCardSection />
            <TooltipSection />
          </motion.div>
        </div>

        {/* Footer */}
        <div className="section-padding py-8 border-t border-border/50 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm text-muted-foreground"
          >
            UnQWebTemplate — Built with ❤️ by Sandeep Gaddam
          </motion.p>
        </div>
      </main>
    </div>
  );
}
