"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { autoPlan, simulate } from "./engine";
import { initialState } from "./data";
import type { CutMix, CutPlan, OrderLine, PlanState, ScenarioId, WeekResult } from "./types";

type Action =
  | { type: "hydrate"; state: PersistedState }
  | { type: "selectWeek"; week: number }
  | { type: "setSupply"; week: number; patch: Partial<PlanState["weeks"][number]["supply"]> }
  | { type: "setMix"; week: number; plan: CutPlan; value: number }
  | { type: "setOrder"; week: number; id: string; patch: Partial<Pick<OrderLine, "kg" | "price">> }
  | { type: "addOrder"; week: number; order: OrderLine }
  | { type: "removeOrder"; week: number; id: string }
  | { type: "scaleCustomer"; customerId: string; factor: number }
  | { type: "copyMixToAll"; week: number }
  | { type: "copyOrdersToAll"; week: number }
  | { type: "applyScenario"; scenario: ScenarioId }
  | { type: "autoPlan" }
  | { type: "reset" }
  | { type: "introDone" }
  | { type: "replayIntro" };

interface PersistedState {
  plan: PlanState;
  selectedWeek: number;
  introDone: boolean;
}

interface AppState extends PersistedState {
  hydrated: boolean;
}

const STORAGE_KEY = "fishbone:v2";

function rebalanceMix(mix: CutMix, plan: CutPlan, value: number): CutMix {
  const v = Math.max(0, Math.min(1, value));
  const others = (["whole", "fillet", "portion"] as CutPlan[]).filter((p) => p !== plan);
  const otherTotal = others.reduce((a, p) => a + mix[p], 0);
  const remaining = 1 - v;
  const next = { ...mix, [plan]: v } as CutMix;
  for (const p of others) {
    next[p] = otherTotal > 0 ? (mix[p] / otherTotal) * remaining : remaining / others.length;
  }
  return next;
}

function updateWeek(state: AppState, week: number, fn: (w: PlanState["weeks"][number]) => PlanState["weeks"][number]): AppState {
  const weeks = state.plan.weeks.map((w, i) => (i === week ? fn(w) : w));
  return { ...state, plan: { ...state.plan, weeks } };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return { ...action.state, hydrated: true };
    case "selectWeek":
      return { ...state, selectedWeek: action.week };
    case "setSupply":
      return updateWeek(state, action.week, (w) => {
        const supply = { ...w.supply, ...action.patch };
        supply.available = Math.max(0, Math.round(supply.available));
        supply.used = Math.max(0, Math.min(Math.round(supply.used), supply.available));
        return { ...w, supply };
      });
    case "setMix":
      return updateWeek(state, action.week, (w) => ({ ...w, mix: rebalanceMix(w.mix, action.plan, action.value) }));
    case "setOrder":
      return updateWeek(state, action.week, (w) => ({
        ...w,
        orders: w.orders.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)),
      }));
    case "addOrder":
      return updateWeek(state, action.week, (w) => ({ ...w, orders: [...w.orders, action.order] }));
    case "removeOrder":
      return updateWeek(state, action.week, (w) => ({ ...w, orders: w.orders.filter((o) => o.id !== action.id) }));
    case "scaleCustomer": {
      const weeks = state.plan.weeks.map((w) => ({
        ...w,
        orders: w.orders.map((o) =>
          o.customerId === action.customerId ? { ...o, kg: Math.round((o.kg * action.factor) / 10) * 10 } : o,
        ),
      }));
      return { ...state, plan: { ...state.plan, weeks } };
    }
    case "copyMixToAll": {
      const mix = state.plan.weeks[action.week].mix;
      const weeks = state.plan.weeks.map((w) => ({ ...w, mix: { ...mix } }));
      return { ...state, plan: { ...state.plan, weeks } };
    }
    case "copyOrdersToAll": {
      const source = state.plan.weeks[action.week].orders;
      const weeks = state.plan.weeks.map((w, i) => ({
        ...w,
        orders: source.map((o, j) => ({ ...o, id: `w${i}-c${j}-${o.customerId}-${o.part}` })),
      }));
      return { ...state, plan: { ...state.plan, weeks } };
    }
    case "applyScenario":
      return { ...state, plan: initialState(action.scenario), selectedWeek: 0 };
    case "autoPlan":
      return { ...state, plan: { ...state.plan, weeks: autoPlan(state.plan.weeks) } };
    case "reset":
      return { ...state, plan: initialState(state.plan.scenario) };
    case "introDone":
      return { ...state, introDone: true };
    case "replayIntro":
      return { ...state, introDone: false };
  }
}

interface Ctx {
  state: AppState;
  results: WeekResult[];
  dispatch: (a: Action) => void;
}

const StoreContext = createContext<Ctx | null>(null);

const defaultState: AppState = {
  plan: initialState("baseline"),
  selectedWeek: 0,
  introDone: false,
  hydrated: false,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);

  useEffect(() => {
    let persisted: PersistedState | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) persisted = JSON.parse(raw) as PersistedState;
    } catch {
      persisted = null;
    }
    dispatch({
      type: "hydrate",
      state: persisted ?? { plan: defaultState.plan, selectedWeek: 0, introDone: false },
    });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      const { plan, selectedWeek, introDone } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, selectedWeek, introDone }));
    } catch {
      // storage unavailable; state stays in memory
    }
  }, [state]);

  const results = useMemo(() => simulate(state.plan.weeks), [state.plan.weeks]);
  const value = useMemo(() => ({ state, results, dispatch }), [state, results]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useSelectedWeek() {
  const { state, results } = useStore();
  const i = Math.min(state.selectedWeek, state.plan.weeks.length - 1);
  return { index: i, week: state.plan.weeks[i], result: results[i] };
}
