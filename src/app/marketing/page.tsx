"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Globe } from "@/components/ui/globe";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Ripple } from "@/components/ui/ripple";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Check,
  X,
  ArrowRight,
  Star,
  Sparkles,
  Megaphone,
  TrendingUp,
  Users,
  Award,
  Zap,
  Send,
  Building2,
  Target,
  Heart,
} from "lucide-react";

// ===== ANIMATION VARIANTS =====
const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
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
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ===== BRAND LOGOS =====
const brandLogos = [
  "Google",
  "Microsoft",
  "Amazon",
  "Meta",
  "Apple",
  "Netflix",
  "Spotify",
  "Uber",
  "Airbnb",
  "Slack",
  "Shopify",
  "Stripe",
];

// ===== COMPARISON DATA =====
const comparisonFeatures = [
  { feature: "Real-time Analytics", us: true, competitor1: true, competitor2: false },
  { feature: "Custom Dashboards", us: true, competitor1: false, competitor2: true },
  { feature: "AI Predictions", us: true, competitor1: false, competitor2: false },
  { feature: "API Access", us: true, competitor1: true, competitor2: true },
  { feature: "White Labeling", us: true, competitor1: false, competitor2: false },
  { feature: "SSO / SAML", us: true, competitor1: true, competitor2: false },
  { feature: "Unlimited Workspaces", us: true, competitor1: false, competitor2: true },
  { feature: "Priority Support", us: true, competitor1: false, competitor2: false },
  { feature: "Data Residency", us: true, competitor1: true, competitor2: false },
  { feature: "99.99% SLA", us: true, competitor1: false, competitor2: false },
];

// ===== FAQ DATA =====
const faqs = [
  {
    q: "How does the free trial work?",
    a: "You get full access to all Pro features for 14 days. No credit card required. At the end of the trial, you can choose a plan that fits your needs or continue with our free tier.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle. If you upgrade mid-cycle, we'll prorate the difference.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Your data remains accessible for 30 days after cancellation. During this period, you can export all your data. After 30 days, data is permanently deleted in compliance with GDPR requirements.",
  },
  {
    q: "Do you offer custom enterprise solutions?",
    a: "Yes! Our Enterprise plan is fully customizable. We offer dedicated infrastructure, custom integrations, SLA guarantees, and a dedicated success manager. Contact our sales team for a tailored proposal.",
  },
  {
    q: "How secure is my data?",
    a: "Security is our top priority. We're SOC 2 Type II certified, GDPR compliant, and use AES-256 encryption at rest and TLS 1.3 in transit. We undergo regular third-party security audits.",
  },
  {
    q: "What integrations do you support?",
    a: "We support 150+ integrations including Slack, Jira, GitHub, GitLab, Figma, Notion, and many more. We also offer a powerful API and webhooks for custom integrations.",
  },
];

// ===== TESTIMONIAL CARDS =====
const socialTestimonials = [
  {
    name: "Alex Rivera",
    role: "CEO at LaunchPad",
    content: "This platform transformed our go-to-market strategy. We 3x'd our conversion rate in the first quarter.",
    avatar: "AR",
  },
  {
    name: "Priya Sharma",
    role: "CMO at GrowthLabs",
    content: "The analytics are insane. I can finally attribute revenue to specific campaigns with confidence.",
    avatar: "PS",
  },
  {
    name: "Tom Chen",
    role: "Head of Growth at Bolt",
    content: "We replaced 4 different tools with this one platform. The ROI is incredible.",
    avatar: "TC",
  },
];

export default function MarketingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* ===== ANNOUNCEMENT BAR ===== */}
        <div className="bg-gradient-to-r from-primary to-[#d97757] text-primary-foreground py-2.5 px-4">
          <Marquee pauseOnHover className="[--duration:30s] [--gap:2rem]">
            {[
              "🚀 New: AI-Powered Campaign Builder — Launch campaigns 10x faster",
              "🎉 We just hit 50K+ customers worldwide!",
              "📊 Q1 2025 Report: Customers see 340% ROI on average",
              "⚡ New Integration: Connect with 150+ tools seamlessly",
            ].map((text, i) => (
              <span key={i} className="text-sm font-medium whitespace-nowrap">
                {text}
              </span>
            ))}
          </Marquee>
        </div>

        {/* ===== HERO WITH GLOBE ===== */}
        <section
          ref={heroRef}
          className="relative min-h-[90vh] flex items-center overflow-hidden"
        >
          <AnimatedGridPattern
            numSquares={30}
            maxOpacity={0.15}
            duration={3}
            className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
          />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
            <motion.div style={{ y: heroY, opacity: heroOpacity }}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-1.5 border-primary/40 text-primary bg-primary/5"
              >
                <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                Marketing Reimagined
              </Badge>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Grow your brand{" "}
                <span className="text-primary">exponentially</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg">
                The marketing platform that combines analytics, automation, and
                AI to deliver measurable results. Stop guessing, start growing.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <div className="relative">
                  <Button size="lg" className="px-8 h-12 text-base">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 text-base border-primary/30"
                >
                  See It In Action
                </Button>
              </div>

              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  No credit card
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  14-day trial
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  Cancel anytime
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative h-[400px] lg:h-[500px]"
            >
              <Globe className="relative" />
              <Ripple className="opacity-30" />
            </motion.div>
          </div>
        </section>

        {/* ===== SCROLL VELOCITY TEXT ===== */}
        <div className="py-4 border-y border-border/50 overflow-hidden">
          <ScrollVelocityContainer className="w-full">
            <ScrollVelocityRow
              baseVelocity={3}
              className="text-4xl sm:text-5xl font-black tracking-tight text-muted-foreground/20 py-2"
            >
              <span className="mx-8">MARKETING</span>
              <span className="mx-8 text-primary/30">&bull;</span>
              <span className="mx-8">AUTOMATION</span>
              <span className="mx-8 text-primary/30">&bull;</span>
              <span className="mx-8">ANALYTICS</span>
              <span className="mx-8 text-primary/30">&bull;</span>
              <span className="mx-8">GROWTH</span>
              <span className="mx-8 text-primary/30">&bull;</span>
              <span className="mx-8">SCALE</span>
              <span className="mx-8 text-primary/30">&bull;</span>
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
        </div>

        {/* ===== LOGO CLOUD ===== */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium">
                Trusted by industry leaders
              </p>
            </motion.div>

            <Marquee pauseOnHover className="[--duration:25s] opacity-40">
              {brandLogos.map((brand) => (
                <div
                  key={brand}
                  className="flex items-center justify-center mx-10"
                >
                  <span className="text-2xl font-bold tracking-tight text-foreground whitespace-nowrap">
                    {brand}
                  </span>
                </div>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ===== FEATURE COMPARISON ===== */}
        <section className="py-24 px-6 bg-muted/20">
          <div className="max-w-4xl mx-auto">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-12"
            >
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                Compare
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                See how we <span className="text-primary">stack up</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                Feature-by-feature comparison with leading alternatives.
              </p>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-4 font-semibold">Feature</th>
                        <th className="text-center p-4 font-semibold">
                          <span className="text-primary">UnQWeb</span>
                        </th>
                        <th className="text-center p-4 font-semibold text-muted-foreground">
                          Competitor A
                        </th>
                        <th className="text-center p-4 font-semibold text-muted-foreground">
                          Competitor B
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((row, i) => (
                        <tr
                          key={row.feature}
                          className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                        >
                          <td className="p-4 font-medium">{row.feature}</td>
                          <td className="p-4 text-center">
                            {row.us ? (
                              <Check className="h-5 w-5 text-primary mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {row.competitor1 ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {row.competitor2 ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ===== SOCIAL PROOF ===== */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                Social Proof
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Numbers that speak{" "}
                <span className="text-primary">for themselves</span>
              </h2>
            </motion.div>

            {/* Stats Row */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mb-16"
            >
              {[
                { value: 50000, suffix: "+", label: "Marketing Teams", icon: Users },
                { value: 340, suffix: "%", label: "Average ROI", icon: TrendingUp },
                { value: 12, suffix: "M+", label: "Campaigns Sent", icon: Zap },
                { value: 98, suffix: "%", label: "Satisfaction Rate", icon: Award },
              ].map((stat, i) => (
                <motion.div key={stat.label} variants={staggerItem}>
                  <BlurFade delay={i * 0.12} inView>
                    <Card className="p-6 text-center hover:shadow-md transition-shadow card-hover hover:border-primary/20">
                      <div className="flex justify-center mb-3">
                        <div className="p-3 rounded-xl bg-primary/10">
                          <stat.icon className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold">
                        <NumberTicker
                          value={stat.value}
                          className="text-3xl font-bold"
                        />
                        {stat.suffix}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                    </Card>
                  </BlurFade>
                </motion.div>
              ))}
            </motion.div>

            {/* Testimonial Cards */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {socialTestimonials.map((t) => (
                <motion.div key={t.name} variants={staggerItem}>
                  <Card className="p-6 h-full hover:shadow-md transition-all card-hover hover:border-primary/20">
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-yellow-500 text-yellow-500"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      &ldquo;{t.content}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 mt-auto">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {t.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.role}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== FAQ SECTION ===== */}
        <section className="py-24 px-6 bg-muted/20">
          <div className="max-w-3xl mx-auto">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-12"
            >
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                FAQ
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Frequently asked{" "}
                <span className="text-primary">questions</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                Everything you need to know about our platform.
              </p>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <Card className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger className="text-left text-sm font-medium hover:text-primary transition-colors">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ===== NEWSLETTER CTA ===== */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <AnimatedGridPattern
            numSquares={20}
            maxOpacity={0.1}
            duration={3}
            className="absolute inset-0 opacity-50"
          />
          <Ripple className="opacity-20" />

          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl bg-primary/10">
                  <Send className="h-8 touch-target w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Stay ahead of the{" "}
                <span className="text-primary">curve</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-pretty">
                Get weekly insights on marketing trends, growth strategies, and
                product updates. Join 25,000+ marketers.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="h-11 bg-background/80 backdrop-blur-sm"
                />
                <Button className="h-11 px-6 whitespace-nowrap">
                  Subscribe
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                No spam, ever. Unsubscribe at any time.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ===== BOTTOM CTA ===== */}
        <section className="py-20 px-6 border-t border-border/50">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <h2 className="text-2xl font-bold">
                Ready to transform your marketing?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Start your free trial and see results in days, not months.
              </p>
              <div className="mt-6 flex justify-center gap-4">
                <Button size="lg" className="px-8">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
