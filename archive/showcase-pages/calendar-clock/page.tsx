"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { GlassClock } from "@/components/ui/glass-clock";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon,
  Clock,
  Globe2,
  CalendarDays,
  Timer,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CalendarCheck,
} from "lucide-react";
import { format, addDays } from "date-fns";

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// Mini Calendar Component
function MiniCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === month &&
    today.getFullYear() === year;

  const isSelected = (day: number) =>
    selectedDay &&
    selectedDay.getDate() === day &&
    selectedDay.getMonth() === month &&
    selectedDay.getFullYear() === year;

  return (
    <div className="w-full max-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h4 className="text-sm font-semibold">
          {format(currentDate, "MMMM yyyy")}
        </h4>
        <button
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div
            key={d}
            className="text-[10px] font-semibold text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {day ? (
              <button
                onClick={() => setSelectedDay(new Date(year, month, day))}
                className={`w-7 h-7 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isSelected(day)
                    ? "bg-primary text-primary-foreground shadow-md"
                    : isToday(day)
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// World Clock Component
function WorldClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const zones = [
    { city: "New York", tz: "America/New_York", flag: "🇺🇸" },
    { city: "London", tz: "Europe/London", flag: "🇬🇧" },
    { city: "Tokyo", tz: "Asia/Tokyo", flag: "🇯🇵" },
    { city: "Sydney", tz: "Australia/Sydney", flag: "🇦🇺" },
  ];

  const getTimeString = (tz: string) => {
    return time.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const getDateStr = (tz: string) => {
    return time.toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getOffset = (tz: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(time);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    return offsetPart?.value || "";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {zones.map((zone, i) => (
        <motion.div
          key={zone.city}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="relative p-4 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{zone.flag}</span>
              <div>
                <p className="text-sm font-semibold">{zone.city}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  {getOffset(zone.tz)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-bold text-primary tabular-nums">
                {getTimeString(zone.tz)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {getDateStr(zone.tz)}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Event Scheduler
function EventScheduler() {
  const events = [
    {
      title: "Team Standup",
      time: "9:00 AM - 9:30 AM",
      date: format(new Date(), "MMM d"),
      color: "bg-primary",
      textColor: "text-primary",
    },
    {
      title: "Design Review",
      time: "11:00 AM - 12:00 PM",
      date: format(new Date(), "MMM d"),
      color: "bg-purple-500",
      textColor: "text-purple-500",
    },
    {
      title: "Sprint Planning",
      time: "2:00 PM - 3:30 PM",
      date: format(addDays(new Date(), 1), "MMM d"),
      color: "bg-emerald-500",
      textColor: "text-emerald-500",
    },
    {
      title: "Client Demo",
      time: "4:00 PM - 5:00 PM",
      date: format(addDays(new Date(), 1), "MMM d"),
      color: "bg-amber-500",
      textColor: "text-amber-500",
    },
    {
      title: "Release Party 🎉",
      time: "6:00 PM - 8:00 PM",
      date: format(addDays(new Date(), 2), "MMM d"),
      color: "bg-rose-500",
      textColor: "text-rose-500",
    },
  ];

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {events.map((event, i) => (
        <motion.div
          key={event.title}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="flex items-start gap-3 p-3 rounded-lg border border-border/20 hover:border-border/40 hover:bg-muted/20 transition-all cursor-pointer group"
        >
          <div
            className={`w-1 h-full min-h-[40px] rounded-full ${event.color} flex-shrink-0`}
          />
          <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
            <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {event.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {event.time}
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] h-5 flex-shrink-0"
          >
            {event.date}
          </Badge>
        </motion.div>
      ))}
    </div>
  );
}

// Time Range Picker
function TimeRangePicker() {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    const h = hour.toString().padStart(2, "0");
    return `${h}:${minute}`;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Start Time
          </label>
          <select
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full h-10 rounded-lg border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-6">
          <Arrow className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            End Time
          </label>
          <select
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full h-10 rounded-lg border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual timeline */}
      <div className="relative h-16 bg-muted/20 rounded-lg border border-border/20 overflow-hidden">
        <div className="absolute inset-0 flex">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-border/10 last:border-0 relative">
              {i % 3 === 0 && (
                <span className="absolute bottom-1 left-0 text-[8px] text-muted-foreground/50">
                  {i}h
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Selected range highlight */}
        <motion.div
          className="absolute top-2 bottom-2 bg-primary/20 rounded-md border border-primary/30"
          layout
          style={{
            left: `${(parseInt(startTime.split(":")[0]) + parseInt(startTime.split(":")[1]) / 60) / 24 * 100}%`,
            width: `${((parseInt(endTime.split(":")[0]) + parseInt(endTime.split(":")[1]) / 60) - (parseInt(startTime.split(":")[0]) + parseInt(startTime.split(":")[1]) / 60)) / 24 * 100}%`,
          }}
        />
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Selected:{" "}
          <span className="text-primary font-semibold">{startTime}</span>{" "}
          —{" "}
          <span className="text-primary font-semibold">{endTime}</span>
        </p>
      </div>
    </div>
  );
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function CalendarClockPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-background py-20 section-padding">
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(201,100,66,0.08) 0%, transparent 60%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-4xl mx-auto text-center"
          >
            <Badge
              variant="outline"
              className="mb-4 border-primary/30 text-primary bg-primary/10"
            >
              <CalendarDays className="h-3 w-3 mr-1" />
              Time & Date
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Calendar <span className="text-primary">&amp; Clock</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Beautiful time and date components with glass effects, world
              clocks, event scheduling, and more.
            </p>
          </motion.div>
        </div>

        <div className="section-padding py-6 sm:py-12 space-y-12">
          {/* GlassCalendar + GlassClock */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/30 overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    Glass Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center bg-black rounded-b-xl">
                  <GlassCalendar />
                </CardContent>
              </Card>
              <Card className="border-border/30 overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    Glass Clock
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center bg-black/5 rounded-b-xl">
                  <GlassClock />
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* Mini Calendar + Date Picker */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Mini Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <MiniCalendar />
                </CardContent>
              </Card>
              <Card className="border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    Date Picker
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full max-w-sm justify-start text-left font-normal gap-2 border-border/50"
                      >
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        {date ? (
                          format(date, "PPP")
                        ) : (
                          <span className="text-muted-foreground">
                            Pick a date
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                      />
                    </PopoverContent>
                  </Popover>
                  {date && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center space-y-1"
                    >
                      <p className="text-sm text-muted-foreground">
                        Selected Date
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {format(date, "EEEE, MMMM d, yyyy")}
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* World Clock */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Card className="border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe2 className="h-5 w-5 text-primary" />
                  World Clock
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Live
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorldClockWidget />
              </CardContent>
            </Card>
          </motion.section>

          {/* Event Scheduler + Time Range Picker */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                      Event Scheduler
                    </CardTitle>
                    <Button
                      variant="outline"
                     
                      className="h-7 touch-target text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3 w-3" />
                      Add Event
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <EventScheduler />
                </CardContent>
              </Card>
              <Card className="border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Timer className="h-5 w-5 text-primary" />
                    Time Range Picker
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TimeRangePicker />
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-8 border-t border-border/30 safe-area-bottom"
          >
            <p className="text-muted-foreground text-sm">
              Built with ❤️ by Sandeep Gaddam
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
