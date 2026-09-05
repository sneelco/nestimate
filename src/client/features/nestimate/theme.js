import { createContext, useContext } from "react";

export const THEMES = {
  light: {
    name: "light",
    bg: "#f4f6f7", card: "#ffffff", sub: "#fbfcfd",
    ink: "#182430", mute: "#5c6b78", line: "#dde3e8",
    accent: "#0f6b66", accentSoft: "#e7f2f1", danger: "#b8336a", dangerLine: "#e7b4c7",
    shadow: "0 2px 8px rgba(24,36,48,.08)",
    palette: ["#0f6b66", "#5b5bd6", "#b45309", "#b8336a", "#3b7dd8", "#64748b", "#7c3aed", "#0e7490"],
  },
  dark: {
    name: "dark",
    bg: "#10161c", card: "#1a222b", sub: "#151d25",
    ink: "#e8edf2", mute: "#93a2b0", line: "#2b3642",
    accent: "#3ec3b7", accentSoft: "#12332f", danger: "#ef7ba6", dangerLine: "#5a2c40",
    shadow: "0 2px 10px rgba(0,0,0,.4)",
    palette: ["#3ec3b7", "#8a8af0", "#e0913a", "#ef7ba6", "#6ba3ec", "#93a2b0", "#a78bfa", "#3fb3cf"],
  },
};

export const ThemeCtx = createContext(THEMES.light);
export const useT = () => useContext(ThemeCtx);

export function systemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
