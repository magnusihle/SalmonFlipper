"use client";

import { CUT_PLANS, CUT_PLAN_COLORS } from "@/lib/data";
import { normalizeMix } from "@/lib/engine";
import { int, kg, money, price } from "@/lib/format";
import { useSelectedWeek, useStore } from "@/lib/store";
import { Button, NumberField, Panel, Slider } from "./ui";

export function SupplyPanel() {
  const { dispatch } = useStore();
  const { index, week, result } = useSelectedWeek();
  const { supply } = week;
  const mix = normalizeMix(week.mix);

  const setSupply = (patch: Partial<typeof supply>) => dispatch({ type: "setSupply", week: index, patch });

  return (
    <Panel title={`Supply · ${week.label}`} className="gap-1 pb-4">
      <div className="flex flex-col gap-4 px-4">
        <Field label="Fish available" hint="Landed this week">
          <div className="flex items-center gap-3">
            <Slider value={supply.available} min={0} max={3000} step={10} onChange={(v) => setSupply({ available: v, used: Math.min(supply.used, v) })} accent="#8ecae6" />
            <NumberField className="w-24" value={supply.available} step={10} onChange={(v) => setSupply({ available: v, used: Math.min(supply.used, v) })} />
          </div>
        </Field>

        <Field label="Fish to process" hint={`${kg(result.kgIn)} whole · ${money(result.cost.fish)}`}>
          <div className="flex items-center gap-3">
            <Slider value={supply.used} min={0} max={Math.max(1, supply.available)} step={1} onChange={(v) => setSupply({ used: v })} />
            <NumberField className="w-24" value={supply.used} onChange={(v) => setSupply({ used: v })} />
          </div>
          {supply.used < supply.available && (
            <div className="mt-1 flex items-center justify-between text-xs text-mist-500">
              <span>{int(supply.available - supply.used)} fish left unbought</span>
              <button className="text-salmon-400 hover:underline" onClick={() => setSupply({ used: supply.available })}>
                Use all
              </button>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Avg weight">
            <NumberField value={supply.avgKg} step={0.1} min={0.5} suffix="kg" onChange={(v) => setSupply({ avgKg: v })} />
          </Field>
          <Field label="Purchase cost">
            <NumberField value={supply.costPerKg} step={0.1} suffix="/kg" onChange={(v) => setSupply({ costPerKg: v })} />
          </Field>
        </div>

        <div className="h-px bg-white/6" />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">Cut mix</span>
            <Button variant="subtle" className="px-2 py-0.5 text-xs" onClick={() => dispatch({ type: "copyMixToAll", week: index })}>
              Apply to all weeks
            </Button>
          </div>
          <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
            {CUT_PLANS.map((p) => (
              <div key={p.id} className="h-full transition-[width] duration-300" style={{ width: `${mix[p.id] * 100}%`, background: CUT_PLAN_COLORS[p.id] }} title={p.name} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {CUT_PLANS.map((p) => (
              <div key={p.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: CUT_PLAN_COLORS[p.id] }} />
                    <span className="font-medium">{p.name}</span>
                  </span>
                  <span className="num text-mist-300">
                    <span className="font-semibold text-mist-100">{Math.round(mix[p.id] * 100)}%</span> · {kg(result.planKg[p.id], false)} kg
                  </span>
                </div>
                <Slider value={Math.round(mix[p.id] * 100)} min={0} max={100} onChange={(v) => dispatch({ type: "setMix", week: index, plan: p.id, value: v / 100 })} accent={CUT_PLAN_COLORS[p.id]} />
                <div className="-mt-1 text-[11px] text-mist-500">
                  {p.description} {p.processingCostPerKg > 0 && <span>Processing {price(p.processingCostPerKg)}.</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/6" />

        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-mist-300">Fish purchase</dt>
          <dd className="num text-right">{money(result.cost.fish)}</dd>
          <dt className="text-mist-300">Processing</dt>
          <dd className="num text-right">{money(result.cost.processing)}</dd>
          <dt className="text-mist-300">Freezing</dt>
          <dd className="num text-right">{money(result.cost.freezing)}</dd>
          <dt className="font-semibold">Total cost</dt>
          <dd className="num text-right font-semibold">{money(result.cost.total)}</dd>
        </dl>
      </div>
    </Panel>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="num text-xs text-mist-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
