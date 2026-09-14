"use client";

import { PART_BY_ID, PART_IDS } from "@/lib/data";
import { money, pct } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Panel } from "./ui";

const W = 640;
const H = 300;
const M = { l: 56, r: 44, t: 18, b: 40 };

export function WeeklyChart() {
  const { state, results, dispatch } = useStore();
  const weeks = state.plan.weeks;
  const n = weeks.length;

  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const slot = innerW / n;
  const barW = slot * 0.36;
  const maxVal = Math.max(...results.map((r) => Math.max(r.revenue, r.cost.total)), 1) * 1.08;
  const y = (v: number) => M.t + innerH - (v / maxVal) * innerH;
  const fy = (rate: number) => M.t + innerH - rate * innerH;

  const ticks = 4;
  const fillPath = results
    .map((r, i) => `${i === 0 ? "M" : "L"} ${M.l + i * slot + slot / 2} ${fy(Math.min(1, r.fillRate))}`)
    .join(" ");

  return (
    <Panel
      title="Eight weeks"
      action={
        <div className="flex items-center gap-3 text-[11px] text-mist-300">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-3 rounded-sm bg-gradient-to-r from-salmon-500 to-sky-300" /> Revenue by part
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-3 rounded-sm border border-mist-300/70 bg-white/10" /> Cost
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-kelp-400" /> Fill rate
          </span>
        </div>
      }
      className="pb-2"
    >
      <div className="px-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {Array.from({ length: ticks + 1 }, (_, i) => (maxVal / ticks) * i).map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
              <text x={M.l - 8} y={y(v)} dy="0.35em" textAnchor="end" fontSize={10} fill="#6f879d" className="num">
                {money(v)}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((r) => (
            <text key={r} x={W - M.r + 8} y={fy(r)} dy="0.35em" fontSize={10} fill="#34d399" opacity={0.8} className="num">
              {pct(r)}
            </text>
          ))}

          {results.map((r, i) => {
            const cx = M.l + i * slot + slot / 2;
            const active = i === state.selectedWeek;
            let acc = 0;
            return (
              <g key={i} onClick={() => dispatch({ type: "selectWeek", week: i })} className="cursor-pointer">
                <rect x={M.l + i * slot} y={M.t} width={slot} height={innerH} fill={active ? "rgba(255,122,89,0.08)" : "transparent"} rx={6} />
                {PART_IDS.map((p) => {
                  const v = r.parts[p].revenue;
                  if (v <= 0) return null;
                  const y0 = y(acc + v);
                  const h = y(acc) - y0;
                  acc += v;
                  return <rect key={p} x={cx - barW - 2} y={y0} width={barW} height={h} fill={PART_BY_ID[p].color} stroke="rgba(6,13,22,0.5)" strokeWidth={0.6} />;
                })}
                <rect x={cx + 2} y={y(r.cost.total)} width={barW} height={innerH - (y(r.cost.total) - M.t)} fill="rgba(255,255,255,0.08)" stroke="#aebfd0" strokeWidth={1} rx={2} />
                <text x={cx} y={H - M.b + 16} textAnchor="middle" fontSize={11} fontWeight={active ? 700 : 500} fill={active ? "#ff9b7a" : "#aebfd0"}>
                  {weeks[i].label}
                </text>
                <text x={cx} y={H - M.b + 30} textAnchor="middle" fontSize={10} fill={r.margin >= 0 ? "#34d399" : "#fb7185"} className="num">
                  {money(r.margin)}
                </text>
              </g>
            );
          })}

          <path d={fillPath} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" />
          {results.map((r, i) => (
            <circle key={i} cx={M.l + i * slot + slot / 2} cy={fy(Math.min(1, r.fillRate))} r={3.5} fill="#0a1622" stroke="#34d399" strokeWidth={2} />
          ))}
        </svg>
      </div>
    </Panel>
  );
}
