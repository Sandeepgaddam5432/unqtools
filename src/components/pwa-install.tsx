"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone, Bell, BellRing } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    "default" | "granted" | "denied"
  >("default");

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay for better UX
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.log("SW registration failed:", err);
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setShowPrompt(false);
      }
    } catch (err) {
      console.error("Install prompt error:", err);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleNotification = useCallback(async () => {
    if (!("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        new Notification("UnQWebTemplate", {
          body: "Notifications enabled! You'll get updates on new features.",
          icon: "/logo.svg",
        });
      }
    } catch (err) {
      console.error("Notification error:", err);
    }
  }, []);

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[400px] z-[100] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 p-5"
        >
          <button
            onClick={() => setShowPrompt(false)}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-base mb-1">
                Install UnQWebTemplate
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add to your home screen for instant access, offline support, and
                push notifications.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                {deferredPrompt && (
                  <Button
                    onClick={handleInstall}
                    size="sm"
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Install App
                  </Button>
                )}
                {notificationPermission !== "granted" && (
                  <Button
                    onClick={handleNotification}
                    variant="outline"
                    size="sm"
                    className="gap-2 cursor-pointer"
                  >
                    {notificationPermission === "denied" ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellRing className="h-4 w-4" />
                    )}
                    Enable Notifications
                  </Button>
                )}
                {notificationPermission === "granted" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                    <BellRing className="h-3.5 w-3.5" />
                    Notifications enabled
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Standalone PWA section for landing page
export function PWAInstallSection() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    "default" | "granted" | "denied"
  >("default");

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleNotification = useCallback(async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      new Notification("UnQWebTemplate", {
        body: "Welcome! You'll now receive updates on new features and components.",
        icon: "/logo.svg",
      });
    }
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Install Card */}
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
            <Download className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Install as PWA
          </h3>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Install UnQWebTemplate as a Progressive Web App for instant loading,
            offline access, and a native app-like experience. Works on any
            device — desktop, tablet, or mobile.
          </p>
          {deferredPrompt ? (
            <Button
              onClick={handleInstall}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Install Now
            </Button>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>
                Open in Chrome/Edge → Menu → Install App
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Notification Card */}
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
            <Bell className="h-7 w-7 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Push Notifications
          </h3>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Enable push notifications to stay updated with new component
            releases, feature updates, and important announcements. Never miss
            an update from UnQWebTemplate.
          </p>
          {notificationPermission === "granted" ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-sm text-emerald-500 font-medium">
              <BellRing className="h-4 w-4" />
              Notifications Enabled
            </div>
          ) : (
            <Button
              onClick={handleNotification}
              variant="outline"
              className="gap-2 cursor-pointer"
            >
              <BellRing className="h-4 w-4" />
              Enable Notifications
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
