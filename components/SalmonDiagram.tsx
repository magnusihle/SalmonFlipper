"use client";

import { useMemo, useState } from "react";
import { CUSTOMER_BY_ID, PART_BY_ID } from "@/lib/data";
import { partStatus, STATUS_COLORS, STATUS_LABELS, type Status } from "@/lib/engine";
import { int, kg, money, pct } from "@/lib/format";
import { useSelectedWeek } from "@/lib/store";
import type { PartId, PartResult, WeekResult } from "@/lib/types";
import { Salmon } from "./salmon/Salmon";
import type { FishPart } from "./salmon/geometry";
import { Panel, Stat } from "./ui";

type Mode = "balance" | "yield";

export function SalmonDiagram() {
  const { week, result } = useSelectedWeek();
  const [mode, setMode] = useState<Mode>("balance");
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [pinned, setPinned] = useState<PartId | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const active = hovered ?? pinned;
  const statuses = useMemo(
    () => Object.fromEntries(Object.values(result.parts).map((p) => [p.part, partStatus(p)])) as Record<PartId, Status>,
    [result.parts],
  );

  const fillFor = (p: FishPart) => (mode === "balance" ? STATUS_COLORS[statuses[p]] : PART_BY_ID[p].color);

  return (
    <Panel className="relative gap-2 pb-4">
      <header className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">
          Cut plan · {week.label} <span className="text-mist-300">· {int(result.fishUsed)} fish · {kg(result.kgIn)}</span>
        </h2>
        <div className="flex rounded-lg bg-white/5 p-0.5 text-xs">
          {(["balance", "yield"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 capitalize transition-colors ${mode === m ? "bg-salmon-500 text-sea-950 font-semibold" : "text-mist-300 hover:text-mist-100"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div
        className="relative px-2"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
      >
        <Salmon
          className="w-full"
          fillFor={fillFor}
          portionShare={week.mix.portion}
          hovered={(active as FishPart) ?? null}
          onHover={(p) => setHovered(p)}
          onSelect={(p) => setPinned((cur) => (cur === p ? null : p))}
          renderLabel={(r) => {
            const pr = result.parts[r.id];
            const small = r.id === "collar" || r.id === "frame";
            const light = mode === "balance" && statuses[r.id] === "idle";
            const color = light ? "#e8f0f7" : "#0b1220";
            const [x, y] = r.label;
            return (
              <>
                <text x={x} y={small ? y : y - 4} textAnchor="middle" fontSize={small ? 11 : 14} fontWeight={700} fill={color}>
                  {PART_BY_ID[r.id].name}
                </text>
                {!small && (
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={color} opacity={0.85} className="num">
                    {kg(pr.freshKg + pr.frozenInKg, false)} / {kg(pr.demandKg, false)} kg
                  </text>
                )}
              </>
            );
          }}
        />
        {active && <Tooltip pr={result.parts[active]} status={statuses[active]} result={result} pos={pos} mode={mode} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4">
        {(["hog", "skin"] as PartId[]).map((p) => {
          const pr = result.parts[p];
          const st = statuses[p];
          return (
            <button
              key={p}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setPinned((cur) => (cur === p ? null : p))}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors ${active === p ? "border-white/40 bg-white/10" : "border-white/8 bg-white/[0.03] hover:bg-white/5"}`}
            >
              <span className="size-2.5 rounded-sm" style={{ background: mode === "balance" ? STATUS_COLORS[st] : PART_BY_ID[p].color }} />
              <span className="font-medium">{PART_BY_ID[p].name}</span>
              <span className="num text-mist-300">
                {kg(pr.freshKg + pr.frozenInKg, false)} / {kg(pr.demandKg, false)} kg
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-mist-300">
          {mode === "balance" ? (
            (["shortfall", "balanced", "surplus"] as Status[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLORS[s] }} /> {STATUS_LABELS[s]}
              </span>
            ))
          ) : (
            <span>Produced / demanded per part · click a part to pin</span>
          )}
        </div>
      </div>

      <div className="mx-4 mt-1 grid grid-cols-2 gap-3 border-t border-white/6 pt-3 sm:grid-cols-5">
        <Stat label="Revenue" value={money(result.revenue)} />
        <Stat label="Cost" value={money(result.cost.total)} />
        <Stat label="Margin" value={money(result.margin)} tone={result.margin >= 0 ? "good" : "bad"} sub={result.revenue > 0 ? `${pct(result.margin / result.revenue)} of revenue` : undefined} />
        <Stat label="Fill rate" value={pct(result.fillRate)} tone={result.fillRate >= 0.9 ? "good" : result.fillRate >= 0.75 ? "warn" : "bad"} sub={`${kg(Math.max(0, result.demandKg - result.soldKg))} short`} />
        <Stat label="Waste" value={kg(result.wasteKg + result.lossKg)} tone={result.wasteKg > 200 ? "warn" : "neutral"} sub={`${kg(result.lossKg, false)} cutting loss`} />
      </div>
    </Panel>
  );
}

function Tooltip({ pr, status, result, pos, mode }: { pr: PartResult; status: Status; result: WeekResult; pos: { x: number; y: number }; mode: Mode }) {
  const def = PART_BY_ID[pr.part];
  const produced = pr.freshKg + pr.frozenInKg;
  const buyers = result.fills
    .filter((f) => f.part === pr.part)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 3);
  const gap = produced - pr.demandKg;

  return (
    <div
      className="pointer-events-none absolute z-20 w-64 rounded-xl border border-white/10 bg-sea-900/95 p-3 text-xs shadow-2xl backdrop-blur"
      style={{ left: Math.min(pos.x + 14, 9999), top: pos.y + 14, transform: pos.x > 400 ? "translateX(calc(-100% - 28px))" : undefined }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-2.5 rounded-sm" style={{ background: mode === "balance" ? STATUS_COLORS[status] : def.color }} />
          {def.name}
        </span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${STATUS_COLORS[status]}26`, color: STATUS_COLORS[status] }}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-y-0.5 text-mist-300">
        <dt>Produced</dt>
        <dd className="num text-right text-mist-100">{kg(pr.freshKg)}</dd>
        {pr.frozenInKg > 0 && (
          <>
            <dt>From freezer</dt>
            <dd className="num text-right text-sky-200">+{kg(pr.frozenInKg)}</dd>
          </>
        )}
        <dt>Demand</dt>
        <dd className="num text-right text-mist-100">{kg(pr.demandKg)}</dd>
        <dt>Sold</dt>
        <dd className="num text-right text-mist-100">
          {kg(pr.soldKg)} · {money(pr.revenue)}
        </dd>
        <dt>{gap >= 0 ? "Surplus" : "Shortfall"}</dt>
        <dd className={`num text-right ${gap >= 0 ? "text-sun-400" : "text-coral-400"}`}>{kg(Math.abs(gap))}</dd>
        {pr.frozenOutKg > 0 && (
          <>
            <dt>Frozen for next week</dt>
            <dd className="num text-right text-sky-200">{kg(pr.frozenOutKg)}</dd>
          </>
        )}
        {pr.wasteKg > 0.5 && (
          <>
            <dt>Wasted</dt>
            <dd className="num text-right text-coral-400">{kg(pr.wasteKg)}</dd>
          </>
        )}
      </dl>
      {buyers.length > 0 && (
        <div className="mt-2 border-t border-white/8 pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-mist-500">Top buyers</div>
          {buyers.map((b) => (
            <div key={b.orderId} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 truncate">
                <span className="size-2 rounded-full" style={{ background: CUSTOMER_BY_ID[b.customerId].color }} />
                {CUSTOMER_BY_ID[b.customerId].name}
              </span>
              <span className="num text-mist-300">
                {kg(b.kg, false)} kg @ {b.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
