"use client";

import React from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { DotPattern } from "@/components/ui/dot-pattern";
import { HyperText } from "@/components/ui/hyper-text";
import { WordRotate } from "@/components/ui/word-rotate";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { Meteors } from "@/components/ui/meteors";
import { AnimatedList } from "@/components/ui/animated-list";
import { Marquee } from "@/components/ui/marquee";
import { Particles } from "@/components/ui/particles";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Footer } from "@/components/ui/footer-section";
import {
  Zap,
  Shield,
  BarChart3,
  Globe,
  Rocket,
  Users,
  Check,
  ArrowRight,
  Star,
  Sparkles,
  Lock,
  Cpu,
  Cloud,
  Code2,
  Layers,
  MessageSquare,
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
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// ===== FEATURES DATA =====
const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Sub-second load times with edge-optimized infrastructure and smart caching.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC 2 compliant with end-to-end encryption and role-based access controls.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Real-time dashboards with custom metrics, cohort analysis, and predictive insights.",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Deploy to 40+ regions worldwide with automatic failover and load balancing.",
  },
  {
    icon: Code2,
    title: "Developer First",
    description: "Comprehensive APIs, SDKs, and webhooks with best-in-class documentation.",
  },
  {
    icon: Cloud,
    title: "Cloud Native",
    description: "Kubernetes-optimized with auto-scaling, zero-downtime deployments.",
  },
  {
    icon: Lock,
    title: "Data Privacy",
    description: "GDPR & CCPA compliant with data residency options and audit logging.",
  },
  {
    icon: Cpu,
    title: "AI Powered",
    description: "Built-in machine learning for anomaly detection, recommendations, and automation.",
  },
];

// ===== PRICING DATA =====
const pricingTiers = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for small teams getting started",
    features: [
      "Up to 5 team members",
      "10GB storage",
      "Basic analytics",
      "Email support",
      "2 integrations",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For growing teams that need more power",
    features: [
      "Up to 25 team members",
      "100GB storage",
      "Advanced analytics",
      "Priority support",
      "Unlimited integrations",
      "Custom workflows",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations with complex needs",
    features: [
      "Unlimited team members",
      "Unlimited storage",
      "Custom analytics",
      "24/7 dedicated support",
      "Unlimited integrations",
      "SSO & SAML",
      "SLA guarantee",
      "On-premise option",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

// ===== TESTIMONIALS DATA =====
const testimonials = [
  {
    name: "Sarah Chen",
    role: "CTO at TechFlow",
    content: "Switching to this platform cut our deployment time by 80%. The developer experience is unmatched.",
    avatar: "SC",
    rating: 5,
  },
  {
    name: "Marcus Johnson",
    role: "VP Engineering at ScaleUp",
    content: "The analytics alone paid for the subscription. We identified $2M in optimization opportunities in the first month.",
    avatar: "MJ",
    rating: 5,
  },
  {
    name: "Aisha Patel",
    role: "Founder at CloudNative",
    content: "Best infrastructure decision we've made. 99.99% uptime and their support team is incredible.",
    avatar: "AP",
    rating: 5,
  },
  {
    name: "David Kim",
    role: "Lead Engineer at DataSync",
    content: "The API is beautifully designed. We integrated in under a day and haven't looked back since.",
    avatar: "DK",
    rating: 5,
  },
  {
    name: "Elena Rodriguez",
    role: "Head of Ops at FinServe",
    content: "Enterprise-grade security without enterprise-grade complexity. Our compliance team was thrilled.",
    avatar: "ER",
    rating: 5,
  },
];

// ===== COMPANY LOGOS =====
const companyNames = [
  "Vercel",
  "Stripe",
  "Linear",
  "Notion",
  "Figma",
  "Supabase",
  "Resend",
  "Clerk",
  "Planetscale",
  "Railway",
];

export default function SaaSPage() {
  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* ===== HERO SECTION ===== */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
          <DotPattern
            className="absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
            width={20}
            height={20}
            glow
          />
          <Particles
            className="absolute inset-0"
            quantity={40}
            color="#c96442"
            size={0.6}
          />

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge
                variant="outline"
                className="mb-6 px-4 py-1.5 text-sm border-primary/40 text-primary bg-primary/5"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Now with AI-Powered Analytics
              </Badge>
            </motion.div>

            <HyperText
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight justify-center"
              as="h1"
              startOnView
            >
              Build Your SaaS
            </HyperText>

            <div className="h-20 flex items-center justify-center">
              <WordRotate
                words={[
                  "Ship Faster",
                  "Scale Smarter",
                  "Grow Revenue",
                  "Delight Users",
                  "Own Your Data",
                ]}
                className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-primary"
              />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty"
            >
              The all-in-one platform to launch, grow, and scale your SaaS
              product. From idea to IPO, we&apos;ve got you covered.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <div className="relative">
                <Button size="lg" className="px-8 text-base h-12">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <BorderBeam
                  size={80}
                  duration={4}
                  colorFrom="#c96442"
                  colorTo="#d97757"
                  borderWidth={2}
                />
              </div>
              <Button
                size="lg"
                variant="outline"
                className="px-8 text-base h-12 border-primary/30"
              >
                Watch Demo
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="mt-4 text-xs text-muted-foreground"
            >
              No credit card required &middot; 14-day free trial &middot; Cancel anytime
            </motion.p>
          </div>
        </section>

        {/* ===== STATS SECTION ===== */}
        <section className="py-20 px-6 border-y border-border/50 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8"
            >
              {[
                { value: 50000, suffix: "+", label: "Active Users", icon: Users },
                { value: 99.9, suffix: "%", label: "Uptime SLA", icon: Shield, decimal: 1 },
                { value: 2.4, prefix: "$", suffix: "M", label: "Revenue Processed", icon: BarChart3, decimal: 1 },
                { value: 150, suffix: "+", label: "Integrations", icon: Layers },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  variants={staggerItem}
                  className="text-center"
                >
                  <BlurFade delay={i * 0.15} inView>
                    <div className="flex justify-center mb-3">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <stat.icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                      {stat.prefix}
                      <NumberTicker
                        value={stat.value}
                        decimalPlaces={stat.decimal || 0}
                        className="text-3xl sm:text-4xl font-bold"
                      />
                      {stat.suffix}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                  </BlurFade>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== FEATURES GRID ===== */}
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
                Features
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Everything you need to{" "}
                <span className="text-primary">succeed</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-pretty">
                A complete toolkit designed for modern SaaS teams. Build faster,
                deploy smarter, and scale with confidence.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {features.map((feature) => (
                <motion.div key={feature.title} variants={staggerItem}>
                  <MagicCard
                    className="h-full rounded-xl cursor-pointer"
                    gradientFrom="#c96442"
                    gradientTo="#d97757"
                    gradientSize={300}
                  >
                    <Card className="h-full border-0 bg-transparent shadow-none relative overflow-hidden">
                      <Meteors number={8} />
                      <CardContent className="p-6 relative z-10">
                        <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-4">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </MagicCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== PRICING SECTION ===== */}
        <section className="py-24 px-6 bg-muted/20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
                Pricing
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Simple, transparent{" "}
                <span className="text-primary">pricing</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-pretty">
                No hidden fees. No surprises. Start free and scale as you grow.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch"
            >
              {pricingTiers.map((tier) => (
                <motion.div key={tier.name} variants={staggerItem}>
                  <Card
                    className={`relative h-full overflow-hidden transition-all duration-300 hover:shadow-xl ${
                      tier.popular
                        ? "border-primary shadow-lg scale-[1.02] md:scale-105"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {tier.popular && (
                      <>
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#c96442] to-[#d97757]" />
                        <BorderBeam
                          size={120}
                          duration={6}
                          colorFrom="#c96442"
                          colorTo="#d97757"
                          borderWidth={2}
                        />
                        <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                          Most Popular
                        </Badge>
                      </>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">{tier.price}</span>
                        <span className="text-muted-foreground text-sm">
                          {tier.period}
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {tier.features.map((feat) => (
                          <li
                            key={feat}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full ${
                          tier.popular
                            ? ""
                            : "bg-transparent border border-primary/40 text-primary hover:bg-primary/10"
                        }`}
                        variant={tier.popular ? "default" : "outline"}
                      >
                        {tier.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== TESTIMONIALS SECTION ===== */}
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
                Testimonials
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                Loved by{" "}
                <span className="text-primary">thousands</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-pretty">
                Don&apos;t just take our word for it. Hear from the teams that
                trust us.
              </p>
            </motion.div>

            <div className="max-w-lg mx-auto">
              <AnimatedList delay={2000}>
                {testimonials.map((t) => (
                  <Card
                    key={t.name}
                    className="p-5 transition-all hover:shadow-md hover:border-primary/20"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {t.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {t.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.role}
                          </span>
                        </div>
                        <div className="flex gap-0.5 mb-2">
                          {Array.from({ length: t.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500"
                            />
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                          {t.content}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </AnimatedList>
            </div>
          </div>
        </section>

        {/* ===== CTA SECTION ===== */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="absolute inset-0">
            <FlickeringGrid
              className="absolute inset-0 opacity-20"
              squareSize={3}
              gridGap={6}
              flickerChance={0.1}
              color="#c96442"
              maxOpacity={0.3}
            />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
                Ready to build the{" "}
                <span className="text-primary">future</span>?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto text-pretty">
                Join thousands of teams already shipping faster with our
                platform. Start your free trial today.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <div className="relative">
                  <Button size="lg" className="px-8 h-12 text-base">
                    Start Building Now
                    <Rocket className="ml-2 h-4 w-4" />
                  </Button>
                  <BorderBeam
                    size={80}
                    duration={4}
                    colorFrom="#c96442"
                    colorTo="#d97757"
                    borderWidth={2}
                  />
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 h-12 text-base"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Talk to Sales
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Company Logos Marquee */}
          <div className="relative z-10 mt-16">
            <p className="text-center text-xs text-muted-foreground mb-6 uppercase tracking-widest">
              Trusted by innovative teams worldwide
            </p>
            <Marquee pauseOnHover className="[--duration:30s]">
              {companyNames.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-center mx-8"
                >
                  <span className="text-xl font-bold text-muted-foreground/40 whitespace-nowrap tracking-tight">
                    {name}
                  </span>
                </div>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <div className="px-6 pb-8">
          <Footer />
        </div>
      </main>
    </div>
  );
}
