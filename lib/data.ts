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

export const CURRENCY = "$";
export const WEEK_COUNT = 8;

export const PARTS: PartDef[] = [
  { id: "hog", name: "Whole (HOG)", color: "#8ecae6", freezable: false, description: "Head-on gutted, sold whole" },
  { id: "fillet", name: "Fillet", color: "#ff7a59", freezable: true, description: "Skin-on side fillets" },
  { id: "portion", name: "Portions", color: "#ffb347", freezable: true, description: "Skinless portion cuts" },
  { id: "belly", name: "Belly", color: "#f4d35e", freezable: true, description: "Fatty belly strips" },
  { id: "collar", name: "Collar", color: "#e08e79", freezable: true, description: "Collar behind the gills" },
  { id: "head", name: "Head", color: "#9db4c0", freezable: false, description: "Heads for stock" },
  { id: "frame", name: "Frame", color: "#c8d5b9", freezable: false, description: "Backbone and ribs" },
  { id: "trim", name: "Trim", color: "#d9a5b3", freezable: true, description: "Offcuts and mince" },
  { id: "skin", name: "Skin", color: "#b8b8ff", freezable: true, description: "Skins from portioning" },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, PartDef>;
export const PART_IDS = PARTS.map((p) => p.id);

export const CUT_PLANS: CutPlanDef[] = [
  {
    id: "whole",
    name: "Sell whole",
    description: "No processing. Sold as head-on gutted fish.",
    processingCostPerKg: 0,
    yields: { hog: 1 },
  },
  {
    id: "fillet",
    name: "Fillet cut",
    description: "Two skin-on fillets plus head, frame, belly, collar and trim.",
    processingCostPerKg: 1.0,
    yields: { fillet: 0.58, head: 0.09, frame: 0.12, belly: 0.06, collar: 0.04, trim: 0.04 },
  },
  {
    id: "portion",
    name: "Portion cut",
    description: "Fillets cut down to skinless portions. More trim and skin.",
    processingCostPerKg: 2.2,
    yields: { portion: 0.44, trim: 0.12, skin: 0.06, head: 0.09, frame: 0.12, belly: 0.06, collar: 0.04 },
  },
];

export const CUT_PLAN_BY_ID = Object.fromEntries(CUT_PLANS.map((p) => [p.id, p])) as Record<CutPlan, CutPlanDef>;
export const CUT_PLAN_IDS: CutPlan[] = ["whole", "fillet", "portion"];
export const CUT_PLAN_COLORS: Record<CutPlan, string> = {
  whole: "#8ecae6",
  fillet: "#ff7a59",
  portion: "#ffb347",
};

export const FREEZE = { haircut: 0.2, costPerKg: 0.4 };

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

const BASE_ORDERS: BaseOrder[] = [
  { customerId: "bistro", part: "fillet", kg: 320, price: 16.5 },
  { customerId: "bistro", part: "collar", kg: 60, price: 7.5 },
  { customerId: "bistro", part: "belly", kg: 80, price: 9.5 },
  { customerId: "sushi", part: "fillet", kg: 250, price: 18 },
  { customerId: "sushi", part: "belly", kg: 120, price: 12 },
  { customerId: "freshmart", part: "portion", kg: 900, price: 21 },
  { customerId: "freshmart", part: "fillet", kg: 400, price: 15.5 },
  { customerId: "freshmart", part: "hog", kg: 300, price: 10.5 },
  { customerId: "harbor", part: "hog", kg: 2400, price: 9.8 },
  { customerId: "harbor", part: "fillet", kg: 600, price: 14.8 },
  { customerId: "smokehouse", part: "fillet", kg: 700, price: 15 },
  { customerId: "smokehouse", part: "belly", kg: 200, price: 8.5 },
  { customerId: "smokehouse", part: "trim", kg: 150, price: 4.5 },
  { customerId: "stock", part: "frame", kg: 500, price: 1.9 },
  { customerId: "stock", part: "head", kg: 400, price: 2.6 },
  { customerId: "petpure", part: "trim", kg: 400, price: 3.8 },
  { customerId: "petpure", part: "skin", kg: 150, price: 3.2 },
  { customerId: "petpure", part: "frame", kg: 300, price: 1.5 },
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
    tagline: "Wholesale HOG price collapses",
    description: "The spot market for whole fish drops 30%. Does processing pay off?",
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
    let costPerKg = +(7.8 * (0.96 + rnd() * 0.08)).toFixed(2);
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
