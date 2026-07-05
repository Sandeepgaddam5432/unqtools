"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CubeLoader } from "@/components/ui/cube-loader";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Loader,
  Atom,
  CircleDot,
  Zap,
  Monitor,
  Layout,
  List,
  Table,
  ImageIcon,
  CheckCircle2,
} from "lucide-react";

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

// ===== CUSTOM SPINNING LOADERS =====
function RingSpinner() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-4 border-muted" />
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
    </div>
  );
}

function DotsSpinner() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-3 h-3 rounded-full bg-primary"
          animate={{ y: [0, -12, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function PulseSpinner() {
  return (
    <div className="relative w-12 h-12">
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/30"
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-2 rounded-full bg-primary animate-pulse" />
    </div>
  );
}

function DoubleRingSpinner() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary/30 animate-spin" />
      <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-primary border-l-primary/30 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
    </div>
  );
}

function WaveSpinner() {
  return (
    <div className="flex items-end gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-2 bg-primary rounded-full"
          animate={{ height: [12, 32, 12] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function OrbitSpinner() {
  return (
    <div className="relative w-14 h-14">
      <motion.div
        className="absolute w-3 h-3 rounded-full bg-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "28px 28px" }}
      />
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-primary/50"
        animate={{ rotate: -360 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "28px 28px", top: 8, left: 8 }}
      />
      <div className="absolute inset-3 rounded-full border-2 border-dashed border-border" />
    </div>
  );
}

// ===== CIRCULAR PROGRESS =====
function CircularProgress({ value, size = 80, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{value}%</span>
      </div>
    </div>
  );
}

// ===== CUBE LOADER SECTION =====
function CubeLoaderSection() {
  const [key, setKey] = useState(0);
  const reload = () => setKey((k) => k + 1);

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Atom className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Cube Loader</CardTitle>
                <CardDescription>3D rotating cube animation</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={reload} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div key={key} className="flex items-center justify-center py-8 bg-black/5 dark:bg-black/20 rounded-xl">
            <CubeLoader />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== SPINNING LOADERS SECTION =====
function SpinnersSection() {
  const [key, setKey] = useState(0);
  const reload = () => setKey((k) => k + 1);

  const spinners = [
    { name: "Ring Spinner", component: <RingSpinner /> },
    { name: "Dots Bounce", component: <DotsSpinner /> },
    { name: "Pulse", component: <PulseSpinner /> },
    { name: "Double Ring", component: <DoubleRingSpinner /> },
    { name: "Wave", component: <WaveSpinner /> },
    { name: "Orbit", component: <OrbitSpinner /> },
    { name: "Framer Spin", component: <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 className="h-12 w-12 text-primary" /></motion.div> },
    { name: "Scale Pulse", component: <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center"><CircleDot className="h-6 w-6 text-primary" /></motion.div> },
  ];

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Loader className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Custom Spinners</CardTitle>
                <CardDescription>Different spinner styles using CSS and Framer Motion</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={reload} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div key={key} className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {spinners.map((spinner) => (
              <div key={spinner.name} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                {spinner.component}
                <p className="text-xs font-medium text-muted-foreground">{spinner.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== SKELETON LOADING SECTION =====
function SkeletonLoadingSection() {
  const [key, setKey] = useState(0);
  const reload = () => setKey((k) => k + 1);

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Layout className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Skeleton Loading States</CardTitle>
                <CardDescription>Full page, card, list, and table skeletons</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={reload} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent key={key}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Full Page Skeleton */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Monitor className="h-3.5 w-3.5" /> Full Page
              </div>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-muted/20 flex gap-3">
                  <Skeleton className="h-8 touch-target w-8 rounded-lg" />
                  <Skeleton className="h-8 touch-target flex-1" />
                  <Skeleton className="h-8 touch-target w-20" />
                </div>
                <div className="p-6 space-y-4">
                  <Skeleton className="h-8 touch-target w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                  </div>
                  <Skeleton className="h-40 w-full rounded-lg" />
                </div>
              </div>
            </div>

            {/* Card Skeleton */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ImageIcon className="h-3.5 w-3.5" /> Card
              </div>
              <div className="rounded-xl border border-border/50 p-5 space-y-4">
                <Skeleton className="h-36 w-full rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 touch-target w-8 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 touch-target w-20 rounded-md" />
                </div>
              </div>
            </div>

            {/* List Skeleton */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <List className="h-3.5 w-3.5" /> List
              </div>
              <div className="rounded-xl border border-border/50 divide-y divide-border/50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Table className="h-3.5 w-3.5" /> Table
              </div>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="bg-muted/30 p-3 flex gap-4">
                  <Skeleton className="h-4 w-1/5" />
                  <Skeleton className="h-4 w-1/5" />
                  <Skeleton className="h-4 w-1/5" />
                  <Skeleton className="h-4 w-1/5" />
                  <Skeleton className="h-4 w-1/5" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 flex gap-4 border-t border-border/50">
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-4 w-1/5" />
                    <Skeleton className="h-4 w-1/5" />
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

// ===== PROGRESS INDICATORS SECTION =====
function ProgressIndicatorsSection() {
  const [key, setKey] = useState(0);
  const [linearProgress, setLinearProgress] = useState(0);

  const reload = () => {
    setKey((k) => k + 1);
    setLinearProgress(0);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setLinearProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [key]);

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Progress Indicators</CardTitle>
                <CardDescription>Linear, circular, and animated progress</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={reload} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent key={key} className="space-y-8">
          {/* Linear Progress */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Linear Progress</h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Auto-progress</span>
                  <span className="font-mono text-xs">{linearProgress}%</span>
                </div>
                <Progress value={linearProgress} className="h-3" />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">Determinant</span>
                <Progress value={75} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">Low</span>
                <Progress value={25} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm text-muted-foreground">Indeterminate</span>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%", marginLeft: "0%" }}
                    animate={{ width: "40%", marginLeft: ["0%", "60%", "0%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Circular Progress */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Circular Progress</h4>
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <CircularProgress value={25} />
                <span className="text-xs text-muted-foreground">25%</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CircularProgress value={50} />
                <span className="text-xs text-muted-foreground">50%</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CircularProgress value={75} />
                <span className="text-xs text-muted-foreground">75%</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CircularProgress value={100} />
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CircularProgress value={linearProgress} size={100} strokeWidth={8} />
                <span className="text-xs text-muted-foreground">Auto</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== PAGE TRANSITION LOADER =====
function PageTransitionSection() {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, [key]);

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Page Transition Loader</CardTitle>
                <CardDescription>Full-page loading animation simulation</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={reload} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div key={key} className="relative rounded-xl overflow-hidden border border-border/50 min-h-[280px]">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm z-10"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="flex flex-col items-center gap-6"
                  >
                    <div className="relative">
                      <motion.div
                        className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                        animate={{ rotate: [0, 90, 180, 270, 360] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <span className="text-primary font-bold text-xl">U</span>
                      </motion.div>
                      <motion.div
                        className="absolute -inset-2 rounded-2xl border border-primary/10"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold">Loading UnQWebTemplate</h3>
                      <p className="text-sm text-muted-foreground">Preparing your experience...</p>
                    </div>
                    <div className="w-48">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className="h-1.5 bg-primary rounded-full"
                      />
                    </div>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
                  className="p-6 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">U</div>
                    <h3 className="font-bold">Welcome to UnQWebTemplate</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">The page has loaded successfully. This simulates how a full-page loading animation works with smooth transitions between loading and content states.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-lg font-bold text-primary">2.5s</p>
                      <p className="text-xs text-muted-foreground">Load Time</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-lg font-bold text-green-500">100%</p>
                      <p className="text-xs text-muted-foreground">Complete</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-lg font-bold text-blue-500">0</p>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== CONTENT LOADING STATES =====
function ContentLoadingSection() {
  const [loading, setLoading] = useState<Record<string, boolean>>({
    card1: true,
    card2: true,
    card3: true,
    list: true,
    stats: true,
  });

  const reloadAll = () => {
    setLoading({ card1: true, card2: true, card3: true, list: true, stats: true });
  };

  const loadContent = (key: string) => {
    setTimeout(() => {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }, 800 + Math.random() * 1200);
  };

  useEffect(() => {
    Object.keys(loading).forEach((key, i) => {
      setTimeout(() => loadContent(key), i * 300);
    });
  }, []);

  const reloadAndLoad = () => {
    reloadAll();
    Object.keys(loading).forEach((key, i) => {
      setTimeout(() => loadContent(key), i * 300 + 800);
    });
  };

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Content Loading States</CardTitle>
                <CardDescription>See how content appears after loading completes</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={reloadAndLoad} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Stats cards loading */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["card1", "card2", "card3"] as const).map((key, i) => {
                const data = [
                  { label: "Total Users", value: "12,847", icon: "👥", change: "+12.5%" },
                  { label: "Revenue", value: "$48,290", icon: "💰", change: "+8.3%" },
                  { label: "Active Now", value: "1,429", icon: "🟢", change: "+2.1%" },
                ][i];

                return (
                  <div key={key} className="p-4 rounded-xl border border-border/50 bg-muted/10">
                    <AnimatePresence mode="wait">
                      {loading[key] ? (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-3"
                        >
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 touch-target w-28" />
                          <Skeleton className="h-3 w-16" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="content"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{data.label}</span>
                            <span className="text-lg">{data.icon}</span>
                          </div>
                          <p className="text-2xl font-bold mt-1">{data.value}</p>
                          <p className="text-xs text-green-500 mt-1">{data.change} from last month</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* List loading */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="p-3 border-b border-border/50 bg-muted/20">
                <h4 className="text-sm font-semibold">Recent Activity</h4>
              </div>
              <AnimatePresence mode="wait">
                {loading.list ? (
                  <motion.div key="list-loading" className="divide-y divide-border/50">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <Skeleton className="h-8 touch-target w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-md" />
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="list-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="divide-y divide-border/50"
                  >
                    {[
                      { name: "Sandeep Gaddam", action: "deployed v2.1.0", time: "2m ago", status: "success" },
                      { name: "Ava Thompson", action: "merged PR #142", time: "15m ago", status: "info" },
                      { name: "Marcus Chen", action: "updated design tokens", time: "1h ago", status: "warning" },
                      { name: "Elena Rodriguez", action: "resolved 3 issues", time: "3h ago", status: "success" },
                    ].map((item, i) => (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {item.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
                          <p className="text-sm truncate"><span className="font-medium">{item.name}</span> {item.action}</p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{item.status}</Badge>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stats with progress */}
            <div className="rounded-xl border border-border/50 p-4">
              <AnimatePresence mode="wait">
                {loading.stats ? (
                  <motion.div key="stats-loading" className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-8" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="stats-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-4"
                  >
                    {[
                      { label: "Build Progress", value: 95 },
                      { label: "Test Coverage", value: 78 },
                      { label: "Deployment", value: 62 },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="space-y-2"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-muted-foreground">{item.value}%</span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== MAIN PAGE =====
export default function LoadersPage() {
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
                <Loader2 className="h-3 w-3 animate-spin" /> Loaders Showcase
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
                Loading <span className="text-primary">Animations</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Captivating loading states, spinners, skeleton screens, and progress indicators with replay functionality.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-10 max-w-7xl mx-auto space-y-6">
          {/* Cube Loader + Spinners */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <CubeLoaderSection />
            <SpinnersSection />
          </motion.div>

          {/* Skeleton Loading */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <SkeletonLoadingSection />
          </motion.div>

          {/* Progress + Page Transition */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ProgressIndicatorsSection />
            <PageTransitionSection />
          </motion.div>

          {/* Content Loading States */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <ContentLoadingSection />
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
