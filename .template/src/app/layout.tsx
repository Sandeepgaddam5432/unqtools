import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnQTools — 1,679 Privacy-First Browser Tools",
  description:
    "An offline-ready, 100% client-side suite of 1,679 browser tools. PDF, developer, security, AI, calculators and more — your data never leaves your device.",
};

export const viewport: Viewport = {
  themeColor: "#090D16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-[#090D16] font-sans text-white antialiased">
        {children}
      </body>
    </html>
  );
}
