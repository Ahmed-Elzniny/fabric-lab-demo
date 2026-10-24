// src/features/dashboard/TopItemsCard.tsx
"use client";

import { Award } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import type { ItemSales, WarehouseFilter } from "@/data/selectors";
import { fmtAxis, fmtInt, fmtMoney, fmtUnit } from "@/lib/format";
import type { ChartColors } from "@/lib/useThemeColors";

interface Props {
  items: ItemSales[];
  warehouse: WarehouseFilter;
  colors: ChartColors;
  subtitle: string;
}

export function TopItemsCard({ items, warehouse, colors, subtitle }: Props) {
  const showK = warehouse !== "mahalla";
  const showM = warehouse !== "kerdasa";

  return (
    <Card className="span-4" bodyClassName="card__body--chart" icon={<Award size={17} />} title="أكتر الأصناف مبيعاً" subtitle={subtitle}>
      {items.length === 0 ? (
        <p style={{ color: "var(--fg-3)", margin: "24px 0" }}>مفيش مبيعات في الفترة دي.</p>
      ) : (
        <div className="chart-box chart-box--sm" role="img" aria-label="رسم أعمدة أفقية لأكتر الأصناف مبيعاً">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 4 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={colors.line} strokeDasharray="3 4" />
              <XAxis
                type="number"
                reversed
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.fg3, fontSize: 11 }}
                tickFormatter={(v: number) => fmtAxis(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={96}
                tick={{ fill: colors.fg, fontSize: 12.5, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{ fill: colors.line, opacity: 0.45 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as ItemSales | undefined;
                  if (!active || !r) return null;
                  return (
                    <div className="tooltip">
                      <div className="tooltip__title">{r.name}</div>
                      {showK && (
                        <div className="tooltip__row">
                          <span className="wh-dot" style={{ background: colors.kerdasa }} />
                          <span>كرداسة</span>
                          <b>{fmtMoney(r.kerdasa)}</b>
                        </div>
                      )}
                      {showM && (
                        <div className="tooltip__row">
                          <span className="wh-dot" style={{ background: colors.mahalla }} />
                          <span>المحلة</span>
                          <b>{fmtMoney(r.mahalla)}</b>
                        </div>
                      )}
                      <div className="tooltip__row tooltip__total">
                        <span />
                        <span>
                          {fmtInt(r.rolls)} توب · {fmtUnit(r.unit, Math.round(r.quantity))}
                        </span>
                        <b>{fmtMoney(r.total)}</b>
                      </div>
                    </div>
                  );
                }}
              />
              {showK && (
                <Bar
                  dataKey="kerdasa"
                  stackId="i"
                  fill={colors.kerdasa}
                  stroke={colors.surface}
                  strokeWidth={showM ? 1 : 0}
                  radius={showM ? [0, 0, 0, 0] : [4, 0, 0, 4]}
                  isAnimationActive={false}
                />
              )}
              {showM && (
                <Bar
                  dataKey="mahalla"
                  stackId="i"
                  fill={colors.mahalla}
                  stroke={colors.surface}
                  strokeWidth={showK ? 1 : 0}
                  radius={[4, 0, 0, 4]}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
