"use client";

import { useId } from "react";

/** A lantern lantern with a floating glow. Ids are unique per instance. */
export function LanternLogo({
  className = "",
  glow = true,
}: {
  className?: string;
  glow?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const g = `lg-${uid}`;
  const lic = `lic-${uid}`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${glow ? "drop-shadow-[0_0_14px_var(--glow)]" : ""} ${className}`}
      role="img"
      aria-hidden
    >
      <defs>
        <radialGradient id={g} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff0c8" />
          <stop offset="55%" stopColor="#f7c878" />
          <stop offset="100%" stopColor="#e09a4a" />
        </radialGradient>
        <linearGradient id={lic} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c4f9e" />
          <stop offset="100%" stopColor="#9a6bbf" />
        </linearGradient>
      </defs>
      {/* halo */}
      <circle cx="32" cy="34" r="20" fill={`url(#${g})`} opacity="0.35" />
      {/* lantern body */}
      <path d="M24 24 a14 14 0 0 1 28 0 v8 a5 5 0 0 1 -5 5 h-18 a5 5 0 0 1 -5 -5 z" fill={`url(#${g})`} />
      <rect x="22" y="37" width="24" height="4" rx="2" fill={`url(#${g})`} opacity="0.9" />
      <rect x="24" y="41" width="20" height="3" rx="1.5" fill={`url(#${g})`} opacity="0.8" />
      {/* top ring */}
      <rect x="25" y="20" width="18" height="4" rx="2" fill={`url(#${lic})`} />
      {/* handle */}
      <path d="M30 20 c0 -7 12 -7 12 0" stroke="#b79ae8" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* glint */}
      <circle cx="33" cy="28" r="2" fill="#fff" opacity="0.85" />
    </svg>
  );
}