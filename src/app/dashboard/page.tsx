"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Terminal, TypingAnimation, AnimatedSpan } from "@/components/ui/terminal";
import { Marquee } from "@/components/ui/marquee";
import {
  Users,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Activity,
  Clock,
  BarChart3,
  TerminalSquare,
  Hash,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { SidebarNav } from "@/components/navigation/sidebar";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { GlassClock } from "@/components/ui/glass-clock";
import { DataTable, type DataTableColumn } from "@/components/ui/basic-data-table";
import { Timeline, type TimelineItemData } from "@/components/ui/timeline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 2,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = target;
    const incrementTime = (duration * 1000) / end;
    const step = Math.max(1, Math.floor(end / 60));

    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, incrementTime * step);

    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

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

// ─── Sample Data ─────────────────────────────────────────────────────────────
const revenueData = [
  { name: "Jan", revenue: 4000, users: 240 },
  { name: "Feb", revenue: 3000, users: 198 },
  { name: "Mar", revenue: 5000, users: 305 },
  { name: "Apr", revenue: 4500, users: 278 },
  { name: "May", revenue: 6000, users: 389 },
  { name: "Jun", revenue: 5500, users: 342 },
  { name: "Jul", revenue: 7000, users: 445 },
  { name: "Aug", revenue: 6500, users: 410 },
  { name: "Sep", revenue: 8000, users: 502 },
  { name: "Oct", revenue: 7500, users: 478 },
  { name: "Nov", revenue: 9000, users: 560 },
  { name: "Dec", revenue: 9500, users: 598 },
];

const ordersData = [
  { name: "Jan", orders: 186, returns: 12 },
  { name: "Feb", orders: 205, returns: 18 },
  { name: "Mar", orders: 237, returns: 15 },
  { name: "Apr", orders: 203, returns: 20 },
  { name: "May", orders: 289, returns: 22 },
  { name: "Jun", orders: 264, returns: 17 },
  { name: "Jul", orders: 312, returns: 25 },
  { name: "Aug", orders: 298, returns: 19 },
  { name: "Sep", orders: 345, returns: 28 },
  { name: "Oct", orders: 321, returns: 21 },
  { name: "Nov", orders: 378, returns: 30 },
  { name: "Dec", orders: 402, returns: 24 },
];

type UserData = {
  name: string;
  email: string;
  role: string;
  status: string;
  joined: string;
};

const userData: UserData[] = [
  { name: "Ava Reynolds", email: "ava.reynolds@company.io", role: "Admin", status: "Active", joined: "2024-01-15" },
  { name: "Marcus Chen", email: "marcus.chen@company.io", role: "Developer", status: "Active", joined: "2024-02-20" },
  { name: "Isla Nakamura", email: "isla.n@company.io", role: "Designer", status: "On Leave", joined: "2024-03-10" },
  { name: "Leo Patel", email: "leo.patel@company.io", role: "Developer", status: "Active", joined: "2024-04-05" },
  { name: "Zara Okonkwo", email: "zara.o@company.io", role: "Manager", status: "Active", joined: "2024-05-12" },
  { name: "Ethan Moreau", email: "ethan.m@company.io", role: "Developer", status: "Inactive", joined: "2024-06-18" },
  { name: "Priya Sharma", email: "priya.s@company.io", role: "Analyst", status: "Active", joined: "2024-07-22" },
  { name: "Noah Kim", email: "noah.kim@company.io", role: "Designer", status: "Active", joined: "2024-08-30" },
  { name: "Sofia Rivera", email: "sofia.r@company.io", role: "Developer", status: "On Leave", joined: "2024-09-14" },
  { name: "Oliver Tanaka", email: "oliver.t@company.io", role: "Admin", status: "Active", joined: "2024-10-01" },
];

const userColumns: DataTableColumn<UserData>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (value: string) => (
      <span className="font-medium text-foreground">{value}</span>
    ),
  },
  {
    key: "email",
    header: "Email",
    sortable: true,
    render: (value: string) => (
      <span className="text-muted-foreground">{value}</span>
    ),
  },
  {
    key: "role",
    header: "Role",
    sortable: true,
    filterable: true,
    render: (value: string) => (
      <Badge variant="outline" className="text-xs font-medium">
        {value}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    filterable: true,
    render: (value: string) => {
      const variant =
        value === "Active"
          ? "default"
          : value === "On Leave"
          ? "secondary"
          : "destructive";
      return (
        <Badge variant={variant} className="text-xs">
          {value}
        </Badge>
      );
    },
  },
  {
    key: "joined",
    header: "Joined",
    sortable: true,
    render: (value: string) => (
      <span className="text-muted-foreground text-xs">{value}</span>
    ),
  },
];

const projectTimeline: TimelineItemData[] = [
  {
    id: "1",
    title: "Project Kickoff",
    description: "Initial planning and architecture design completed. Team assembled and roles assigned.",
    date: "Jan 15",
    status: "completed",
    metadata: { team: "Core", priority: "High" },
  },
  {
    id: "2",
    title: "Design System Setup",
    description: "Component library, tokens, and design patterns established. Figma handoff complete.",
    date: "Feb 3",
    status: "completed",
    metadata: { team: "Design", priority: "High" },
  },
  {
    id: "3",
    title: "Backend API Development",
    description: "RESTful API endpoints, database schema, and authentication layer implemented.",
    date: "Mar 20",
    status: "completed",
    metadata: { team: "Backend", priority: "Critical" },
  },
  {
    id: "4",
    title: "Frontend Integration",
    description: "Connecting UI components with API endpoints. State management and error handling in progress.",
    date: "Apr 12",
    status: "in-progress",
    metadata: { team: "Frontend", priority: "High" },
  },
  {
    id: "5",
    title: "QA & Testing",
    description: "Comprehensive testing phase including unit, integration, and e2e tests.",
    date: "May 1",
    status: "pending",
    metadata: { team: "QA", priority: "Medium" },
  },
  {
    id: "6",
    title: "Production Launch",
    description: "Final deployment, monitoring setup, and launch to production environment.",
    date: "May 20",
    status: "pending",
    metadata: { team: "DevOps", priority: "Critical" },
  },
];

// ─── Stat Card Config ────────────────────────────────────────────────────────
const stats = [
  {
    title: "Total Users",
    value: 12847,
    prefix: "",
    suffix: "",
    change: "+12.5%",
    isPositive: true,
    icon: Users,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  {
    title: "Revenue",
    value: 84520,
    prefix: "$",
    suffix: "",
    change: "+8.2%",
    isPositive: true,
    icon: DollarSign,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    title: "Orders",
    value: 3439,
    prefix: "",
    suffix: "",
    change: "+23.1%",
    isPositive: true,
    icon: ShoppingBag,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
  },
  {
    title: "Growth Rate",
    value: 18,
    prefix: "",
    suffix: "%",
    change: "-2.4%",
    isPositive: false,
    icon: TrendingUp,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
];

// ─── Custom Tooltip for Charts ───────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-foreground font-medium">
            {item.dataKey}: {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
                    Dashboard
                  </h1>
                  <Badge variant="default" className="text-xs">
                    Live
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  Monitor your platform performance and key metrics in real-time.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{formattedDate}</span>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-8 space-y-8">
          {/* Stats Row */}
          <AnimatedSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow card-hover duration-300 border-border/50">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className={`p-2.5 rounded-xl ${stat.bgColor}`}>
                            <Icon className={`h-5 w-5 ${stat.color}`} />
                          </div>
                          <div
                            className={`flex items-center gap-1 text-xs font-medium ${
                              stat.isPositive
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {stat.isPositive ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {stat.change}
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-2xl font-bold tracking-tight text-foreground">
                            <AnimatedCounter
                              target={stat.value}
                              prefix={stat.prefix}
                              suffix={stat.suffix}
                            />
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {stat.title}
                          </p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </AnimatedSection>

          {/* Charts Section */}
          <AnimatedSection delay={0.1}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
              <Badge variant="outline" className="text-xs">
                Real-time
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Line Chart */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Revenue Trend</CardTitle>
                      <CardDescription>Monthly revenue over the past year</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +137%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={revenueData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `$${v / 1000}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="var(--color-primary)"
                          strokeWidth={2.5}
                          fill="url(#revenueGradient)"
                          dot={false}
                          activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-background)", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Orders Bar Chart */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Orders Overview</CardTitle>
                      <CardDescription>Monthly orders and returns</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <ShoppingBag className="h-3 w-3 mr-1" />
                      3,439 total
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={ordersData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="orders"
                          fill="var(--color-primary)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="returns"
                          fill="var(--color-chart-2)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                          opacity={0.7}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AnimatedSection>

          {/* Glass Calendar + Glass Clock */}
          <AnimatedSection delay={0.15}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Time & Calendar</h2>
              <Badge variant="outline" className="text-xs">
                Glass UI
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/50 overflow-hidden">
                <CardContent className="p-6 flex items-center justify-center bg-black/5 dark:bg-black/20">
                  <GlassCalendar />
                </CardContent>
              </Card>
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">Live Clock</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Real-time
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-center bg-black/5 dark:bg-black/20 rounded-b-xl p-4">
                  <GlassClock />
                </CardContent>
              </Card>
            </div>
          </AnimatedSection>

          {/* Data Table */}
          <AnimatedSection delay={0.2}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
              <Badge variant="outline" className="text-xs">
                {userData.length} members
              </Badge>
            </div>
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <DataTable
                  data={userData}
                  columns={userColumns}
                  searchable
                  searchPlaceholder="Search members..."
                  itemsPerPage={5}
                  showPagination
                  hoverable
                  bordered={false}
                />
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Timeline */}
          <AnimatedSection delay={0.25}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Project Timeline</h2>
              <Badge variant="outline" className="text-xs">
                In Progress
              </Badge>
            </div>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <Timeline
                  items={projectTimeline}
                  variant="spacious"
                  showConnector
                />
              </CardContent>
            </Card>
          </AnimatedSection>
          {/* Number Ticker Stats */}
          <AnimatedSection delay={0.3}>
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Animated Stats</h2>
              <Badge variant="outline" className="text-xs">
                Number Ticker
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { title: "Page Views", value: 284593, prefix: "", suffix: "", change: "+18.7%", isPositive: true, color: "text-primary", bgColor: "bg-primary/10" },
                { title: "Bounce Rate", value: 24, prefix: "", suffix: "%", change: "-3.2%", isPositive: true, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
                { title: "Avg Session", value: 4, prefix: "", suffix: "m 32s", change: "+0.8%", isPositive: true, color: "text-amber-500", bgColor: "bg-amber-500/10" },
                { title: "Conversions", value: 1284, prefix: "", suffix: "", change: "+31.4%", isPositive: true, color: "text-purple-500", bgColor: "bg-purple-500/10" },
              ].map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow card-hover duration-300 border-border/50">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-xl ${stat.bgColor}`}>
                          <Hash className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div
                          className={`flex items-center gap-1 text-xs font-medium ${
                            stat.isPositive ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {stat.isPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {stat.change}
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold tracking-tight text-foreground">
                          <NumberTicker
                            value={stat.value}
                            className="text-2xl font-bold tracking-tight text-balance"
                            delay={index * 0.15}
                          />
                          <span className="text-lg text-muted-foreground">{stat.suffix}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {stat.title}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>

          {/* Terminal */}
          <AnimatedSection delay={0.35}>
            <div className="flex items-center gap-2 mb-4">
              <TerminalSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Terminal</h2>
              <Badge variant="outline" className="text-xs">
                Interactive
              </Badge>
            </div>
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-6 flex justify-center">
                <Terminal className="max-w-full" startOnView>
                  <TypingAnimation>&gt; npx create-unq-app@latest my-project</TypingAnimation>
                  <AnimatedSpan delay={0.5}>
                    <span className="text-emerald-500">✓</span> Creating project in ./my-project
                  </AnimatedSpan>
                  <AnimatedSpan delay={0.3}>
                    <span className="text-emerald-500">✓</span> Installing dependencies: next, react, typescript
                  </AnimatedSpan>
                  <AnimatedSpan delay={0.3}>
                    <span className="text-emerald-500">✓</span> Setting up Tailwind CSS & shadcn/ui
                  </AnimatedSpan>
                  <AnimatedSpan delay={0.3}>
                    <span className="text-emerald-500">✓</span> Configuring Framer Motion animations
                  </AnimatedSpan>
                  <AnimatedSpan delay={0.3}>
                    <span className="text-emerald-500">✓</span> Adding Magic UI components
                  </AnimatedSpan>
                  <TypingAnimation delay={500}>&gt; cd my-project && bun dev</TypingAnimation>
                  <AnimatedSpan delay={0.5}>
                    <span className="text-primary">⚡</span> Ready on http://localhost:3000
                  </AnimatedSpan>
                  <AnimatedSpan delay={0.3}>
                    <span className="text-muted-foreground">  21st.dev components loaded ✓</span>
                  </AnimatedSpan>
                </Terminal>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Marquee Activity Feed */}
          <AnimatedSection delay={0.4}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Live Activity</h2>
              <Badge variant="default" className="text-xs">
                Streaming
              </Badge>
            </div>
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-4">
                <Marquee pauseOnHover className="[--duration:40s] [--gap:1rem]">
                  {[
                    { user: "Alex R.", action: "deployed to production", time: "2m ago", color: "bg-emerald-500" },
                    { user: "Priya S.", action: "merged PR #1847", time: "5m ago", color: "bg-primary" },
                    { user: "Marcus C.", action: "updated design system", time: "8m ago", color: "bg-purple-500" },
                    { user: "Zara O.", action: "closed 12 issues", time: "12m ago", color: "bg-amber-500" },
                    { user: "Noah K.", action: "pushed 3 commits", time: "15m ago", color: "bg-cyan-500" },
                    { user: "Sofia R.", action: "reviewed PR #1843", time: "18m ago", color: "bg-rose-500" },
                    { user: "Leo P.", action: "released v2.4.0", time: "22m ago", color: "bg-blue-500" },
                    { user: "Isla N.", action: "updated Figma tokens", time: "25m ago", color: "bg-teal-500" },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-muted/30 min-w-[280px]"
                    >
                      <div className={`h-2 w-2 rounded-full ${item.color} shrink-0`} />
                      <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
                        <p className="text-sm text-foreground truncate">
                          <span className="font-medium">{item.user}</span>{" "}
                          <span className="text-muted-foreground">{item.action}</span>
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
                    </div>
                  ))}
                </Marquee>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </main>
    </div>
  );
}
