"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/ui/basic-data-table";
import { Timeline, type TimelineItemData } from "@/components/ui/timeline";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  BarChart3,
  Rocket,
  Code,
  Palette,
  Database,
  Globe,
  Layers,
  Zap,
  Cpu,
  Bug,
  TestTube2,
  GitBranch,
  Monitor,
  Star,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

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

// ===== EMPLOYEE DATA =====
type Employee = {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: string;
  status: "Active" | "On Leave" | "Remote" | "Probation";
  startDate: string;
};

const employeeData: Employee[] = [
  { id: 1, name: "Ava Thompson", department: "Engineering", role: "Senior Developer", salary: "$125,000", status: "Active", startDate: "2021-03-15" },
  { id: 2, name: "Marcus Chen", department: "Design", role: "Lead Designer", salary: "$118,000", status: "Active", startDate: "2020-07-22" },
  { id: 3, name: "Elena Rodriguez", department: "Product", role: "Product Manager", salary: "$132,000", status: "Remote", startDate: "2019-11-05" },
  { id: 4, name: "James Wilson", department: "Engineering", role: "DevOps Engineer", salary: "$115,000", status: "Active", startDate: "2022-01-10" },
  { id: 5, name: "Sofia Patel", department: "Marketing", role: "Marketing Director", salary: "$128,000", status: "Active", startDate: "2020-04-18" },
  { id: 6, name: "Ryan O'Brien", department: "Engineering", role: "Frontend Developer", salary: "$105,000", status: "On Leave", startDate: "2021-09-03" },
  { id: 7, name: "Mia Kim", department: "Design", role: "UX Researcher", salary: "$98,000", status: "Active", startDate: "2022-06-14" },
  { id: 8, name: "Daniel Martinez", department: "Sales", role: "Sales Manager", salary: "$110,000", status: "Active", startDate: "2020-12-01" },
  { id: 9, name: "Olivia Brown", department: "Engineering", role: "Backend Developer", salary: "$120,000", status: "Remote", startDate: "2021-05-20" },
  { id: 10, name: "Liam Davis", department: "Product", role: "Scrum Master", salary: "$108,000", status: "Active", startDate: "2022-03-08" },
  { id: 11, name: "Isabella Garcia", department: "HR", role: "HR Manager", salary: "$102,000", status: "Active", startDate: "2019-08-25" },
  { id: 12, name: "Ethan Nguyen", department: "Engineering", role: "Full Stack Developer", salary: "$122,000", status: "Probation", startDate: "2023-01-15" },
  { id: 13, name: "Charlotte Lee", department: "Design", role: "Visual Designer", salary: "$95,000", status: "Active", startDate: "2022-09-12" },
  { id: 14, name: "Noah Taylor", department: "Engineering", role: "QA Engineer", salary: "$100,000", status: "Remote", startDate: "2021-07-30" },
  { id: 15, name: "Amelia White", department: "Marketing", role: "Content Strategist", salary: "$88,000", status: "Active", startDate: "2022-11-05" },
  { id: 16, name: "Lucas Anderson", department: "Sales", role: "Account Executive", salary: "$95,000", status: "Active", startDate: "2023-02-20" },
  { id: 17, name: "Harper Thomas", department: "Engineering", role: "Cloud Architect", salary: "$145,000", status: "Active", startDate: "2018-06-15" },
  { id: 18, name: "Benjamin Jackson", department: "Product", role: "Data Analyst", salary: "$98,000", status: "On Leave", startDate: "2021-11-28" },
];

const employeeColumns: DataTableColumn<Employee>[] = [
  { key: "name", header: "Name", sortable: true, filterable: true,
    render: (value) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
          {String(value).split(" ").map((n: string) => n[0]).join("")}
        </div>
        <span className="font-medium">{String(value)}</span>
      </div>
    ),
  },
  { key: "department", header: "Department", sortable: true, filterable: true,
    render: (value) => <Badge variant="secondary">{String(value)}</Badge>,
  },
  { key: "role", header: "Role", sortable: true },
  { key: "salary", header: "Salary", sortable: true },
  { key: "status", header: "Status", sortable: true,
    render: (value) => {
      const colors: Record<string, string> = {
        Active: "bg-green-500/10 text-green-500 border-green-500/20",
        "On Leave": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        Remote: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        Probation: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      };
      return (
        <span className={`text-xs px-2 py-1 rounded-md border ${colors[String(value)] || ""}`}>
          {String(value)}
        </span>
      );
    },
  },
  { key: "startDate", header: "Start Date", sortable: true },
];

// ===== TIMELINE DATA =====
const timelineItems: TimelineItemData[] = [
  { id: "1", title: "Project Kickoff", description: "Initial planning and team formation for the UnQWebTemplate project.", date: "Jan 2024", status: "completed", icon: Rocket },
  { id: "2", title: "Design System Created", description: "Established the core design tokens, color system, and component library.", date: "Feb 2024", status: "completed", icon: Palette },
  { id: "3", title: "Core Components Built", description: "Developed 40+ reusable shadcn/ui components with full TypeScript support.", date: "Mar 2024", status: "completed", icon: Layers },
  { id: "4", title: "Database Integration", description: "Integrated Prisma ORM with SQLite for seamless data management.", date: "Apr 2024", status: "completed", icon: Database },
  { id: "5", title: "API Development", description: "Built RESTful API routes with Next.js 16 App Router server actions.", date: "May 2024", status: "in-progress", icon: Code },
  { id: "6", title: "Testing Phase", description: "Comprehensive unit and integration testing across all components.", date: "Jun 2024", status: "in-progress", icon: TestTube2 },
  { id: "7", title: "Bug Fixes & Polish", description: "Resolve reported issues and polish the UI for production readiness.", date: "Jul 2024", status: "pending", icon: Bug },
  { id: "8", title: "Production Launch", description: "Deploy to production with full CI/CD pipeline and monitoring.", date: "Aug 2024", status: "pending", icon: Globe },
];

// ===== RADIAL ORBITAL TIMELINE DATA =====
const orbitalTimelineData = [
  { id: 1, title: "Plan", date: "Q1 2024", content: "Architecture planning and design system setup", category: "Planning", icon: Rocket, relatedIds: [2, 3], status: "completed" as const, energy: 95 },
  { id: 2, title: "Design", date: "Q1 2024", content: "UI/UX design and component prototyping", category: "Design", icon: Palette, relatedIds: [1, 3], status: "completed" as const, energy: 88 },
  { id: 3, title: "Develop", date: "Q2 2024", content: "Core development and feature implementation", category: "Development", icon: Code, relatedIds: [1, 2, 4], status: "in-progress" as const, energy: 72 },
  { id: 4, title: "Test", date: "Q3 2024", content: "Quality assurance and testing cycle", category: "Testing", icon: TestTube2, relatedIds: [3, 5], status: "pending" as const, energy: 45 },
  { id: 5, title: "Deploy", date: "Q3 2024", content: "CI/CD setup and production deployment", category: "DevOps", icon: Globe, relatedIds: [4, 6], status: "pending" as const, energy: 30 },
  { id: 6, title: "Monitor", date: "Q4 2024", content: "Performance monitoring and analytics", category: "Operations", icon: Activity, relatedIds: [5, 1], status: "pending" as const, energy: 15 },
];

// ===== CHART DATA =====
const lineChartData = [
  { month: "Jan", revenue: 4200, users: 240 },
  { month: "Feb", revenue: 5100, users: 310 },
  { month: "Mar", revenue: 4800, users: 290 },
  { month: "Apr", revenue: 6300, users: 380 },
  { month: "May", revenue: 7200, users: 420 },
  { month: "Jun", revenue: 6800, users: 400 },
  { month: "Jul", revenue: 8100, users: 490 },
  { month: "Aug", revenue: 9200, users: 550 },
  { month: "Sep", revenue: 8700, users: 520 },
  { month: "Oct", revenue: 10200, users: 600 },
  { month: "Nov", revenue: 11500, users: 680 },
  { month: "Dec", revenue: 12800, users: 750 },
];

const barChartData = [
  { department: "Engineering", employees: 45, budget: 520 },
  { department: "Design", employees: 18, budget: 210 },
  { department: "Product", employees: 12, budget: 180 },
  { department: "Marketing", employees: 22, budget: 340 },
  { department: "Sales", employees: 30, budget: 290 },
  { department: "HR", employees: 8, budget: 120 },
];

const pieChartData = [
  { name: "React", value: 40, color: "#c96442" },
  { name: "TypeScript", value: 25, color: "#d97757" },
  { name: "Tailwind", value: 20, color: "#e8956e" },
  { name: "Next.js", value: 15, color: "#b05730" },
];

// ===== COLLECTION DATA =====
const collectionItems = [
  { id: 1, title: "Dashboard Template", category: "Admin", rating: 4.9, downloads: "12.4k", image: "📊" },
  { id: 2, title: "E-Commerce Kit", category: "Store", rating: 4.8, downloads: "9.2k", image: "🛒" },
  { id: 3, title: "SaaS Landing", category: "Marketing", rating: 4.7, downloads: "15.1k", image: "🚀" },
  { id: 4, title: "Blog Template", category: "Content", rating: 4.6, downloads: "7.8k", image: "📝" },
  { id: 5, title: "Portfolio Pro", category: "Personal", rating: 4.9, downloads: "11.3k", image: "🎨" },
  { id: 6, title: "CRM Dashboard", category: "Admin", rating: 4.5, downloads: "6.5k", image: "📈" },
];

// ===== STATS CARDS =====
function StatsCards() {
  const stats = [
    { title: "Total Revenue", value: "$128,400", change: "+12.5%", trend: "up", icon: DollarSign, color: "text-green-500" },
    { title: "Active Users", value: "8,429", change: "+8.2%", trend: "up", icon: Users, color: "text-blue-500" },
    { title: "Conversion Rate", value: "3.24%", change: "-0.4%", trend: "down", icon: Activity, color: "text-yellow-500" },
    { title: "Avg. Session", value: "4m 32s", change: "+2.1%", trend: "up", icon: BarChart3, color: "text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isUp = stat.trend === "up";
        return (
          <motion.div key={stat.title} variants={staggerItem}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
                    {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {stat.change}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ===== CHARTS SECTION =====
function ChartsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Line Chart */}
      <motion.div variants={staggerItem}>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Revenue & Users</CardTitle>
            <CardDescription>Monthly performance trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)", r: 4 }} name="Revenue ($)" />
                  <Line type="monotone" dataKey="users" stroke="#9c87f5" strokeWidth={2} dot={{ fill: "#9c87f5", r: 4 }} name="Users" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bar Chart */}
      <motion.div variants={staggerItem}>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Department Overview</CardTitle>
            <CardDescription>Employee count and budget by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="department" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="employees" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Employees" />
                  <Bar dataKey="budget" fill="#9c87f5" radius={[4, 4, 0, 0]} name="Budget ($K)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Area Chart */}
      <motion.div variants={staggerItem}>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Growth Trajectory</CardTitle>
            <CardDescription>Revenue growth over the year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pie Chart */}
      <motion.div variants={staggerItem}>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Tech Stack Distribution</CardTitle>
            <CardDescription>Codebase composition by technology</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {pieChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name} ({item.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ===== COLLECTION VIEW =====
function CollectionView() {
  const [filter, setFilter] = useState("All");
  const categories = ["All", "Admin", "Store", "Marketing", "Content", "Personal"];
  const filtered = filter === "All" ? collectionItems : collectionItems.filter((i) => i.category === filter);

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Collection View</CardTitle>
              <CardDescription>Grid items with category filtering</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {categories.map((cat) => (
              <Button
                key={cat}
               
                variant={filter === cat ? "default" : "outline"}
                onClick={() => setFilter(cat)}
                className="text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="group p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{item.image}</span>
                  <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                </div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{item.title}</h4>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-muted-foreground">{item.rating}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.downloads} downloads</span>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== MAIN PAGE =====
export default function DataDisplayPage() {
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
                <BarChart3 className="h-3 w-3" /> Data Display
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
                Data <span className="text-primary">Visualization</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Powerful data display components including tables, timelines, charts, and collection views for building data-rich applications.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-10 max-w-7xl mx-auto space-y-10">
          {/* Stats Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <StatsCards />
          </motion.div>

          {/* DataTable */}
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Employee DataTable</CardTitle>
                    <CardDescription>Sortable, searchable, paginated with 18 rows of sample data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={employeeData}
                  columns={employeeColumns}
                  searchable
                  searchPlaceholder="Search employees..."
                  itemsPerPage={6}
                  showPagination
                  hoverable
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Timeline + Radial Orbital */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
            >
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                      <GitBranch className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Project Timeline</CardTitle>
                      <CardDescription>8 milestones with status tracking</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="max-h-[480px] overflow-y-auto">
                  <Timeline
                    items={timelineItems}
                    showConnector
                    variant="compact"
                  />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
            >
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                      <Cpu className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Radial Orbital Timeline</CardTitle>
                      <CardDescription>Click nodes to explore project phases</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <RadialOrbitalTimeline timelineData={orbitalTimelineData} />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Charts */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <ChartsSection />
          </motion.div>

          {/* Collection View */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            <CollectionView />
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
