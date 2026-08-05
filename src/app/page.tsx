import type { Metadata } from "next";
import HomePageClient from "./home-page-client";

const SITE_URL = "https://unqtools.pages.dev";

export const metadata: Metadata = {
  title: "UnQTools — 1700+ Private, Offline Browser Tools",
  description:
    "1700+ free online tools that run 100% in your browser — PDF utilities, file converters, text tools, calculators, SEO tools, security tools, developer tools, image tools. No uploads, no tracking, no accounts. Privacy-first PWA.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "UnQTools — 1700+ Private, Offline Browser Tools",
    description:
      "1700+ free online tools that run 100% in your browser. No uploads, no tracking, no accounts.",
    siteName: "UnQTools",
    images: [{ url: "/logo.svg", width: 512, height: 512, alt: "UnQTools" }],
  },
  twitter: {
    card: "summary",
    title: "UnQTools — 1700+ Private, Offline Browser Tools",
    description:
      "1700+ free online tools that run 100% in your browser. No uploads, no tracking, no accounts.",
    images: ["/logo.svg"],
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
