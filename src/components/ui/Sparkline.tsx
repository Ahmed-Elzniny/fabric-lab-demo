// src/components/ui/Sparkline.tsx
"use client";

// رسم مصغّر للاتجاه: خط 2px + مساحة خفيفة + نقطة مميزة على آخر قيمة.
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { useId } from "react";

interface SparklineProps {
  data: number[];
  color: string;
  label: string;
}

export function Sparkline({ data, color, label }: SparklineProps) {
  const id = useId().replace(/:/g, "");
  const points = data.map((v, i) => ({ i, v }));
  const lastIndex = points.length - 1;
  return (
    <div className="kpi__spark" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 2, left: 6 }}>
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, "dataMax"]} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#sp-${id})`}
            isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === lastIndex && p.cx !== undefined && p.cy !== undefined ? (
                <circle key="last" cx={p.cx} cy={p.cy} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
              ) : (
                <g key={`d-${p.index}`} />
              )
            }
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
