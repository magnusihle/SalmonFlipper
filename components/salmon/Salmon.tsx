"use client";

import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";
import { BODY_PATH, FINS, PORTION_LINES, REGIONS, VIEW_H, VIEW_W, type FishPart, type RegionDef } from "./geometry";

const FIN_PARENT: FishPart[] = ["fillet", "fillet", "collar", "belly"];

interface Props {
  fillFor: (part: FishPart) => string;
  explode?: number;
  portionShare?: number;
  hovered?: FishPart | null;
  onHover?: (part: FishPart | null) => void;
  onSelect?: (part: FishPart) => void;
  renderLabel?: (region: RegionDef) => ReactNode;
  skinColor?: string;
  className?: string;
  pad?: number;
}

const spring = { type: "spring", stiffness: 70, damping: 16 } as const;

export function Salmon({
  fillFor,
  explode = 0,
  portionShare = 0,
  hovered = null,
  onHover,
  onSelect,
  renderLabel,
  skinColor = "#c7d6e5",
  className,
  pad = 0,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `${uid}-body`;
  const interactive = Boolean(onHover || onSelect);

  const offset = (r: RegionDef) => ({ x: r.explode[0] * explode, y: r.explode[1] * explode });

  return (
    <svg viewBox={`${-pad} ${-pad} ${VIEW_W + pad * 2} ${VIEW_H + pad * 2}`} className={className} role="img" aria-label="Salmon cut diagram">
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {FINS.map((d, i) => {
        const parent = REGIONS.find((r) => r.id === FIN_PARENT[i])!;
        return (
          <motion.path
            key={d}
            d={d}
            fill={fillFor(parent.id)}
            opacity={0.75}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={1.5}
            animate={offset(parent)}
            transition={spring}
          />
        );
      })}

      {REGIONS.map((r) => {
        const isHover = hovered === r.id;
        return (
          <motion.g
            key={r.id}
            animate={offset(r)}
            transition={spring}
            style={{ cursor: interactive ? "pointer" : "default" }}
            onMouseEnter={() => onHover?.(r.id)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(r.id)}
          >
            <g clipPath={`url(#${clipId})`}>
              <path d={r.path} fill={fillFor(r.id)} />
              <path d={r.path} fill={`url(#${uid}-sheen)`} style={{ pointerEvents: "none" }} />
              {r.id === "fillet" && portionShare > 0 && (
                <g stroke="rgba(10,20,32,0.7)" strokeWidth={2} strokeDasharray="6 5" opacity={0.25 + portionShare * 0.75}>
                  {PORTION_LINES.map((x) => (
                    <line key={x} x1={x} y1={56} x2={x} y2={196} />
                  ))}
                </g>
              )}
              {r.id === "frame" && (
                <g stroke="rgba(10,20,32,0.55)" strokeWidth={2} strokeLinecap="round">
                  {Array.from({ length: 10 }, (_, i) => 240 + i * 38).map((x) => (
                    <line key={x} x1={x} y1={160} x2={x + 10} y2={214} />
                  ))}
                </g>
              )}
              <path
                d={r.path}
                fill="none"
                stroke={isHover ? "#ffffff" : "rgba(6,13,22,0.55)"}
                strokeWidth={isHover ? 3.5 : 2}
                style={{ pointerEvents: "none" }}
              />
            </g>
            {r.id === "head" && (
              <g style={{ pointerEvents: "none" }}>
                <circle cx={78} cy={140} r={9.5} fill="#f8fafc" />
                <circle cx={80} cy={140} r={4.8} fill="#0b1220" />
                <circle cx={76.5} cy={137} r={2} fill="#ffffff" />
                <path d="M 30 160 Q 62 178 100 173" fill="none" stroke="#0b1220" strokeWidth={2.5} opacity={0.55} />
              </g>
            )}
            {renderLabel && <g style={{ pointerEvents: "none" }}>{renderLabel(r)}</g>}
          </motion.g>
        );
      })}

      <motion.path
        d={BODY_PATH}
        fill="none"
        stroke={skinColor}
        strokeWidth={3}
        strokeDasharray={explode > 0.05 ? "8 8" : "0"}
        animate={{ opacity: 1 - explode * 0.65 }}
        transition={spring}
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}
