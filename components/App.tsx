"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { DemandPanel } from "./DemandPanel";
import { FlowDiagram } from "./FlowDiagram";
import { Header } from "./Header";
import { Insights } from "./Insights";
import { Intro } from "./Intro";
import { SalmonDiagram } from "./SalmonDiagram";
import { SupplyPanel } from "./SupplyPanel";
import { WeeklyChart } from "./WeeklyChart";
import { WeekStrip } from "./WeekStrip";

const stagger = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }),
};

export function App() {
  const { state } = useStore();
  const [hintsDismissed, setHintsDismissed] = useState(false);

  if (!state.hydrated) return <div className="min-h-screen" />;

  return (
    <>
      <AnimatePresence>{!state.introDone && <Intro key="intro" />}</AnimatePresence>

      <main className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 p-4 lg:p-6">
        <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={0}>
          <Header />
        </motion.div>

        {state.introDone && !hintsDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-salmon-500/30 bg-salmon-500/8 px-4 py-2 text-sm"
          >
            <Hint n={1} text="Pick a week, then set fish count and cut mix on the left." />
            <Hint n={2} text="The fish colours show where parts fall short (red) or pile up (amber)." />
            <Hint n={3} text="Tune orders and prices on the right, or hit Auto-plan for the best margin." />
            <button className="ml-auto text-xs text-mist-300 hover:text-mist-100" onClick={() => setHintsDismissed(true)}>
              Got it
            </button>
          </motion.div>
        )}

        <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={1}>
          <WeekStrip />
        </motion.div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[330px_minmax(0,1fr)_440px]">
          <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={2}>
            <SupplyPanel />
          </motion.div>
          <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={3} className="flex min-w-0 flex-col gap-4">
            <SalmonDiagram />
            <Insights />
          </motion.div>
          <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={4}>
            <DemandPanel />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[3fr_2fr]">
          <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={5}>
            <FlowDiagram />
          </motion.div>
          <motion.div variants={stagger} initial="hidden" animate={state.introDone ? "show" : "hidden"} custom={6}>
            <WeeklyChart />
          </motion.div>
        </div>
      </main>
    </>
  );
}

function Hint({ n, text }: { n: number; text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-salmon-500 text-[11px] font-bold text-sea-950">{n}</span>
      <span className="text-mist-100/90">{text}</span>
    </span>
  );
}
