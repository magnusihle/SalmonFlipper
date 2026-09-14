import type { PartId } from "@/lib/types";

export const VIEW_W = 800;
export const VIEW_H = 320;

export const BODY_PATH =
  "M 30 160 C 80 90, 200 55, 330 55 C 450 55, 580 95, 640 125 L 700 62 Q 745 48, 772 70 L 738 160 L 772 250 Q 745 272, 700 258 L 640 195 C 580 225, 450 265, 330 265 C 200 265, 80 230, 30 160 Z";

export const GILL_PATH = "M 172 68 Q 228 160 166 252";

export type FishPart = Exclude<PartId, "hog" | "skin">;

export interface RegionDef {
  id: FishPart;
  path: string;
  label: [number, number];
  explode: [number, number];
  yieldLabel: string;
}

export const REGIONS: RegionDef[] = [
  {
    id: "fillet",
    path: "M 172 0 Q 228 160 166 320 L 632 320 L 632 0 Z",
    label: [420, 118],
    explode: [0, -80],
    yieldLabel: "58%",
  },
  {
    id: "belly",
    path: "M 206 195 L 560 195 L 560 320 L 200 320 Z",
    label: [380, 236],
    explode: [0, 85],
    yieldLabel: "6%",
  },
  {
    id: "collar",
    path: "M 195 160 Q 194 206 166 260 L 166 320 L 206 320 L 206 260 Q 234 206 235 160 Z",
    label: [212, 208],
    explode: [-20, 95],
    yieldLabel: "4%",
  },
  {
    id: "head",
    path: "M 0 0 L 172 0 Q 228 160 166 320 L 0 320 Z",
    label: [100, 168],
    explode: [-80, 0],
    yieldLabel: "9%",
  },
  {
    id: "trim",
    path: "M 632 0 L 800 0 L 800 320 L 632 320 Z",
    label: [690, 160],
    explode: [80, 0],
    yieldLabel: "4–12%",
  },
  {
    id: "frame",
    path: "M 206 150 L 632 154 L 632 166 L 206 170 Z",
    label: [500, 182],
    explode: [0, 0],
    yieldLabel: "12%",
  },
];

export const FINS = [
  "M 300 58 Q 340 8 425 40 L 432 62 Z",
  "M 520 84 Q 545 60 562 86 Z",
  "M 205 212 Q 245 245 280 232 L 220 200 Z",
  "M 470 254 Q 505 288 545 256 Z",
];

export const PORTION_LINES = [262, 328, 394, 460, 526, 590];
