"use client";

import { CUT_PLANS, FREEZE, PART_BY_ID } from "@/lib/data";
import { STATUS_COLORS } from "@/lib/engine";
import { int, kg, money, pct } from "@/lib/format";
import { useSelectedWeek } from "@/lib/store";
import type { PartId } from "@/lib/types";

interface Insight {
  color: string;
  text: string;
}

export function Insights() {
  const { week, result } = useSelectedWeek();
  const items: Insight[] = [];
  const parts = Object.values(result.parts);

  const shortfalls = parts
    .map((p) => ({ p, gap: p.demandKg - (p.freshKg + p.frozenInKg) }))
    .filter((x) => x.gap > 5)
    .sort((a, b) => b.gap - a.gap);

  if (shortfalls.length) {
    const { p, gap } = shortfalls[0];
    const unfilled = week.orders.filter((o) => o.part === p.part && !result.fills.some((f) => f.orderId === o.id && f.kg >= o.kg - 0.01));
    const lostRevenue = unfilled.reduce((a, o) => {
      const filled = result.fills.find((f) => f.orderId === o.id)?.kg ?? 0;
      return a + (o.kg - filled) * o.price;
    }, 0);
    const plan = CUT_PLANS.find((c) => (c.yields[p.part as PartId] ?? 0) > 0.2);
    const shift = plan && result.kgIn > 0 ? gap / (result.kgIn * (plan.yields[p.part as PartId] ?? 1)) : 0;
    items.push({
      color: STATUS_COLORS.shortfall,
      text: `${PART_BY_ID[p.part].name} is short by ${kg(gap)} — ${unfilled.length} order${unfilled.length === 1 ? "" : "s"} unfilled, ${money(lostRevenue)} left on the table.${
        plan && shift > 0 && shift < 1 ? ` Shifting ~${Math.max(1, Math.round(shift * 100))} pts of the cut mix to “${plan.name}” would cover it.` : ""
      }`,
    });
  }

  const surpluses = parts
    .map((p) => ({ p, extra: p.frozenOutKg + p.wasteKg }))
    .filter((x) => x.extra > 5)
    .sort((a, b) => b.extra - a.extra);

  if (surpluses.length) {
    const { p } = surpluses[0];
    const def = PART_BY_ID[p.part];
    if (p.frozenOutKg > 5) {
      items.push({
        color: "#7dd3fc",
        text: `${kg(p.frozenOutKg)} of ${def.name.toLowerCase()} goes to the freezer (${money(p.frozenOutKg * FREEZE.costPerKg)}) and sells next week at −${pct(FREEZE.haircut)}.`,
      });
    }
    if (p.wasteKg > 5) {
      items.push({
        color: STATUS_COLORS.surplus,
        text: `${kg(p.wasteKg)} of ${def.name.toLowerCase()} has no buyer and ${def.freezable ? "was already frozen once — it's wasted" : "can't be frozen — it's wasted"}. Find a buyer or cut less.`,
      });
    }
  }

  const unused = week.supply.available - result.fishUsed;
  if (unused > 0 && result.demandKg - result.soldKg > 50) {
    items.push({
      color: "#8ecae6",
      text: `${int(unused)} fish left unbought while ${kg(result.demandKg - result.soldKg)} of demand is unfilled. Processing more may pay off.`,
    });
  }

  const frozenIn = parts.reduce((a, p) => a + p.frozenInKg, 0);
  if (frozenIn > 5) {
    items.push({ color: "#7dd3fc", text: `Using ${kg(frozenIn)} of frozen stock carried from last week.` });
  }

  if (items.length === 0) {
    items.push({ color: STATUS_COLORS.balanced, text: `Supply and demand are well balanced this week — ${pct(result.fillRate)} filled with ${kg(result.wasteKg)} wasted.` });
  }

  return (
    <div className="panel px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist-500">Read-out · {week.label}</h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.slice(0, 4).map((it, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: it.color }} />
            <span className="text-mist-100/90">{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
