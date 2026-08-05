'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Github, Heart, Lock, WifiOff, Zap } from 'lucide-react';
import Link from 'next/link';
import { TOOL_COUNT, ACTIVE_CATEGORIES } from '@/lib/counts';
import { CATEGORY_LABELS, type ToolCategory } from '@/lib/tool';

interface FooterLink {
  title: string;
  href: string;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

// Footer links are drawn from the precomputed active categories.
const activeCategories = ACTIVE_CATEGORIES;

const footerLinks: FooterSection[] = [
  {
    label: 'Tools',
    links: [
      { title: 'All Tools', href: '/tools' },
      { title: 'PDF & Document', href: '/category/pdf' },
      { title: 'File Management', href: '/category/file' },
      { title: 'Text & Writing', href: '/category/text' },
    ],
  },
  {
    label: 'Categories',
    links: activeCategories.slice(4, 8).map((c: ToolCategory) => ({
      title: CATEGORY_LABELS[c].split(' ')[0].replace(/[,.;:]$/, ''),
      href: `/category/${c}`,
    })),
  },
  {
    label: 'More',
    links: [
      { title: 'Developer Tools', href: '/category/developer' },
      { title: 'SEO & Marketing', href: '/category/seo' },
      { title: 'Calculators', href: '/category/calculators' },
      { title: 'Image & Graphics', href: '/category/image' },
    ],
  },
  {
    label: 'About',
    links: [
      { title: 'Privacy Policy', href: '/' },
      { title: 'Terms of Service', href: '/' },
      { title: 'GitHub', href: 'https://github.com/Sandeepgaddam5432/unqtools' },
      { title: `All ${TOOL_COUNT} Tools`, href: '/tools' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="md:rounded-t-6xl relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center rounded-t-4xl border-t bg-[radial-gradient(35%_128px_at_50%_0%,theme(backgroundColor.white/8%),transparent)] px-6 py-12 lg:py-16">
      <div className="bg-foreground/20 absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

      <div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-8">
        <AnimatedContainer className="space-y-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="UnQTools" width="32" height="32" className="h-8 w-8" />
            <h2 className="text-lg font-bold tracking-tight">
              UnQ<span className="text-primary">Tools</span>
            </h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {TOOL_COUNT} free online tools that run 100% in your browser. No uploads, no tracking, no accounts.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> 100% Private
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <WifiOff className="h-3 w-3" /> Works Offline
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" /> Instant
            </span>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            &copy; {new Date().getFullYear()} UnQTools by Sandeep Gaddam. All rights reserved.
          </p>
        </AnimatedContainer>

        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
          {footerLinks.map((section, index) => (
            <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
              <div className="mb-10 md:mb-0">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">{section.label}</h3>
                <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                  {section.links.map((link) => (
                    <li key={link.title}>
                      {link.href.startsWith('http') ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground inline-flex items-center transition-all duration-300"
                        >
                          {link.title}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="hover:text-foreground inline-flex items-center transition-all duration-300"
                        >
                          {link.title}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </AnimatedContainer>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-8 pt-8 border-t border-border/40 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Built with <Heart className="inline h-3 w-3 text-red-500 fill-red-500" /> by Sandeep Gaddam
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Sandeepgaddam5432/unqtools"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          <span className="text-xs text-muted-foreground">
            Proprietary — All rights reserved
          </span>
        </div>
      </div>
    </footer>
  );
};

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>['className'];
  children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
