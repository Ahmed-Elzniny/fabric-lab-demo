// src/lib/useThemeColors.ts
"use client";

// Recharts بيرسم SVG بألوان صريحة، فبنقرا ألوان الثيم من متغيرات CSS ونعيد قراءتها لما الثيم يتغير.
import { useEffect, useState } from "react";
import { useDemo } from "@/store/DemoProvider";

export interface ChartColors {
  kerdasa: string;
  mahalla: string;
  fg: string;
  fg2: string;
  fg3: string;
  line: string;
  surface: string;
  spark: string;
  teal: string;
  crit: string;
  warn: string;
}

const FALLBACK: ChartColors = {
  kerdasa: "#0FA47F",
  mahalla: "#3B6FC4",
  fg: "#0E1726",
  fg2: "#4A5568",
  fg3: "#5F6B7D",
  line: "#E2E8F0",
  surface: "#FFFFFF",
  spark: "#1E2E48",
  teal: "#0FA47F",
  crit: "#DC2626",
  warn: "#B7791F",
};

const VARS: Record<keyof ChartColors, string> = {
  kerdasa: "--wh-kerdasa",
  mahalla: "--wh-mahalla",
  fg: "--fg",
  fg2: "--fg-2",
  fg3: "--fg-3",
  line: "--line",
  surface: "--surface",
  spark: "--spark",
  teal: "--teal",
  crit: "--crit",
  warn: "--warn",
};

export function useThemeColors(): ChartColors {
  const { themeVersion } = useDemo();
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next = { ...FALLBACK };
    (Object.keys(VARS) as (keyof ChartColors)[]).forEach((k) => {
      const v = style.getPropertyValue(VARS[k]).trim();
      if (v) next[k] = v;
    });
    setColors(next);
  }, [themeVersion]);

  return colors;
}
