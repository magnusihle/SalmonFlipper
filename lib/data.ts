import type {
  CutMix,
  CutPlan,
  CutPlanDef,
  Customer,
  OrderLine,
  PartDef,
  PartId,
  PlanState,
  ScenarioId,
  WeekInput,
} from "./types";

export const CURRENCY = "kr";
export const WEEK_COUNT = 8;

// Product codes follow Source_Brief.md / fisk_plan_seed.json. Collar is not in the brief's graph.
export const PARTS: PartDef[] = [
  { id: "hog", name: "HOG", color: "#8ecae6", freezable: false, description: "Head-on gutted, sold whole" },
  { id: "fillet", name: "Trim C", color: "#ff7a59", freezable: true, description: "Skin-on PBO fillet, belly trimmed" },
  { id: "portion", name: "Portions", color: "#ffb347", freezable: true, description: "Skinless portions (PORTION_E)" },
  { id: "belly", name: "Belly flap", color: "#f4d35e", freezable: true, description: "Belly flap" },
  { id: "collar", name: "Collar", color: "#e08e79", freezable: true, description: "Not in the brief's graph" },
  { id: "head", name: "Head", color: "#9db4c0", freezable: false, description: "Head" },
  { id: "frame", name: "Frame", color: "#c8d5b9", freezable: false, description: "Frame" },
  { id: "trim", name: "Mince", color: "#d9a5b3", freezable: true, description: "Trim / mince" },
  { id: "skin", name: "Skin", color: "#b8b8ff", freezable: true, description: "Skin from Trim E" },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, PartDef>;
export const PART_IDS = PARTS.map((p) => p.id);

export const CUT_PLANS: CutPlanDef[] = [
  // Yields are cumulative fractions of ROUND from the seed graph; costs are NOK per kg round,
  // summed over the cost centres on each path (cost per kg in × cumulative yield of the centre's parent).
  {
    id: "whole",
    name: "Sell as HOG",
    description: "Gut only. Sold head-on gutted.",
    processingCostPerKg: 2.0,
    yields: { hog: 0.88 },
  },
  {
    id: "fillet",
    name: "Trim C fillet",
    description: "Gut, head, fillet, trim to C. Head, frame, belly and mince come off the same fish.",
    processingCostPerKg: 7.9,
    yields: { fillet: 0.551, head: 0.0968, frame: 0.141, belly: 0.0439, trim: 0.0313 },
  },
  {
    id: "portion",
    name: "Trim E → portions",
    description: "Trim and skin to E, then portion. More mince, plus skin.",
    processingCostPerKg: 12.4,
    yields: { portion: 0.434, trim: 0.0921, skin: 0.0439, head: 0.0968, frame: 0.141, belly: 0.0564 },
  },
];

export const CUT_PLAN_BY_ID = Object.fromEntries(CUT_PLANS.map((p) => [p.id, p])) as Record<CutPlan, CutPlanDef>;
export const CUT_PLAN_IDS: CutPlan[] = ["whole", "fillet", "portion"];
export const CUT_PLAN_COLORS: Record<CutPlan, string> = {
  whole: "#8ecae6",
  fillet: "#ff7a59",
  portion: "#ffb347",
};

export const FREEZE = { haircut: 0.2, costPerKg: 3 };

export const CUSTOMERS: Customer[] = [
  { id: "bistro", name: "Nordic Bistro Group", kind: "Restaurant", color: "#f97316" },
  { id: "sushi", name: "Sushi Kai", kind: "Restaurant", color: "#ef4444" },
  { id: "freshmart", name: "FreshMart Retail", kind: "Retail", color: "#22c55e" },
  { id: "harbor", name: "Harbor Wholesale", kind: "Wholesale", color: "#3b82f6" },
  { id: "smokehouse", name: "Smokehouse Co", kind: "Processor", color: "#a855f7" },
  { id: "stock", name: "Stock & Broth Ltd", kind: "Processor", color: "#14b8a6" },
  { id: "petpure", name: "PetPure Foods", kind: "Pet food", color: "#eab308" },
];

export const CUSTOMER_BY_ID = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c])) as Record<string, Customer>;

interface BaseOrder {
  customerId: string;
  part: PartId;
  kg: number;
  price: number;
}

// NOK/kg, in the range of the seed's order and residual prices.
const BASE_ORDERS: BaseOrder[] = [
  { customerId: "bistro", part: "fillet", kg: 320, price: 138 },
  { customerId: "bistro", part: "belly", kg: 80, price: 25 },
  { customerId: "sushi", part: "fillet", kg: 250, price: 148 },
  { customerId: "sushi", part: "belly", kg: 120, price: 28 },
  { customerId: "freshmart", part: "portion", kg: 900, price: 195 },
  { customerId: "freshmart", part: "fillet", kg: 400, price: 132 },
  { customerId: "freshmart", part: "hog", kg: 300, price: 82 },
  { customerId: "harbor", part: "hog", kg: 2400, price: 78 },
  { customerId: "harbor", part: "fillet", kg: 600, price: 126 },
  { customerId: "smokehouse", part: "fillet", kg: 700, price: 130 },
  { customerId: "smokehouse", part: "belly", kg: 200, price: 22 },
  { customerId: "smokehouse", part: "trim", kg: 150, price: 14 },
  { customerId: "stock", part: "frame", kg: 500, price: 3.5 },
  { customerId: "stock", part: "head", kg: 400, price: 8 },
  { customerId: "petpure", part: "trim", kg: 400, price: 12 },
  { customerId: "petpure", part: "skin", kg: 150, price: 4 },
  { customerId: "petpure", part: "frame", kg: 300, price: 3 },
];

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  tagline: string;
  description: string;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "baseline",
    name: "Steady season",
    tagline: "Normal supply, normal demand",
    description: "Eight weeks of typical autumn volumes. A good place to learn the controls.",
  },
  {
    id: "supply-shock",
    name: "Storm week",
    tagline: "Harvest halves in weeks 3–4",
    description: "Bad weather cuts landings and pushes fish prices up. Who do you serve first?",
  },
  {
    id: "demand-surge",
    name: "Festive rush",
    tagline: "Fillet & portion demand +50% late",
    description: "Retail and restaurants ramp up for the holidays in weeks 6–8.",
  },
  {
    id: "hog-glut",
    name: "Whole-fish glut",
    tagline: "HOG price collapses",
    description: "The spot market for head-on gutted fish drops 30%. Does processing pay off?",
  },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = new Date("2026-09-14T00:00:00Z");

function isoWeekLabel(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `W${week}`;
}

export const DEFAULT_MIX: CutMix = { whole: 0.3, fillet: 0.45, portion: 0.25 };

export function buildWeeks(scenario: ScenarioId): WeekInput[] {
  const rnd = mulberry32(scenario.length * 7919 + 42);
  const weeks: WeekInput[] = [];

  for (let w = 0; w < WEEK_COUNT; w++) {
    const start = new Date(START.getTime() + w * 7 * 86400000);
    const season = 1 + 0.08 * Math.sin((w / WEEK_COUNT) * Math.PI * 2);

    let available = Math.round(1400 * season * (0.92 + rnd() * 0.16));
    let costPerKg = +(60 * (0.96 + rnd() * 0.08)).toFixed(2);
    const avgKg = +(4.4 + rnd() * 0.5).toFixed(1);

    let demandFactor: (part: PartId) => number = () => 0.9 + rnd() * 0.2;
    let priceFactor: (part: PartId) => number = () => 1;

    if (scenario === "supply-shock" && (w === 2 || w === 3)) {
      available = Math.round(available * 0.5);
      costPerKg = +(costPerKg * 1.15).toFixed(2);
    }
    if (scenario === "demand-surge" && w >= 5) {
      const base = demandFactor;
      demandFactor = (part) => base(part) * (part === "fillet" || part === "portion" ? 1.5 : 1.1);
      priceFactor = (part) => (part === "fillet" || part === "portion" ? 1.1 : 1);
    }
    if (scenario === "hog-glut") {
      priceFactor = (part) => (part === "hog" ? 0.7 : 1);
    }

    const orders: OrderLine[] = BASE_ORDERS.map((o, i) => ({
      id: `w${w}-o${i}`,
      customerId: o.customerId,
      part: o.part,
      kg: Math.round((o.kg * demandFactor(o.part)) / 10) * 10,
      price: +(o.price * priceFactor(o.part)).toFixed(2),
    }));

    weeks.push({
      label: isoWeekLabel(start),
      startDate: start.toISOString().slice(0, 10),
      supply: { available, used: available, avgKg, costPerKg },
      mix: { ...DEFAULT_MIX },
      orders,
    });
  }
  return weeks;
}

export function initialState(scenario: ScenarioId = "baseline"): PlanState {
  return { scenario, weeks: buildWeeks(scenario) };
}
