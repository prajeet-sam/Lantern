"use client";

import { motion } from "framer-motion";
import type { CyclePrediction } from "@/types";
import { ovulationDay } from "@/lib/cycle/phases";
import { LanternLogo } from "@/components/LanternLogo";

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const COLORS = {
  menstrual: "#6b4fa3",
  follicular: "#e0a95e",
  ovulation: "#a4c462",
  luteal: "#9a6bbf",
};

export function CycleRing({
  prediction,
  cycleLen,
  cycleDay,
  periodDays = 5,
}: {
  prediction: CyclePrediction | null;
  cycleLen: number;
  cycleDay?: number;
  periodDays?: number;
}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 92;
  const rMid = (r + 62) / 2;

  const len = Math.max(1, cycleLen || 28);
  const pd = Math.max(1, Math.min(periodDays, 5));
  const ovulation = Math.max(pd + 2, ovulationDay(len));
  const ovStart = ovulation - 2;
  const ovEnd = ovulation + 2;

  const step = (days: number) => Math.max(0, Math.min(360, (days / len) * 360));

  const segs: { key: string; from: number; to: number; fill: string }[] = [];
  const pdEnd = step(pd);
  segs.push({ key: "men", from: 0, to: pdEnd, fill: COLORS.menstrual });
  if (pdEnd < 360) {
    const ovStartDeg = step(ovStart);
    const ovEndDeg = step(ovEnd);
    segs.push({ key: "fol", from: pdEnd, to: Math.max(pdEnd, ovStartDeg), fill: COLORS.follicular });
    segs.push({ key: "ov", from: Math.max(pdEnd, ovStartDeg), to: ovEndDeg, fill: COLORS.ovulation });
    segs.push({ key: "lut", from: ovEndDeg, to: 360, fill: COLORS.luteal });
  }

  const clampedDay = cycleDay ? Math.max(1, Math.min(len, cycleDay)) : 1;
  const posDeg = Math.max(1, Math.min(359, ((clampedDay - 1) / len) * 360));
  const lantern = polar(cx, cy, rMid, posDeg);

  const predPos = prediction?.available ? polar(cx, cy, r - 16, ((len - 1) / len) * 360) : null;

  return (
    <div className="relative mx-auto select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0">
        <g strokeWidth={18} fill="none" strokeLinecap="round">
          {segs.map((s) => (
            <path key={s.key} d={arcPath(cx, cy, r, s.from, s.to)} stroke={s.fill} opacity={0.5} />
          ))}
          <path key="inner" d={arcPath(cx, cy, r - 30, 0, 360)} stroke="var(--border)" strokeWidth={1} opacity={0.6} />
        </g>
      </svg>

      {predPos && (
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: predPos.x,
            top: predPos.y,
            width: 12,
            height: 12,
            border: "2px solid var(--rose)",
            background: "var(--card)",
            boxShadow: "0 0 10px var(--glow)",
          }}
          aria-label="predicted period"
        />
      )}

      {/* current-day lantern */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: lantern.x, top: lantern.y }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <LanternLogo className="h-9 w-9" />
      </motion.div>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cycle day</span>
        <span className="font-display text-4xl font-bold leading-none text-foreground">{clampedDay}</span>
        <span className="mt-1 text-xs text-muted-foreground">
          cycle ~{len} days{prediction?.confidence === "higher" ? " · steady" : ""}
        </span>
      </div>
    </div>
  );
}