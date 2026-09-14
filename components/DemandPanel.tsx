"use client";

import { useMemo, useState } from "react";
import { CUSTOMERS, PARTS, PART_BY_ID } from "@/lib/data";
import { kg, money, pct } from "@/lib/format";
import { useSelectedWeek, useStore } from "@/lib/store";
import type { PartId } from "@/lib/types";
import { Button, Dot, NumberField, Panel } from "./ui";

export function DemandPanel() {
  const { dispatch } = useStore();
  const { index, week, result } = useSelectedWeek();
  const [adding, setAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState(CUSTOMERS[0].id);
  const [newPart, setNewPart] = useState<PartId>("fillet");

  const fillByOrder = useMemo(() => {
    const m = new Map<string, { kg: number; revenue: number; frozenKg: number }>();
    for (const f of result.fills) m.set(f.orderId, { kg: f.kg, revenue: f.revenue, frozenKg: f.frozenKg });
    return m;
  }, [result.fills]);

  const groups = CUSTOMERS.map((c) => ({
    customer: c,
    orders: week.orders.filter((o) => o.customerId === c.id),
  })).filter((g) => g.orders.length > 0);

  const addOrder = () => {
    const sample = week.orders.filter((o) => o.part === newPart).map((o) => o.price);
    const defaultPrice = sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : 10;
    dispatch({
      type: "addOrder",
      week: index,
      order: { id: `w${index}-${Date.now()}`, customerId: newCustomer, part: newPart, kg: 100, price: +defaultPrice.toFixed(2) },
    });
    setAdding(false);
  };

  return (
    <Panel
      title={`Demand · ${week.label}`}
      className="pb-3"
      action={
        <div className="flex items-center gap-1">
          <Button variant="subtle" className="px-2 py-0.5 text-xs" onClick={() => dispatch({ type: "copyOrdersToAll", week: index })}>
            Apply to all weeks
          </Button>
          <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => setAdding((a) => !a)}>
            + Order
          </Button>
        </div>
      }
    >
      {adding && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-salmon-500/40 bg-salmon-500/5 p-2 text-sm">
          <select className="field flex-1 text-xs" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)}>
            {CUSTOMERS.map((c) => (
              <option key={c.id} value={c.id} className="bg-sea-900">
                {c.name}
              </option>
            ))}
          </select>
          <select className="field flex-1 text-xs" value={newPart} onChange={(e) => setNewPart(e.target.value as PartId)}>
            {PARTS.map((p) => (
              <option key={p.id} value={p.id} className="bg-sea-900">
                {p.name}
              </option>
            ))}
          </select>
          <Button variant="primary" className="px-2 py-1 text-xs" onClick={addOrder}>
            Add
          </Button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_72px_72px_90px_20px] items-center gap-x-2 px-4 pb-1 text-[10px] uppercase tracking-wider text-mist-500">
        <span>Customer / part</span>
        <span className="text-right">kg</span>
        <span className="text-right">Price</span>
        <span className="text-right">Filled</span>
        <span />
      </div>

      <div className="flex max-h-[560px] flex-col gap-3 overflow-y-auto px-4">
        {groups.map(({ customer, orders }) => {
          const demand = orders.reduce((a, o) => a + o.kg, 0);
          const sold = orders.reduce((a, o) => a + (fillByOrder.get(o.id)?.kg ?? 0), 0);
          const revenue = orders.reduce((a, o) => a + (fillByOrder.get(o.id)?.revenue ?? 0), 0);
          const rate = demand > 0 ? sold / demand : 1;
          return (
            <div key={customer.id} className="rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 px-3 py-2">
                <Dot color={customer.color} />
                <span className="text-sm font-semibold">{customer.name}</span>
                <span className="rounded-full bg-white/5 px-1.5 text-[10px] text-mist-300">{customer.kind}</span>
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className="num text-mist-300">{money(revenue)}</span>
                  <FillPill rate={rate} />
                </span>
              </div>
              <div className="flex flex-col gap-1 px-3 pb-2">
                {orders.map((o) => {
                  const f = fillByOrder.get(o.id);
                  const filled = f?.kg ?? 0;
                  const rate = o.kg > 0 ? filled / o.kg : 1;
                  return (
                    <div key={o.id} className="grid grid-cols-[1fr_72px_72px_90px_20px] items-center gap-x-2">
                      <span className="flex items-center gap-1.5 truncate text-sm">
                        <span className="size-2 rounded-sm" style={{ background: PART_BY_ID[o.part].color }} />
                        {PART_BY_ID[o.part].name}
                        {f && f.frozenKg > 0 && (
                          <span className="text-[10px] text-sky-200" title={`${kg(f.frozenKg)} filled from frozen stock at −20%`}>
                            ❄
                          </span>
                        )}
                      </span>
                      <NumberField value={o.kg} step={10} onChange={(v) => dispatch({ type: "setOrder", week: index, id: o.id, patch: { kg: v } })} />
                      <NumberField value={o.price} step={0.5} onChange={(v) => dispatch({ type: "setOrder", week: index, id: o.id, patch: { price: v } })} />
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="num text-xs">
                          {kg(filled, false)} <span className="text-mist-500">/ {kg(o.kg, false)}</span>
                        </span>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full ${rate >= 0.999 ? "bg-kelp-400" : rate > 0 ? "bg-sun-400" : "bg-coral-400"}`} style={{ width: `${Math.min(100, rate * 100)}%` }} />
                        </div>
                      </div>
                      <button
                        className="text-mist-500 hover:text-coral-400"
                        title="Remove order"
                        onClick={() => dispatch({ type: "removeOrder", week: index, id: o.id })}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between px-4 text-xs text-mist-300">
        <span>
          Demand <span className="num text-mist-100">{kg(result.demandKg)}</span> · Sold <span className="num text-mist-100">{kg(result.soldKg)}</span>
        </span>
        <span>
          Revenue <span className="num font-semibold text-mist-100">{money(result.revenue)}</span>
        </span>
      </div>
    </Panel>
  );
}

function FillPill({ rate }: { rate: number }) {
  const tone = rate >= 0.999 ? "bg-kelp-400/15 text-kelp-400" : rate >= 0.6 ? "bg-sun-400/15 text-sun-400" : "bg-coral-400/15 text-coral-400";
  return <span className={`num rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>{pct(rate)}</span>;
}
