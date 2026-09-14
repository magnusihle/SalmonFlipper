"use client";

import { useMemo, useState } from "react";
import { CUSTOMERS, CUT_PLANS, CUT_PLAN_BY_ID, CUT_PLAN_COLORS, PART_BY_ID, PART_IDS } from "@/lib/data";
import { kg } from "@/lib/format";
import { useSelectedWeek } from "@/lib/store";
import type { PartId } from "@/lib/types";
import { Panel } from "./ui";

const W = 960;
const H = 400;
const NODE_W = 14;
const PAD = 14;
const TOP = 16;
const COL_X = [150, 470, 790];

interface Node {
  id: string;
  label: string;
  color: string;
  col: number;
  kg: number;
  y: number;
  h: number;
  sub?: string;
}

interface Link {
  source: string;
  target: string;
  kg: number;
  color: string;
  sy: number;
  ty: number;
  h: number;
}

export function FlowDiagram() {
  const { week, result } = useSelectedWeek();
  const [hover, setHover] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => {
    const nodes: Node[] = [];
    const rawLinks: { source: string; target: string; kg: number; color: string }[] = [];

    for (const plan of CUT_PLANS) {
      const planKg = result.planKg[plan.id];
      if (planKg < 1) continue;
      nodes.push({ id: `plan:${plan.id}`, label: plan.name, color: CUT_PLAN_COLORS[plan.id], col: 0, kg: planKg, y: 0, h: 0, sub: kg(planKg) });
      let yielded = 0;
      for (const [part, y] of Object.entries(plan.yields) as [PartId, number][]) {
        rawLinks.push({ source: `plan:${plan.id}`, target: `part:${part}`, kg: planKg * y, color: PART_BY_ID[part].color });
        yielded += y;
      }
      if (yielded < 0.999) rawLinks.push({ source: `plan:${plan.id}`, target: "dest:loss", kg: planKg * (1 - yielded), color: "#64748b" });
    }

    const frozenIn = PART_IDS.reduce((a, p) => a + result.parts[p].frozenInKg, 0);
    if (frozenIn > 1) {
      nodes.push({ id: "plan:freezer", label: "From freezer", color: "#7dd3fc", col: 0, kg: frozenIn, y: 0, h: 0, sub: kg(frozenIn) });
      for (const p of PART_IDS) {
        const v = result.parts[p].frozenInKg;
        if (v > 0.5) rawLinks.push({ source: "plan:freezer", target: `part:${p}`, kg: v, color: PART_BY_ID[p].color });
      }
    }

    for (const p of PART_IDS) {
      const pr = result.parts[p];
      const total = pr.freshKg + pr.frozenInKg;
      if (total < 1) continue;
      nodes.push({ id: `part:${p}`, label: PART_BY_ID[p].name, color: PART_BY_ID[p].color, col: 1, kg: total, y: 0, h: 0, sub: kg(total) });
      if (pr.frozenOutKg > 0.5) rawLinks.push({ source: `part:${p}`, target: "dest:freeze", kg: pr.frozenOutKg, color: PART_BY_ID[p].color });
      if (pr.wasteKg > 0.5) rawLinks.push({ source: `part:${p}`, target: "dest:waste", kg: pr.wasteKg, color: PART_BY_ID[p].color });
    }

    const byCustomerPart = new Map<string, number>();
    for (const f of result.fills) {
      const key = `${f.customerId}|${f.part}`;
      byCustomerPart.set(key, (byCustomerPart.get(key) ?? 0) + f.kg);
    }
    for (const c of CUSTOMERS) {
      const total = result.fills.filter((f) => f.customerId === c.id).reduce((a, f) => a + f.kg, 0);
      if (total < 1) continue;
      nodes.push({ id: `dest:${c.id}`, label: c.name, color: c.color, col: 2, kg: total, y: 0, h: 0, sub: kg(total) });
    }
    for (const [key, v] of byCustomerPart) {
      const [cid, part] = key.split("|") as [string, PartId];
      rawLinks.push({ source: `part:${part}`, target: `dest:${cid}`, kg: v, color: PART_BY_ID[part].color });
    }

    const frozenOut = result.frozenOutKg;
    if (frozenOut > 1) nodes.push({ id: "dest:freeze", label: "Freeze → next week", color: "#7dd3fc", col: 2, kg: frozenOut, y: 0, h: 0, sub: kg(frozenOut) });
    if (result.wasteKg > 1) nodes.push({ id: "dest:waste", label: "Waste", color: "#fb7185", col: 2, kg: result.wasteKg, y: 0, h: 0, sub: kg(result.wasteKg) });
    if (result.lossKg > 1) nodes.push({ id: "dest:loss", label: "Cutting loss", color: "#64748b", col: 2, kg: result.lossKg, y: 0, h: 0, sub: kg(result.lossKg) });

    const colTotals = [0, 1, 2].map((c) => nodes.filter((n) => n.col === c));
    const maxKg = Math.max(...colTotals.map((col) => col.reduce((a, n) => a + n.kg, 0)), 1);
    const scale = (H - TOP * 2 - Math.max(...colTotals.map((c) => Math.max(0, c.length - 1) * PAD))) / maxKg;

    for (const col of colTotals) {
      const total = col.reduce((a, n) => a + n.kg * scale, 0) + Math.max(0, col.length - 1) * PAD;
      let y = TOP + (H - TOP * 2 - total) / 2;
      for (const n of col) {
        n.y = y;
        n.h = Math.max(n.kg * scale, 1.5);
        y += n.h + PAD;
      }
    }

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const outOffset = new Map<string, number>();
    const inOffset = new Map<string, number>();
    const links: Link[] = [];
    const sorted = [...rawLinks].sort((a, b) => (byId.get(a.target)?.y ?? 0) - (byId.get(b.target)?.y ?? 0) || (byId.get(a.source)?.y ?? 0) - (byId.get(b.source)?.y ?? 0));
    for (const l of sorted) {
      const s = byId.get(l.source);
      const t = byId.get(l.target);
      if (!s || !t || l.kg < 0.5) continue;
      const h = l.kg * scale;
      const sy = s.y + (outOffset.get(s.id) ?? 0);
      const ty = t.y + (inOffset.get(t.id) ?? 0);
      outOffset.set(s.id, sy - s.y + h);
      inOffset.set(t.id, ty - t.y + h);
      links.push({ ...l, sy, ty, h });
    }

    return { nodes, links };
  }, [result]);

  const isDim = (l: Link) => hover !== null && l.source !== hover && l.target !== hover;

  return (
    <Panel
      title={`Flow · ${week.label}`}
      action={<span className="text-[11px] text-mist-500">Whole fish → parts → buyers. Ribbon width = kg. Hover to trace.</span>}
      className="pb-3"
    >
      <div className="px-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
          <g>
            {links.map((l, i) => {
              const s = nodes.find((n) => n.id === l.source)!;
              const t = nodes.find((n) => n.id === l.target)!;
              const x0 = COL_X[s.col] + NODE_W;
              const x1 = COL_X[t.col];
              const mx = (x0 + x1) / 2;
              const d = `M ${x0} ${l.sy} C ${mx} ${l.sy}, ${mx} ${l.ty}, ${x1} ${l.ty} L ${x1} ${l.ty + l.h} C ${mx} ${l.ty + l.h}, ${mx} ${l.sy + l.h}, ${x0} ${l.sy + l.h} Z`;
              const active = hover !== null && !isDim(l);
              return (
                <path
                  key={i}
                  d={d}
                  fill={l.color}
                  opacity={isDim(l) ? 0.08 : active ? 0.85 : 0.5}
                  className="transition-opacity duration-200"
                  onMouseEnter={() => setHover(l.source)}
                >
                  <title>
                    {`${s.label} → ${t.label}: ${kg(l.kg)}`}
                  </title>
                </path>
              );
            })}
          </g>
          {nodes.map((n) => {
            const x = COL_X[n.col];
            const labelX = n.col === 0 ? x - 8 : n.col === 2 ? x + NODE_W + 8 : x + NODE_W + 8;
            const anchor = n.col === 0 ? "end" : "start";
            const dim = hover !== null && hover !== n.id && !links.some((l) => (l.source === hover && l.target === n.id) || (l.target === hover && l.source === n.id));
            return (
              <g
                key={n.id}
                opacity={dim ? 0.35 : 1}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHover(n.id)}
              >
                <rect x={x} y={n.y} width={NODE_W} height={n.h} rx={3} fill={n.color} stroke="rgba(6,13,22,0.6)" />
                <text x={labelX} y={n.y + n.h / 2} dy="0.35em" textAnchor={anchor} fontSize={11} fontWeight={600} fill="#e8f0f7" paintOrder="stroke" stroke="rgba(6,13,22,0.85)" strokeWidth={4} strokeLinejoin="round">
                  {n.label}
                  <tspan fill="#aebfd0" fontWeight={400}>
                    {" "}
                    {n.sub}
                  </tspan>
                </text>
              </g>
            );
          })}
          <g fontSize={10} fill="#6f879d" textAnchor="middle" letterSpacing="0.12em">
            <text x={COL_X[0] + NODE_W / 2} y={10}>CUT PLAN</text>
            <text x={COL_X[1] + NODE_W / 2} y={10}>PARTS</text>
            <text x={COL_X[2] + NODE_W / 2} y={10}>DESTINATION</text>
          </g>
        </svg>
      </div>
      {hover?.startsWith("plan:") && hover !== "plan:freezer" && (
        <p className="px-4 text-xs text-mist-300">{CUT_PLAN_BY_ID[hover.slice(5) as keyof typeof CUT_PLAN_BY_ID]?.description}</p>
      )}
    </Panel>
  );
}
