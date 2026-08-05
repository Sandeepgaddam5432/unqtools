import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PWAInstallPrompt } from "@/components/pwa-install";
import dynamic from "next/dynamic";
import { MotionProvider } from "@/components/motion-provider";

// Lazy-load the command palette (which carries the full 1700-item catalog
// for ⌘K search). It only downloads/parses when the user opens it, keeping
// it out of the initial page bundle on every route.
const CommandPaletteMount = dynamic(
  () => import("@/components/command-palette").then((m) => m.CommandPaletteMount),
  { ssr: false }
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Don't preload mono — it's only used for code blocks
});

const SITE_URL = "https://unqtools.pages.dev";
const SITE_NAME = "UnQTools";
const SITE_DESCRIPTION = "UnQTools is a 100% static, privacy-first, offline-capable PWA of 1700+ fast browser-based tools — converters, calculators, generators, formatters, PDF utilities, SEO tools, developer tools, image tools. No uploads, no tracking, no accounts.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UnQTools — 1700+ Private, Offline Browser Tools",
    template: "%s | UnQTools",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "online tools",
    "browser tools",
    "privacy-first",
    "offline tools",
    "PWA",
    "converters",
    "calculators",
    "generators",
    "formatters",
    "developer tools",
    "text tools",
    "PDF tools",
    "SEO tools",
    "file management",
    "UnQTools",
    "free tools",
    "no signup",
    "no upload",
  ],
  authors: [{ name: "Sandeep Gaddam" }],
  creator: "Sandeep Gaddam",
  publisher: "Sandeep Gaddam",
  applicationName: "UnQTools",
  category: "technology",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "UnQTools — 1700+ Private, Offline Browser Tools",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/logo.svg",
        width: 512,
        height: 512,
        alt: "UnQTools logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "UnQTools — 1700+ Private, Offline Browser Tools",
    description: SITE_DESCRIPTION,
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "16Juy3RfizYlwt9vTmBpkS-9qeDAVSg7gvYUzEE9ecU",
  },
};

// JSON-LD structured data for the website
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "UnQTools",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/tools?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "UnQTools",
  url: SITE_URL,
  founder: {
    "@type": "Person",
    name: "Sandeep Gaddam",
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <MotionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <PWAInstallPrompt />
            <CommandPaletteMount />
          </ThemeProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
