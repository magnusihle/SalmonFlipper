export type PartId =
  | "hog"
  | "fillet"
  | "portion"
  | "belly"
  | "collar"
  | "head"
  | "frame"
  | "trim"
  | "skin";

export type CutPlan = "whole" | "fillet" | "portion";

export interface PartDef {
  id: PartId;
  name: string;
  color: string;
  freezable: boolean;
  description: string;
}

export interface CutPlanDef {
  id: CutPlan;
  name: string;
  description: string;
  processingCostPerKg: number;
  yields: Partial<Record<PartId, number>>;
}

export interface WeekSupply {
  available: number;
  used: number;
  avgKg: number;
  costPerKg: number;
}

export type CutMix = Record<CutPlan, number>;

export interface Customer {
  id: string;
  name: string;
  kind: "Restaurant" | "Retail" | "Wholesale" | "Processor" | "Pet food";
  color: string;
}

export interface OrderLine {
  id: string;
  customerId: string;
  part: PartId;
  kg: number;
  price: number;
}

export interface WeekInput {
  label: string;
  startDate: string;
  supply: WeekSupply;
  mix: CutMix;
  orders: OrderLine[];
}

export type ScenarioId = "baseline" | "supply-shock" | "demand-surge" | "hog-glut";

export interface PlanState {
  scenario: ScenarioId;
  weeks: WeekInput[];
}

export interface Fill {
  orderId: string;
  customerId: string;
  part: PartId;
  kg: number;
  freshKg: number;
  frozenKg: number;
  revenue: number;
  price: number;
}

export interface PartResult {
  part: PartId;
  freshKg: number;
  frozenInKg: number;
  demandKg: number;
  soldKg: number;
  revenue: number;
  frozenOutKg: number;
  wasteKg: number;
}

export interface WeekResult {
  fishUsed: number;
  kgIn: number;
  planKg: Record<CutPlan, number>;
  parts: Record<PartId, PartResult>;
  fills: Fill[];
  demandKg: number;
  soldKg: number;
  fillRate: number;
  revenue: number;
  cost: { fish: number; processing: number; freezing: number; total: number };
  margin: number;
  lossKg: number;
  wasteKg: number;
  frozenOutKg: number;
}
