import React from "react";
import Svg, { Circle, Line, Path, Polygon, Rect } from "react-native-svg";
import type { HabitIconName } from "../domain/presets";
import type { DisplayOutcome } from "../domain/types";
import { colors } from "../theme";

interface IconProps {
  size?: number;
  color?: string;
}

const stroke = { strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

export function HabitIcon({ name, size = 22, color = colors.green }: IconProps & { name: HabitIconName }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      {name === "phone" && (
        <>
          <Rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <Line x1="11" y1="18.5" x2="13" y2="18.5" />
        </>
      )}
      {name === "glass" && <Path d="M7 3h10l-1 7a4 4 0 0 1-8 0L7 3zM12 14v7M8.5 21h7" />}
      {name === "smoke" && (
        <>
          <Rect x="3" y="14" width="14" height="4" rx="1" />
          <Line x1="20" y1="14" x2="20" y2="18" />
          <Path d="M17 10c0-2 2-2 2-4M13 10c0-2 2-2 2-4" />
        </>
      )}
      {name === "wave" && <Path d="M2 9c3-4 5 4 8 0s5 4 8 0 3 0 4-1M2 16c3-4 5 4 8 0s5 4 8 0 3 0 4-1" />}
      {name === "run" && (
        <>
          <Circle cx="14.5" cy="4.5" r="1.8" />
          <Path d="M9 21l3-6-3-3 2-5 4 2 3 3M12 15l4 1.5M7 11l2-3" />
        </>
      )}
      {name === "moon" && <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
      {name === "leaf" && <Path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8" />}
      {name === "book" && <Path d="M3 5.5C6 4 9 4 12 6c3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5V5.5zM12 6v13.5" />}
      {name === "spark" && <Path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" />}
    </Svg>
  );
}

export type TabIconName = "today" | "journey" | "habits" | "settings";

export function TabIcon({ name, size = 24, color = colors.textMuted }: IconProps & { name: TabIconName }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      {name === "today" && (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M8 12.5l3 3 5-6" />
        </>
      )}
      {name === "journey" && <Path d="M3 18h4v-4h4v-4h4V6h6" />}
      {name === "habits" && <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />}
      {name === "settings" && <Path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />}
    </Svg>
  );
}

/** Shape + color, so outcomes never rely on color alone: up arrow, down arrow, flat dash. */
export function OutcomeGlyph({ outcome, size = 14 }: { outcome: DisplayOutcome; size?: number }) {
  if (outcome === "good") {
    return (
      <Svg width={size} height={size} viewBox="0 0 14 14">
        <Polygon points="7,2 12,10 2,10" fill={colors.greenStrong} />
      </Svg>
    );
  }
  if (outcome === "slip") {
    return (
      <Svg width={size} height={size} viewBox="0 0 14 14">
        <Polygon points="7,12 12,4 2,4" fill={colors.slip} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Rect x="2" y="6" width="10" height="2.4" rx="1.2" fill={colors.neutral} />
    </Svg>
  );
}

export function LeafMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={colors.green} {...stroke}>
      <Path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8" />
    </Svg>
  );
}

export function ChevronLeft({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRight({ size = 18, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  );
}
