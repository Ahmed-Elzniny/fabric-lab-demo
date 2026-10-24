// src/features/dashboard/SalesTrendCard.tsx
"use client";

// المبيعات عبر الزمن مقسمة حسب المخزن (أعمدة متراكمة).
// المحور الزمني ماشي من اليمين للشمال (الأقدم يمين) عشان يناسب القراءة العربي.
import { ChartColumnStacked } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import type { TrendPoint, WarehouseFilter } from "@/data/selectors";
import { fmtAxis, fmtDayMonth, fmtMoney, fmtMoneyShort, fmtWeekday } from "@/lib/format";
import type { ChartColors } from "@/lib/useThemeColors";

interface Props {
  points: TrendPoint[];
  warehouse: WarehouseFilter;
  colors: ChartColors;
  weekly: boolean;
  subtitle: string;
}

interface TipProps {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  showK: boolean;
  showM: boolean;
  colors: ChartColors;
  weekly: boolean;
}

function SalesTooltip({ active, payload, showK, showM, colors, weekly }: TipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const total = (showK ? p.kerdasa : 0) + (showM ? p.mahalla : 0);
  return (
    <div className="tooltip">
      <div className="tooltip__title">
        {weekly ? `أسبوع ${fmtDayMonth(p.from)} – ${fmtDayMonth(p.to)}` : `${fmtWeekday(p.to)} ${fmtDayMonth(p.to)}`}
      </div>
      {showK && (
        <div className="tooltip__row">
          <span className="wh-dot" style={{ background: colors.kerdasa }} />
          <span>كرداسة</span>
          <b>{fmtMoney(p.kerdasa)}</b>
        </div>
      )}
      {showM && (
        <div className="tooltip__row">
          <span className="wh-dot" style={{ background: colors.mahalla }} />
          <span>المحلة</span>
          <b>{fmtMoney(p.mahalla)}</b>
        </div>
      )}
      {showK && showM && (
        <div className="tooltip__row tooltip__total">
          <span />
          <span>الإجمالي</span>
          <b>{fmtMoney(total)}</b>
        </div>
      )}
    </div>
  );
}

export function SalesTrendCard({ points, warehouse, colors, weekly, subtitle }: Props) {
  const showK = warehouse !== "mahalla";
  const showM = warehouse !== "kerdasa";
  const totalK = points.reduce((s, p) => s + p.kerdasa, 0);
  const totalM = points.reduce((s, p) => s + p.mahalla, 0);

  return (
    <Card
      className="span-8"
      icon={<ChartColumnStacked size={17} />}
      title="المبيعات حسب المخزن"
      subtitle={subtitle}
      actions={
        <div className="legend" aria-label="مفتاح الرسم">
          {showK && (
            <span className="legend__item">
              <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" />
              كرداسة <b>{fmtMoneyShort(totalK)}</b>
            </span>
          )}
          {showM && (
            <span className="legend__item">
              <span className="wh-dot wh-dot--mahalla" aria-hidden="true" />
              المحلة <b>{fmtMoneyShort(totalM)}</b>
            </span>
          )}
        </div>
      }
    >
      <div className="chart-box" role="img" aria-label={`رسم أعمدة للمبيعات ${weekly ? "الأسبوعية" : "اليومية"} حسب المخزن`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={colors.line} strokeDasharray="3 4" />
            <XAxis
              dataKey="key"
              reversed
              tickLine={false}
              axisLine={{ stroke: colors.line }}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fill: colors.fg3, fontSize: 11 }}
              tickFormatter={(v: string) => fmtDayMonth(v)}
              height={28}
            />
            <YAxis
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.fg3, fontSize: 11 }}
              tickFormatter={(v: number) => fmtAxis(v)}
              width={48}
            />
            <Tooltip
              cursor={{ fill: colors.line, opacity: 0.45 }}
              content={<SalesTooltip showK={showK} showM={showM} colors={colors} weekly={weekly} />}
              isAnimationActive={false}
            />
            {showK && (
              <Bar
                dataKey="kerdasa"
                stackId="s"
                fill={colors.kerdasa}
                stroke={colors.surface}
                strokeWidth={showM ? 1 : 0}
                radius={showM ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            )}
            {showM && (
              <Bar
                dataKey="mahalla"
                stackId="s"
                fill={colors.mahalla}
                stroke={colors.surface}
                strokeWidth={showK ? 1 : 0}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
