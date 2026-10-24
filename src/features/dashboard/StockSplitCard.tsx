// src/features/dashboard/StockSplitCard.tsx
"use client";

import { Snowflake, Sun, Warehouse } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import type { StockSplit, WarehouseFilter } from "@/data/selectors";
import { fmtInt, fmtMoney, fmtMoneyShort } from "@/lib/format";
import type { ChartColors } from "@/lib/useThemeColors";

const NAME = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

interface Props {
  split: StockSplit[];
  warehouse: WarehouseFilter;
  colors: ChartColors;
}

export function StockSplitCard({ split, warehouse, colors }: Props) {
  const rows = split.filter((s) => warehouse === "all" || s.warehouseId === warehouse);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const totalRolls = rows.reduce((s, r) => s + r.rolls, 0);
  const color = (id: StockSplit["warehouseId"]) => (id === "kerdasa" ? colors.kerdasa : colors.mahalla);

  return (
    <Card className="span-4" icon={<Warehouse size={17} />} title="توزيع المخزون" subtitle="القيمة بسعر التكلفة">
      <div className="donut-wrap">
        <div className="donut" role="img" aria-label="رسم دائري لتوزيع قيمة المخزون بين المخزنين">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="warehouseId"
                innerRadius="68%"
                outerRadius="94%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={rows.length > 1 ? 2 : 0}
                stroke={colors.surface}
                strokeWidth={2}
                cornerRadius={4}
                isAnimationActive={false}
              >
                {rows.map((r) => (
                  <Cell key={r.warehouseId} fill={color(r.warehouseId)} />
                ))}
              </Pie>
              <Tooltip
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as StockSplit | undefined;
                  if (!active || !r) return null;
                  return (
                    <div className="tooltip">
                      <div className="tooltip__title">مخزن {NAME[r.warehouseId]}</div>
                      <div className="tooltip__row">
                        <span className="wh-dot" style={{ background: color(r.warehouseId) }} />
                        <span>القيمة</span>
                        <b>{fmtMoney(r.value)}</b>
                      </div>
                      <div className="tooltip__row">
                        <span />
                        <span>عدد التواب</span>
                        <b>{fmtInt(r.rolls)}</b>
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut__center">
            <strong>{fmtMoneyShort(total, false)}</strong>
            <span className="num">ج.م · {fmtInt(totalRolls)} توب</span>
          </div>
        </div>

        <ul className="split-list">
          {rows.map((r) => (
            <li key={r.warehouseId}>
              <span className={`wh-dot wh-dot--${r.warehouseId}`} aria-hidden="true" />
              <span className="split-list__name">
                مخزن {NAME[r.warehouseId]}{" "}
                {total > 0 && rows.length > 1 && (
                  <span className="chip chip--flat num">{Math.round((r.value / total) * 100)}٪</span>
                )}
              </span>
              <span className="split-list__value">{fmtMoneyShort(r.value)}</span>
              <span className="split-list__sub num">
                <span>{fmtInt(r.rolls)} توب</span>
                <span className="season-pill">
                  <Snowflake size={12} aria-hidden="true" /> شتوي {fmtMoneyShort(r.winterValue, false)}
                </span>
                <span className="season-pill">
                  <Sun size={12} aria-hidden="true" /> صيفي {fmtMoneyShort(r.summerValue, false)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
