"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface BentoGridProps {
  children: React.ReactNode
  className?: string
}

interface BentoCardProps {
  id?: string
  children: React.ReactNode
  className?: string
}

interface BentoTitleProps {
  children?: React.ReactNode
  className?: string
}

interface BentoDescriptionProps {
  children?: React.ReactNode
  className?: string
}

interface BentoContentProps {
  children: React.ReactNode
  className?: string
}

interface BentoFeature {
  id: string
  title?: string
  description?: string
  content: React.ReactNode
  className?: string
}

interface BentoGridWithFeaturesProps {
  features: BentoFeature[]
  className?: string
}

const BentoGrid = ({ children, className }: BentoGridProps) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-0 rounded-3xl border dark:border-neutral-800", className)}>
      {children}
    </div>
  )
}

const BentoCard = ({ id, children, className }: BentoCardProps) => {
  return (
    <div
      id={id}
      className={cn("relative overflow-hidden p-4 sm:p-8", className)}
    >
      {children}
    </div>
  )
}

const BentoTitle = ({ children, className }: BentoTitleProps) => {
  if (!children) return null
  return (
    <h3 className={cn("text-left text-xl tracking-tight text-black md:text-2xl md:leading-snug dark:text-white", className)}>
      {children}
    </h3>
  )
}

const BentoDescription = ({ children, className }: BentoDescriptionProps) => {
  if (!children) return null
  return (
    <p className={cn(
      "text-left text-sm md:text-base",
      "font-normal text-neutral-500 dark:text-neutral-300",
      "mx-0 my-2 max-w-sm text-left md:text-sm",
      className
    )}>
      {children}
    </p>
  )
}

const BentoContent = ({ children, className }: BentoContentProps) => {
  return (
    <div className={cn("h-full w-full", className)}>
      {children}
    </div>
  )
}

const BentoGridWithFeatures = ({ features, className }: BentoGridWithFeaturesProps) => {
  return (
    <div className="relative mb-6">
      <BentoGrid className={className}>
        {features.map((feature) => (
          <BentoCard
            key={feature.id}
            id={feature.id}
            className={feature.className}
          >
            <BentoTitle>{feature.title}</BentoTitle>
            <BentoDescription>{feature.description}</BentoDescription>
            <BentoContent>{feature.content}</BentoContent>
          </BentoCard>
        ))}
      </BentoGrid>
    </div>
  )
}

export {
  BentoGrid,
  BentoCard,
  BentoTitle,
  BentoDescription,
  BentoContent,
  BentoGridWithFeatures,
  type BentoFeature,
  type BentoGridProps,
  type BentoCardProps,
}
