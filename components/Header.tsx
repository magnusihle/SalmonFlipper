"use client";

import { SCENARIOS } from "@/lib/data";
import { totals } from "@/lib/engine";
import { kg, money, pct } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { ScenarioId } from "@/lib/types";
import { Brand } from "./Intro";
import { Button } from "./ui";

export function Header() {
  const { state, results, dispatch } = useStore();
  const t = totals(results);

  return (
    <header className="flex flex-wrap items-center gap-4 lg:gap-6">
      <Brand />
      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-mist-500">Scenario</label>
        <select
          className="field text-sm"
          value={state.plan.scenario}
          onChange={(e) => dispatch({ type: "applyScenario", scenario: e.target.value as ScenarioId })}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id} className="bg-sea-900">
              {s.name} — {s.tagline}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-5">
        <div className="hidden items-center gap-5 md:flex">
          <Summary label="8-wk margin" value={money(t.margin)} tone={t.margin >= 0 ? "text-kelp-400" : "text-coral-400"} />
          <Summary label="Fill rate" value={pct(t.fillRate)} tone={t.fillRate >= 0.9 ? "text-kelp-400" : t.fillRate >= 0.75 ? "text-sun-400" : "text-coral-400"} />
          <Summary label="Waste" value={kg(t.wasteKg)} tone="text-mist-100" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" onClick={() => dispatch({ type: "replayIntro" })}>
            Intro
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "reset" })}>
            Reset
          </Button>
          <Button variant="primary" onClick={() => dispatch({ type: "autoPlan" })} title="Search fish count and cut mix per week to maximise margin">
            <Sparkle /> Auto-plan
          </Button>
        </div>
      </div>
    </header>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-mist-500">{label}</span>
      <span className={`num text-base font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2zM19 14l.9 2.6L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.4L19 14zM5 15l.7 1.9L7 17l-1.3.5L5 19l-.7-1.5L3 17l1.3-.1L5 15z" />
    </svg>
  );
}
