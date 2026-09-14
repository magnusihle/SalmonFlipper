"use client";

import { motion } from "framer-motion";
import { Fragment } from "react";
import { int, kg, money, pct } from "@/lib/format";
import { useStore } from "@/lib/store";

export function WeekStrip() {
  const { state, results, dispatch } = useStore();
  const selected = state.selectedWeek;

  return (
    <div className="grid grid-cols-[repeat(8,minmax(0,1fr))] items-stretch gap-2 overflow-x-auto">
      {state.plan.weeks.map((w, i) => {
        const r = results[i];
        const active = i === selected;
        const fillTone = r.fillRate >= 0.9 ? "bg-kelp-400" : r.fillRate >= 0.75 ? "bg-sun-400" : "bg-coral-400";
        const usedPct = w.supply.available > 0 ? (r.fishUsed / w.supply.available) * 100 : 0;
        return (
          <Fragment key={w.label}>
            <motion.button
              layout
              onClick={() => dispatch({ type: "selectWeek", week: i })}
              className={`panel relative flex min-w-[120px] flex-col gap-1.5 px-3 py-2.5 text-left transition-colors ${
                active ? "border-salmon-500/70 bg-salmon-500/10" : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-sm font-semibold ${active ? "text-salmon-400" : ""}`}>{w.label}</span>
                <span className="text-[10px] text-mist-500">{w.startDate.slice(5).replace("-", "/")}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-mist-300">Fish</span>
                <span className="num">
                  {int(r.fishUsed)}
                  <span className="text-mist-500">/{int(w.supply.available)}</span>
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-300/80" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-mist-300">Demand</span>
                <span className="num">{kg(r.demandKg, false)}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${fillTone}`} style={{ width: `${Math.min(100, r.fillRate * 100)}%` }} />
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className={`num text-sm font-semibold ${r.margin >= 0 ? "text-kelp-400" : "text-coral-400"}`}>{money(r.margin)}</span>
                <span className="num text-xs text-mist-300">{pct(r.fillRate)}</span>
              </div>
              {r.frozenOutKg > 1 && i < results.length - 1 && (
                <span
                  className="absolute -right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-sky-300/40 bg-sea-900 px-1 text-[9px] leading-4 text-sky-200"
                  title={`${kg(r.frozenOutKg)} frozen and carried into next week`}
                >
                  ❄ {kg(r.frozenOutKg, false)}
                </span>
              )}
            </motion.button>
          </Fragment>
        );
      })}
    </div>
  );
}
