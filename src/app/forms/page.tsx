"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  LogIn,
  UserPlus,
  Settings,
  Search,
  CheckCircle2,
  Mail,
  Lock,
  User,
  MessageSquare,
  Globe,
  Bell,
  Shield,
  Palette,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Sparkles,
  Briefcase,
  Phone,
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

// ===== CONTACT FORM =====
function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Message sent successfully!", { description: "We'll get back to you within 24 hours." });
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Contact Form</CardTitle>
              <CardDescription>Full-featured contact form with validation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 touch-target w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Message Sent!</h3>
                <p className="text-sm text-muted-foreground text-center">We&apos;ll get back to you within 24 hours.</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="contact-name" placeholder="Your name" className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="contact-email" type="email" placeholder="you@example.com" className="pl-10" required />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="support">Technical Support</SelectItem>
                      <SelectItem value="billing">Billing Question</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea id="contact-message" placeholder="Tell us what you need..." rows={4} required />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="contact-agree" />
                  <Label htmlFor="contact-agree" className="text-sm text-muted-foreground">
                    I agree to the privacy policy
                  </Label>
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Send className="h-4 w-4" /> Send Message
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== LOGIN FORM =====
function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Login successful!", { description: "Welcome back to UnQWebTemplate." });
  };

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <LogIn className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Login Form</CardTitle>
              <CardDescription>Email + Password with remember me</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="login-email" type="email" placeholder="you@example.com" className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="login-remember" />
              <Label htmlFor="login-remember" className="text-sm text-muted-foreground">
                Remember me for 30 days
              </Label>
            </div>
            <Button type="submit" className="w-full gap-2">
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
            <div className="relative my-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                or continue with
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="gap-2">
                <Globe className="h-4 w-4" /> Google
              </Button>
              <Button type="button" variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" /> GitHub
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== REGISTRATION FORM =====
function RegistrationForm() {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      toast.success("Account created!", { description: "Welcome to UnQWebTemplate." });
      setStep(1);
    }
  };

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Registration Form</CardTitle>
              <CardDescription>Multi-field form with validation states</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-6">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex-1 flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i + 1 <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < totalSteps - 1 && (
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: i + 1 < step ? "100%" : "0%" }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-first">First Name</Label>
                      <Input id="reg-first" placeholder="John" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-last">Last Name</Label>
                      <Input id="reg-last" placeholder="Doe" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email Address</Label>
                    <Input id="reg-email" type="email" placeholder="john@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="reg-phone" placeholder="+1 (555) 000-0000" className="pl-10" />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-company">Company</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="reg-company" placeholder="Your company name" className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-role">Role</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="designer">Designer</SelectItem>
                        <SelectItem value="pm">Product Manager</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-exp">Experience Level</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                        <SelectItem value="mid">Mid-level (3-5 years)</SelectItem>
                        <SelectItem value="senior">Senior (6-10 years)</SelectItem>
                        <SelectItem value="lead">Lead (10+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="reg-password" type="password" placeholder="Create a strong password" className="pl-10" required />
                    </div>
                    <div className="space-y-1.5 mt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">8+ characters</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">One uppercase letter</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-muted-foreground">One number</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="reg-confirm" type="password" placeholder="Repeat your password" className="pl-10" required />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox id="reg-terms" />
                    <Label htmlFor="reg-terms" className="text-sm text-muted-foreground">
                      I agree to the Terms of Service and Privacy Policy
                    </Label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="gap-1">
                {step === totalSteps ? (
                  <>
                    <UserPlus className="h-4 w-4" /> Create Account
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== SETTINGS FORM =====
function SettingsForm() {
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [volume, setVolume] = useState([75]);
  const [fontSize, setFontSize] = useState([16]);

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Settings Form</CardTitle>
              <CardDescription>Toggles, Selects, Sliders for preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Notifications</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Browser push alerts</p>
                </div>
                <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Appearance */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Appearance</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Toggle dark theme</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Font Size</p>
                  <Badge variant="secondary">{fontSize[0]}px</Badge>
                </div>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  min={12}
                  max={24}
                  step={1}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Privacy */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Privacy & Security</h4>
            </div>
            <div className="space-y-3">
              <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Profile Visibility</p>
                </div>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Who can see your profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="friends">Friends Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Volume</p>
                  <Badge variant="secondary">{volume[0]}%</Badge>
                </div>
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </div>

          <Button className="w-full gap-2" onClick={() => toast.success("Settings saved!")}>
            <Settings className="h-4 w-4" /> Save Settings
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== SEARCH FORM =====
function SearchForm() {
  const [searchValue, setSearchValue] = useState("");
  const suggestions = [
    "Next.js Documentation",
    "Tailwind CSS Plugins",
    "shadcn/ui Components",
    "Framer Motion Animations",
    "TypeScript Best Practices",
    "React Server Components",
    "Prisma ORM Guide",
    "Zustand State Management",
  ];
  const filtered = searchValue
    ? suggestions.filter((s) => s.toLowerCase().includes(searchValue.toLowerCase()))
    : [];

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Search Form</CardTitle>
              <CardDescription>With autocomplete-style dropdown</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search components, docs, guides..."
              className="pl-10"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <AnimatePresence>
              {filtered.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-full mt-2 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-10"
                >
                  {filtered.map((item, i) => (
                    <motion.button
                      key={item}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left cursor-pointer"
                      onClick={() => {
                        setSearchValue(item);
                        toast.info(`Selected: ${item}`);
                      }}
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span>{item}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Components", "Animations", "Templates", "Hooks", "API"].map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => {
                  setSearchValue(tag);
                  toast.info(`Searching for: ${tag}`);
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== MULTI-STEP FORM WITH PROGRESS =====
function MultiStepForm() {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Personal Info", icon: User },
    { title: "Preferences", icon: Palette },
    { title: "Review", icon: CheckCircle2 },
    { title: "Complete", icon: Sparkles },
  ];
  const progress = ((step + 1) / steps.length) * 100;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      if (step === steps.length - 2) {
        toast.success("Form submitted successfully!");
      }
    } else {
      setStep(0);
    }
  };

  return (
    <motion.div variants={staggerItem}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Multi-Step Form</CardTitle>
              <CardDescription>With progress indicator and step navigation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Step {step + 1} of {steps.length}</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      i <= step
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                    animate={{ scale: i === step ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.div>
                  <span className={`text-xs hidden sm:block ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="Enter your full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" placeholder="you@example.com" />
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Enable notifications</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                  <h4 className="text-sm font-semibold">Review Your Information</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Name: John Doe</p>
                    <p>Email: john@example.com</p>
                    <p>Language: English</p>
                    <p>Notifications: Enabled</p>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-7 touch-target w-7 text-green-500" />
                  </div>
                  <h4 className="font-semibold">All Done!</h4>
                  <p className="text-sm text-muted-foreground text-center">Your information has been submitted.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              Previous
            </Button>
            <Button onClick={handleNext} className="gap-2">
              {step === steps.length - 1 ? (
                <>
                  <Sparkles className="h-4 w-4" /> Restart
                </>
              ) : step === steps.length - 2 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Submit
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===== MAIN PAGE =====
export default function FormsPage() {
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
                <Sparkles className="h-3 w-3" /> Forms Showcase
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
                Form <span className="text-primary">Components</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Interactive form examples built with shadcn/ui components. From simple contact forms to multi-step wizards with progress tracking.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Forms Grid */}
        <div className="section-padding py-10 max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ContactForm />
            <LoginForm />
            <RegistrationForm />
            <SettingsForm />
          </motion.div>

          {/* Full-width sections */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6"
          >
            <SearchForm />
            <MultiStepForm />
          </motion.div>
        </div>

        {/* Footer attribution */}
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
