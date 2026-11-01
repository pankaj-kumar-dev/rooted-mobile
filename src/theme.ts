import { Platform } from "react-native";

/** Dark forest palette. Values mirror the web tokens (rooted/src/styles/tokens.css). */
export const colors = {
  bg: "#07100b",
  bgElevated: "#0d1710",
  surface: "#101d14",
  surfaceRaised: "#16241a",
  border: "rgba(190, 218, 177, 0.16)",
  borderStrong: "rgba(190, 218, 177, 0.32)",
  text: "#f0f2e9",
  textMuted: "#a9b5a5",
  green: "#b9dda0",
  greenStrong: "#76bd68",
  greenDeep: "#285b35",
  slip: "#df7864",
  slipDeep: "#743b32",
  neutral: "#8f998b",
  focus: "#e2f5c8",
  onGreen: "#0a1a0f",
  // chart tokens (used from Phase 3)
  chartBg: "#0a1710",
  chartLine: "#a6e889",
  chartSlip: "#f17d6d",
  chartFlat: "#929a90",
  chartGrid: "rgba(150, 190, 150, 0.1)",
  chartAxis: "#7f8d7c",
  overlay: "rgba(3, 8, 5, 0.72)",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const fonts = {
  display: Platform.select({ ios: "Georgia", default: "serif" }) as string,
  ui: undefined as string | undefined, // system sans (Roboto on Android, SF on iOS)
};

/** Minimum touch target (dp). */
export const TOUCH = 48;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  small: { fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const, letterSpacing: 1.4, color: colors.green },
};
