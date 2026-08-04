"use client";

/** Subtle atmospheric sky background. Adjusts tone by time of day. */
export function Atmosphere() {
  const hour = new Date().getHours();
  const night = hour < 6 || hour >= 19;

  const stars =
    night
      ? Array.from({ length: 40 }).map((_, i) => ({
          left: `${(i * 37) % 100}`,
          top: `${(i * 53) % 45}`,
          delay: `${(i % 7) * 0.7}`,
        }))
      : [];

  const motes = Array.from({ length: 6 }).map((_, i) => ({
    left: `${(i * 61 + 8) % 92}`,
    top: `${(i * 29 + 12) % 70}`,
    size: 5 + (i % 3) * 3,
    delay: `${(i % 5) * -1.5}`,
  }));

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-sky absolute inset-0 transition-colors duration-700" />
      {/* soft moving bokeh "lanterns" */}
      <div
        className="absolute h-40 w-40 rounded-full blur-3xl opacity-30"
        style={{ left: "-10%", top: "5%", background: "var(--glow)" }}
      />
      <div
        className="absolute h-56 w-56 rounded-full blur-3xl opacity-25"
        style={{ right: "-8%", top: "20%", background: "var(--glow-violet)" }}
      />
      <div
        className="absolute left-1/2 bottom-0 h-40 w-2/3 -translate-x-1/2 rounded-full bg-[var(--accent)]/10 blur-3xl"
      />
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute h-1 w-1 animate-pulse rounded-full"
          style={{ left: `${s.left}%`, top: `${s.top}%`, background: "var(--star)", animationDelay: `${s.delay}s`, opacity: night ? 0.9 : 0 }}
        />
      ))}
      {motes.map((m, i) => (
        <div
          key={`mote-${i}`}
          className="mote absolute rounded-full"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: "var(--glow-strong)",
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </div>
  );
}