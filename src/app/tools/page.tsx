"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wand2,
  Code2,
  LayoutGrid,
  Bell,
  Sparkles,
  Zap,
  Globe,
  Cpu,
  Palette,
  FileCode,
  MessageSquare,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { SidebarNav } from "@/components/navigation/sidebar";
import { AIMultiModalGeneration } from "@/components/ui/ai-gen";
import { APIPlayground } from "@/components/ui/api-playground";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { AlertBanner } from "@/components/ui/alert-banner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Section Wrapper ─────────────────────────────────────────────────────────
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Tool Category Data ──────────────────────────────────────────────────────
const toolCategories = [
  {
    id: "generation",
    title: "Generation",
    icon: Sparkles,
    description: "AI-powered content generation tools for images, video, and 3D avatars.",
    tools: ["Image Gen", "Video Gen", "Avatar Gen"],
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  {
    id: "api",
    title: "API Tools",
    icon: Code2,
    description: "Test and debug APIs with our interactive playground.",
    tools: ["REST Client", "GraphQL", "WebSocket"],
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    id: "nlp",
    title: "NLP Suite",
    icon: MessageSquare,
    description: "Natural language processing for text analysis and generation.",
    tools: ["Sentiment", "Summarize", "Translate"],
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
  },
  {
    id: "security",
    title: "Security",
    icon: ShieldCheck,
    description: "AI-driven security scanning and vulnerability detection.",
    tools: ["Code Scan", "Dep Audit", "Infra Check"],
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
];

// ─── Expandable Tabs Data ────────────────────────────────────────────────────
const expandableTabsItems = [
  { title: "Image Gen", icon: Palette },
  { title: "Video Gen", icon: Globe },
  { title: "Code Gen", icon: FileCode },
  { title: "Chat", icon: MessageSquare },
  { title: "Security", icon: ShieldCheck },
  { title: "Terminal", icon: Terminal },
  { type: "separator" as const },
  { title: "Models", icon: Cpu },
  { title: "Deploy", icon: Zap },
];

// ─── Tools Page ──────────────────────────────────────────────────────────────
export default function ToolsPage() {
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [visibleAlerts, setVisibleAlerts] = useState<Record<string, boolean>>({
    success: true,
    warning: true,
    destructive: true,
    default: true,
  });

  const dismissAlert = (key: string) => {
    setVisibleAlerts((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />

      <main className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
        {/* Page Header */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-20">
          <div className="section-padding py-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    AI Tools & Playground
                  </h1>
                  <Badge variant="default" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    New
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  Explore AI-powered generation tools, test APIs, and experiment with cutting-edge models.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Cpu className="h-3 w-3 mr-1" />
                  8 Models
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  12 Tools
                </Badge>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-8 space-y-8">
          {/* AI Multi-Modal Generation */}
          <AnimatedSection>
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">AI Multi-Modal Generation</h2>
              <Badge variant="outline" className="text-xs">
                Studio
              </Badge>
            </div>
            <Card className="border-border/50">
              <CardContent className="p-0">
                <AIMultiModalGeneration />
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* API Playground */}
          <AnimatedSection delay={0.1}>
            <div className="flex items-center gap-2 mb-4">
              <Code2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">API Playground</h2>
              <Badge variant="outline" className="text-xs">
                Interactive
              </Badge>
            </div>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <APIPlayground />
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Tool Categories Grid */}
          <AnimatedSection delay={0.15}>
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Tool Categories</h2>
              <Badge variant="outline" className="text-xs">
                {toolCategories.length} categories
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {toolCategories.map((category, index) => {
                const Icon = category.icon;
                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <Card className="group hover:shadow-lg transition-all card-hover duration-300 border-border/50 hover:border-primary/30">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${category.bgColor} shrink-0`}>
                            <Icon className={`h-6 w-6 ${category.color}`} />
                          </div>
                          <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
                            <h3 className="font-semibold text-foreground mb-1">
                              {category.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {category.description}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {category.tools.map((tool) => (
                                <Badge
                                  key={tool}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </AnimatedSection>

          {/* Expandable Tabs */}
          <AnimatedSection delay={0.2}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
              <Badge variant="outline" className="text-xs">
                Expandable
              </Badge>
            </div>
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Tool Navigation</CardTitle>
                <CardDescription>
                  Select a tool category to explore its capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ExpandableTabs
                  tabs={expandableTabsItems}
                  activeColor="text-primary"
                  selectedIndex={selectedTab}
                  onChange={setSelectedTab}
                />
                <div className="min-h-[120px] rounded-xl border border-dashed border-border/60 bg-muted/20 flex items-center justify-center p-6">
                  {selectedTab !== null ? (
                    <motion.div
                      key={selectedTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-center"
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {(() => {
                          const tab = expandableTabsItems[selectedTab];
                          if (tab.type === "separator" || !("icon" in tab)) return null;
                          const TabIcon = tab.icon;
                          return <TabIcon className="h-5 w-5 text-primary" />;
                        })()}
                        <h3 className="font-semibold text-foreground">
                          {(() => {
                            const tab = expandableTabsItems[selectedTab];
                            return tab.type === "separator" ? "" : tab.title;
                          })()}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {(() => {
                          const descriptions: Record<string, string> = {
                            "Image Gen": "Generate stunning images from text prompts using state-of-the-art diffusion models.",
                            "Video Gen": "Create short video clips from text descriptions with AI-powered video synthesis.",
                            "Code Gen": "Generate, refactor, and debug code with intelligent AI assistance.",
                            Chat: "Engage in multi-turn conversations with advanced language models.",
                            Security: "Scan code and infrastructure for vulnerabilities using AI-driven analysis.",
                            Terminal: "Access an AI-powered terminal assistant for command generation and debugging.",
                            Models: "Browse and configure available AI models and their parameters.",
                            Deploy: "Deploy your AI-powered applications with one click to any cloud provider.",
                          };
                          const tab = expandableTabsItems[selectedTab];
                          const title = tab.type === "separator" ? "" : tab.title;
                          return descriptions[title] || "Explore this tool's capabilities.";
                        })()}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="text-center">
                      <Sparkles className="h-8 touch-target w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Select a tool above to see its details
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Alert Banner Demos */}
          <AnimatedSection delay={0.25}>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Alert Banners</h2>
              <Badge variant="outline" className="text-xs">
                Components
              </Badge>
            </div>
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Notification System</CardTitle>
                <CardDescription>
                  Interactive alert banners with multiple variants and actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleAlerts.success && (
                  <AlertBanner
                    variant="success"
                    title="Model Deployment Successful"
                    description="Your Stable Diffusion XL model has been deployed to production and is now serving requests."
                    onDismiss={() => dismissAlert("success")}
                    primaryAction={{
                      label: "View Dashboard",
                      onClick: () => {},
                    }}
                    secondaryAction={{
                      label: "View Logs",
                      onClick: () => {},
                    }}
                  />
                )}
                {visibleAlerts.warning && (
                  <AlertBanner
                    variant="warning"
                    title="API Rate Limit Warning"
                    description="You are approaching 90% of your hourly API rate limit. Consider upgrading your plan for higher limits."
                    onDismiss={() => dismissAlert("warning")}
                    primaryAction={{
                      label: "Upgrade Plan",
                      onClick: () => {},
                    }}
                  />
                )}
                {visibleAlerts.destructive && (
                  <AlertBanner
                    variant="destructive"
                    title="Generation Failed"
                    description="The video generation task failed due to insufficient GPU memory. Try reducing the resolution or duration."
                    onDismiss={() => dismissAlert("destructive")}
                    primaryAction={{
                      label: "Retry with Lower Settings",
                      onClick: () => {},
                    }}
                    secondaryAction={{
                      label: "View Error Details",
                      onClick: () => {},
                    }}
                  />
                )}
                {visibleAlerts.default && (
                  <AlertBanner
                    variant="default"
                    title="System Update Available"
                    description="A new version of the AI toolkit is available with improved model performance and new features."
                    onDismiss={() => dismissAlert("default")}
                    primaryAction={{
                      label: "Update Now",
                      onClick: () => {},
                    }}
                    secondaryAction={{
                      label: "Release Notes",
                      onClick: () => {},
                    }}
                  />
                )}
                {!Object.values(visibleAlerts).some(Boolean) && (
                  <div className="text-center py-8">
                    <Bell className="h-8 touch-target w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      All alerts dismissed. Refresh to see them again.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </main>
    </div>
  );
}
