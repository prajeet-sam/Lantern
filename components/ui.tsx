"use client";

import React from "react";
import { cn } from "@/lib/cn";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary",
        size === "sm" && "h-9 px-4 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-13 px-7 text-base",
        variant === "primary" &&
          "bg-primary text-[var(--primary-foreground)] shadow-sm hover:brightness-105",
        variant === "accent" &&
          "bg-gradient-to-r from-[#d99a4e] to-[#e6b06a] text-[var(--accent-foreground)] shadow-sm hover:brightness-105",
        variant === "secondary" &&
          "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:brightness-105",
        variant === "ghost" &&
          "bg-transparent text-foreground hover:bg-[var(--secondary)]/60",
        variant === "danger" &&
          "bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger)]/10",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function Chip({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-3.5 py-2 text-sm transition-all focus-visible:outline-2 focus-visible:outline-primary",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
          : "bg-[var(--secondary-2,var(--secondary))]/60 text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("font-display text-xl font-semibold text-foreground", className)}>
      {children}
    </h2>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {icon && (
        <div className="relative">
          <div className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-[var(--glow)]/40 blur-xl" aria-hidden />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--primary)]/20 bg-[var(--secondary)]/60 text-[var(--accent)]">
            {icon}
          </div>
        </div>
      )}
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}