import { CUT_PLAN_BY_ID, CUT_PLAN_IDS, FREEZE, PART_BY_ID, PART_IDS } from "./data";
import type { CutMix, CutPlan, Fill, PartId, PartResult, WeekInput, WeekResult } from "./types";

export type Inventory = Record<PartId, number>;

export function emptyInventory(): Inventory {
  return Object.fromEntries(PART_IDS.map((p) => [p, 0])) as Inventory;
}

export function normalizeMix(mix: CutMix): CutMix {
  const total = mix.whole + mix.fillet + mix.portion || 1;
  return { whole: mix.whole / total, fillet: mix.fillet / total, portion: mix.portion / total };
}

export function simulateWeek(week: WeekInput, frozenIn: Inventory): { result: WeekResult; frozenOut: Inventory } {
  const { supply } = week;
  const mix = normalizeMix(week.mix);
  const fishUsed = Math.max(0, Math.min(supply.used, supply.available));
  const kgIn = fishUsed * supply.avgKg;

  const planKg = { whole: 0, fillet: 0, portion: 0 } as Record<CutPlan, number>;
  const fresh = emptyInventory();
  let processing = 0;
  let lossKg = 0;

  for (const planId of CUT_PLAN_IDS) {
    const plan = CUT_PLAN_BY_ID[planId];
    const kg = kgIn * mix[planId];
    planKg[planId] = kg;
    processing += kg * plan.processingCostPerKg;
    let yielded = 0;
    for (const [part, y] of Object.entries(plan.yields) as [PartId, number][]) {
      fresh[part] += kg * y;
      yielded += y;
    }
    lossKg += kg * (1 - yielded);
  }

  const parts = {} as Record<PartId, PartResult>;
  const fills: Fill[] = [];
  const frozenOut = emptyInventory();
  let revenue = 0;
  let freezing = 0;
  let demandKg = 0;
  let soldKg = 0;
  let wasteKg = 0;

  for (const part of PART_IDS) {
    let freshLeft = fresh[part];
    let frozenLeft = frozenIn[part] ?? 0;
    const orders = week.orders.filter((o) => o.part === part && o.kg > 0).sort((a, b) => b.price - a.price);
    const pr: PartResult = {
      part,
      freshKg: fresh[part],
      frozenInKg: frozenLeft,
      demandKg: 0,
      soldKg: 0,
      revenue: 0,
      frozenOutKg: 0,
      wasteKg: 0,
    };

    for (const o of orders) {
      pr.demandKg += o.kg;
      const take = Math.min(o.kg, freshLeft + frozenLeft);
      if (take <= 0) continue;
      const frozenTake = Math.min(take, frozenLeft);
      const freshTake = take - frozenTake;
      frozenLeft -= frozenTake;
      freshLeft -= freshTake;
      const rev = freshTake * o.price + frozenTake * o.price * (1 - FREEZE.haircut);
      pr.soldKg += take;
      pr.revenue += rev;
      fills.push({
        orderId: o.id,
        customerId: o.customerId,
        part,
        kg: take,
        freshKg: freshTake,
        frozenKg: frozenTake,
        revenue: rev,
        price: o.price,
      });
    }

    if (PART_BY_ID[part].freezable) {
      pr.frozenOutKg = freshLeft;
      frozenOut[part] = freshLeft;
      freezing += freshLeft * FREEZE.costPerKg;
      pr.wasteKg = frozenLeft;
    } else {
      pr.wasteKg = freshLeft + frozenLeft;
    }

    parts[part] = pr;
    revenue += pr.revenue;
    demandKg += pr.demandKg;
    soldKg += pr.soldKg;
    wasteKg += pr.wasteKg;
  }

  const fishCost = kgIn * supply.costPerKg;
  const cost = { fish: fishCost, processing, freezing, total: fishCost + processing + freezing };
  const frozenOutKg = Object.values(frozenOut).reduce((a, b) => a + b, 0);

  return {
    result: {
      fishUsed,
      kgIn,
      planKg,
      parts,
      fills,
      demandKg,
      soldKg,
      fillRate: demandKg > 0 ? soldKg / demandKg : 1,
      revenue,
      cost,
      margin: revenue - cost.total,
      lossKg,
      wasteKg,
      frozenOutKg,
    },
    frozenOut,
  };
}

export function simulate(weeks: WeekInput[]): WeekResult[] {
  let inv = emptyInventory();
  return weeks.map((w) => {
    const { result, frozenOut } = simulateWeek(w, inv);
    inv = frozenOut;
    return result;
  });
}

const MIX_GRID: CutMix[] = (() => {
  const out: CutMix[] = [];
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10 - a; b++) {
      out.push({ whole: a / 10, fillet: b / 10, portion: (10 - a - b) / 10 });
    }
  }
  return out;
})();

export function autoPlan(weeks: WeekInput[]): WeekInput[] {
  let inv = emptyInventory();
  return weeks.map((week) => {
    const avail = week.supply.available;
    const step = Math.max(1, Math.round(avail / 25));
    let best: { margin: number; used: number; mix: CutMix; frozenOut: Inventory } | null = null;

    for (let used = 0; used <= avail; used = Math.min(avail, used + step)) {
      for (const mix of MIX_GRID) {
        const candidate = { ...week, mix, supply: { ...week.supply, used } };
        const { result, frozenOut } = simulateWeek(candidate, inv);
        if (!best || result.margin > best.margin + 1e-6) {
          best = { margin: result.margin, used, mix, frozenOut };
        }
      }
      if (used === avail) break;
    }

    inv = best!.frozenOut;
    return { ...week, mix: best!.mix, supply: { ...week.supply, used: best!.used } };
  });
}

export function totals(results: WeekResult[]) {
  const sum = (f: (r: WeekResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const demandKg = sum((r) => r.demandKg);
  const soldKg = sum((r) => r.soldKg);
  return {
    revenue: sum((r) => r.revenue),
    cost: sum((r) => r.cost.total),
    margin: sum((r) => r.margin),
    demandKg,
    soldKg,
    fillRate: demandKg > 0 ? soldKg / demandKg : 1,
    wasteKg: sum((r) => r.wasteKg + r.lossKg),
    fish: sum((r) => r.fishUsed),
    kgIn: sum((r) => r.kgIn),
  };
}

export type Status = "shortfall" | "balanced" | "surplus" | "idle";

export function partStatus(pr: PartResult): Status {
  const produced = pr.freshKg + pr.frozenInKg;
  if (pr.demandKg <= 0) return produced > 0 ? "surplus" : "idle";
  const ratio = produced / pr.demandKg;
  if (ratio < 0.9) return "shortfall";
  if (ratio > 1.1) return "surplus";
  return "balanced";
}

export const STATUS_COLORS: Record<Status, string> = {
  shortfall: "#fb7185",
  balanced: "#34d399",
  surplus: "#fbbf24",
  idle: "#3b4a5a",
};

export const STATUS_LABELS: Record<Status, string> = {
  shortfall: "Shortfall",
  balanced: "Balanced",
  surplus: "Surplus",
  idle: "No demand",
};
