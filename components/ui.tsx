"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Panel({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ children, variant = "ghost", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "subtle" }) {
  const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]";
  const styles = {
    primary: "bg-salmon-500 text-sea-950 hover:bg-salmon-400 shadow-[0_6px_20px_-8px_rgba(255,122,89,0.8)]",
    ghost: "bg-white/5 text-mist-100 hover:bg-white/10 border border-white/8",
    subtle: "text-mist-300 hover:text-mist-100 hover:bg-white/5",
  }[variant];
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Slider({ value, min, max, step = 1, onChange, accent }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; accent?: string }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ "--pct": `${pct}%`, ...(accent ? { "--accent": accent } : {}) } as React.CSSProperties}
    />
  );
}

export function NumberField({ value, onChange, step = 1, min = 0, className = "", suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; className?: string; suffix?: string }) {
  const formatted = Number.isFinite(value) ? String(+value.toFixed(2)) : "0";
  const [text, setText] = useState(formatted);
  const [focused, setFocused] = useState(false);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="number"
        className="field w-full text-right text-sm"
        value={focused ? text : formatted}
        step={step}
        min={min}
        onFocus={() => {
          setText(formatted);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, v));
        }}
      />
      {suffix && <span className="text-xs text-mist-500 shrink-0">{suffix}</span>}
    </span>
  );
}

export function Stat({ label, value, sub, tone = "neutral" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  const color = { neutral: "text-mist-100", good: "text-kelp-400", bad: "text-coral-400", warn: "text-sun-400" }[tone];
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-mist-500 truncate">{label}</span>
      <span className={`num text-xl font-semibold leading-tight ${color}`}>{value}</span>
      {sub && <span className="text-xs text-mist-300 truncate">{sub}</span>}
    </div>
  );
}

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block size-2.5 rounded-full shrink-0 ${className}`} style={{ background: color }} />;
}
