import { CURRENCY } from "./data";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function kg(n: number, unit = true) {
  const s = Math.abs(n) >= 100 ? intFmt.format(n) : oneFmt.format(n);
  return unit ? `${s} kg` : s;
}

export function money(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${CURRENCY}${oneFmt.format(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}${CURRENCY}${oneFmt.format(abs / 1000)}k`;
  return `${sign}${CURRENCY}${intFmt.format(abs)}`;
}

export function price(n: number) {
  return `${CURRENCY}${n.toFixed(2)}/kg`;
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function int(n: number) {
  return intFmt.format(n);
}
