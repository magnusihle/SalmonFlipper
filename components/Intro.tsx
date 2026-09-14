"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CUT_PLANS, PARTS, PART_BY_ID, SCENARIOS } from "@/lib/data";
import { useStore } from "@/lib/store";
import type { ScenarioId } from "@/lib/types";
import { Salmon } from "./salmon/Salmon";
import type { FishPart } from "./salmon/geometry";
import { Button } from "./ui";

const STEPS = ["hero", "anatomy", "flow", "scenario"] as const;

const fade = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -24 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

export function Intro() {
  const { dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<FishPart | null>(null);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const finish = (scenario: ScenarioId) => {
    dispatch({ type: "applyScenario", scenario });
    dispatch({ type: "introDone" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        if (step < STEPS.length - 1) {
          e.preventDefault();
          next();
        }
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") dispatch({ type: "introDone" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, dispatch]);

  const current = STEPS[step];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-sea-950/95 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-40 -top-40 size-[600px] rounded-full bg-salmon-500/15 blur-3xl" />
        <div className="absolute -right-40 bottom-0 size-[500px] rounded-full bg-teal-400/10 blur-3xl" />
      </div>

      <div className="relative flex items-center justify-between px-8 py-5">
        <Brand />
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-salmon-500" : "w-3 bg-white/20 hover:bg-white/40"}`}
            />
          ))}
        </div>
        <Button variant="subtle" onClick={() => dispatch({ type: "introDone" })}>
          Skip intro
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 pb-10">
        <AnimatePresence mode="wait">
          {current === "hero" && (
            <motion.div key="hero" {...fade} className="flex w-full max-w-5xl flex-col items-center text-center">
              <motion.div
                className="drift w-full max-w-3xl"
                initial={{ x: -400, opacity: 0, rotate: -4 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 40, damping: 14, delay: 0.1 }}
              >
                <Salmon fillFor={(p) => PART_BY_ID[p].color} skinColor="#ffd9cc" />
              </motion.div>
              <motion.h1
                className="mt-6 text-6xl font-semibold tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                Fishbone
              </motion.h1>
              <motion.p
                className="mt-3 max-w-xl text-lg text-mist-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.85 }}
              >
                Salmon disassembly planner. Match every fish to every customer, week by week.
              </motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-8">
                <Button variant="primary" className="px-6 py-2.5 text-base" onClick={next}>
                  Begin <Arrow />
                </Button>
                <p className="mt-3 text-xs text-mist-500">Press → to advance</p>
              </motion.div>
            </motion.div>
          )}

          {current === "anatomy" && (
            <motion.div key="anatomy" {...fade} className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[3fr_2fr]">
              <div>
                <Salmon
                  fillFor={(p) => PART_BY_ID[p].color}
                  explode={1}
                  pad={100}
                  portionShare={0.6}
                  hovered={hovered}
                  onHover={setHovered}
                  skinColor="#ffd9cc"
                  renderLabel={(r) => (
                    <>
                      <text x={r.label[0]} y={r.label[1] - 4} textAnchor="middle" fontSize={r.id === "collar" || r.id === "frame" ? 11 : 15} fontWeight={700} fill="#0b1220">
                        {PART_BY_ID[r.id].name}
                      </text>
                      <text x={r.label[0]} y={r.label[1] + 12} textAnchor="middle" fontSize={11} fill="#0b1220" opacity={0.8}>
                        {r.yieldLabel}
                      </text>
                    </>
                  )}
                />
              </div>
              <div>
                <h2 className="text-4xl font-semibold tracking-tight">One fish, nine products.</h2>
                <p className="mt-3 text-mist-300">
                  Every whole salmon is a bundle of parts with very different buyers and prices. How you cut it decides what you have to sell.
                </p>
                <ul className="mt-6 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                  {PARTS.map((p) => (
                    <li
                      key={p.id}
                      onMouseEnter={() => setHovered(p.id as FishPart)}
                      onMouseLeave={() => setHovered(null)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${hovered === p.id ? "bg-white/10" : ""}`}
                    >
                      <span className="size-3 rounded-sm" style={{ background: p.color }} />
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-auto text-xs text-mist-500">{p.description}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex items-center gap-3">
                  <Button variant="ghost" onClick={prev}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={next}>
                    How it works <Arrow />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {current === "flow" && (
            <motion.div key="flow" {...fade} className="w-full max-w-6xl">
              <h2 className="text-center text-4xl font-semibold tracking-tight">Supply in, demand out.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-center text-mist-300">
                You decide how many fish to buy and how to cut them. Fishbone matches every kilo to the best-paying order, freezes what it can carry, and shows exactly where you fall short.
              </p>
              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "1 · Supply",
                    body: "Fish landed each week, average weight and cost per kg. Choose how many to process.",
                    accent: "#8ecae6",
                    icon: <SupplyIcon />,
                  },
                  {
                    title: "2 · Cut plan",
                    body: CUT_PLANS.map((c) => c.name).join(" · ") + ". Slide the mix and watch the parts change.",
                    accent: "#ff7a59",
                    icon: <CutIcon />,
                  },
                  {
                    title: "3 · Demand",
                    body: "Orders per customer, part and price. Highest price fills first. Surplus freezes, shortfall shows red.",
                    accent: "#34d399",
                    icon: <DemandIcon />,
                  },
                ].map((c, i) => (
                  <motion.div
                    key={c.title}
                    className="panel p-6"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.15 }}
                  >
                    <div className="mb-4 flex size-12 items-center justify-center rounded-xl" style={{ background: `${c.accent}22`, color: c.accent }}>
                      {c.icon}
                    </div>
                    <h3 className="text-lg font-semibold">{c.title}</h3>
                    <p className="mt-2 text-sm text-mist-300">{c.body}</p>
                  </motion.div>
                ))}
              </div>
              <div className="mt-10 flex justify-center gap-3">
                <Button variant="ghost" onClick={prev}>
                  Back
                </Button>
                <Button variant="primary" onClick={next}>
                  Pick a scenario <Arrow />
                </Button>
              </div>
            </motion.div>
          )}

          {current === "scenario" && (
            <motion.div key="scenario" {...fade} className="w-full max-w-5xl">
              <h2 className="text-center text-4xl font-semibold tracking-tight">Choose your eight weeks.</h2>
              <p className="mt-3 text-center text-mist-300">Dummy data for now. Swap in real landings and orders later.</p>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {SCENARIOS.map((s, i) => (
                  <motion.button
                    key={s.id}
                    onClick={() => finish(s.id)}
                    className="panel group relative overflow-hidden p-6 text-left transition-colors hover:border-salmon-500/60"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -3 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                  >
                    <div className="text-xs uppercase tracking-[0.14em] text-salmon-400">{s.tagline}</div>
                    <div className="mt-1 text-2xl font-semibold">{s.name}</div>
                    <p className="mt-2 text-sm text-mist-300">{s.description}</p>
                    <span className="absolute right-5 top-5 text-mist-500 transition-transform group-hover:translate-x-1 group-hover:text-mist-100">
                      <Arrow />
                    </span>
                  </motion.button>
                ))}
              </div>
              <div className="mt-8 flex justify-center">
                <Button variant="ghost" onClick={prev}>
                  Back
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 800 320" className={compact ? "h-6 w-14" : "h-8 w-20"} aria-hidden>
        <path
          d="M 30 160 C 80 90, 200 55, 330 55 C 450 55, 580 95, 640 125 L 700 62 Q 745 48, 772 70 L 738 160 L 772 250 Q 745 272, 700 258 L 640 195 C 580 225, 450 265, 330 265 C 200 265, 80 230, 30 160 Z"
          fill="#ff7a59"
        />
        <path d="M 206 160 L 632 160" stroke="#0b1220" strokeWidth={14} strokeLinecap="round" opacity={0.6} />
        {Array.from({ length: 6 }, (_, i) => 260 + i * 66).map((x) => (
          <line key={x} x1={x} y1={160} x2={x + 18} y2={225} stroke="#0b1220" strokeWidth={10} strokeLinecap="round" opacity={0.6} />
        ))}
        <circle cx={80} cy={140} r={16} fill="#0b1220" />
      </svg>
      <span className={`font-semibold tracking-tight ${compact ? "text-base" : "text-lg"}`}>Fishbone</span>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function SupplyIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17c4-6 10-6 14 0" />
      <path d="M17 17l4-3-4-3" />
      <circle cx="7" cy="14" r="0.8" fill="currentColor" />
      <path d="M3 21h18" />
    </svg>
  );
}

function CutIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21l10-10" />
      <path d="M13 11l8-8" />
      <path d="M11 13l4 4c2 1 4 1 6-1l-6-6" />
    </svg>
  );
}

function DemandIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
