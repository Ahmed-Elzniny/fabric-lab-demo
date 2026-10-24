// src/features/dashboard/KpiRow.tsx
"use client";

import { Banknote, HandCoins, Lock, Scale, TrendingUp, Truck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { DeltaChip } from "@/components/ui/DeltaChip";
import { RollIcon } from "@/components/ui/RollIcon";
import { Sparkline } from "@/components/ui/Sparkline";
import type { CashBoxSummary, DashboardKpis } from "@/data/selectors";
import { fmtInt, fmtMoneyShort, fmtPct } from "@/lib/format";
import type { ChartColors } from "@/lib/useThemeColors";

interface KpiProps {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  hero?: boolean;
  children?: ReactNode;
}

function KpiCard({ label, icon, value, meta, hero, children }: KpiProps) {
  return (
    <article className={`card kpi ${hero ? "kpi--hero" : ""}`}>
      <div className="kpi__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="kpi__value">{value}</div>
      {meta && <div className="kpi__meta">{meta}</div>}
      {children}
    </article>
  );
}

function Money({ n }: { n: number }) {
  const s = fmtMoneyShort(n, false);
  return (
    <>
      {s}
      <small>ج.م</small>
    </>
  );
}

interface KpiRowProps {
  kpis: DashboardKpis;
  boxes: CashBoxSummary[];
  colors: ChartColors;
  seeProfit: boolean;
  periodLabel: string;
}

export function KpiRow({ kpis, boxes, colors, seeProfit, periodLabel }: KpiRowProps) {
  const maxBox = Math.max(1, ...boxes.map((b) => b.balance));
  return (
    <section className="kpis" aria-label="المؤشرات الرئيسية">
      <KpiCard
        hero
        label={`المبيعات · ${periodLabel}`}
        icon={<TrendingUp size={16} />}
        value={<Money n={kpis.sales.value} />}
        meta={<DeltaChip delta={kpis.sales.delta} />}
      >
        <Sparkline data={kpis.sales.spark} color={colors.spark} label="اتجاه المبيعات اليومية" />
      </KpiCard>

      {seeProfit ? (
        <KpiCard
          label="مجمل الربح"
          icon={<Scale size={16} />}
          value={<Money n={kpis.grossProfit.value} />}
          meta={
            <>
              <span className="chip chip--info num">هامش {fmtPct(kpis.grossProfit.margin).replace("+", "")}</span>
              <DeltaChip delta={kpis.grossProfit.delta} suffix="" />
            </>
          }
        >
          <Sparkline data={kpis.grossProfit.spark} color={colors.spark} label="اتجاه مجمل الربح" />
        </KpiCard>
      ) : (
        <KpiCard
          label="مجمل الربح"
          icon={<Lock size={16} />}
          value={<span style={{ color: "var(--fg-3)", fontSize: 18 }}>مخفي</span>}
          meta={<span>الأرباح بتظهر للمالك بس</span>}
        />
      )}

      <KpiCard
        label="التحصيلات (نقدي + آجل)"
        icon={<HandCoins size={16} />}
        value={<Money n={kpis.collections.value} />}
        meta={<DeltaChip delta={kpis.collections.delta} />}
      >
        <Sparkline data={kpis.collections.spark} color={colors.spark} label="اتجاه التحصيلات اليومية" />
      </KpiCard>

      <KpiCard
        label="مستحقات على العملاء"
        icon={<Banknote size={16} />}
        value={<Money n={kpis.receivables.value} />}
        meta={
          <>
            <span className="num">{fmtInt(kpis.receivables.customers)} عميل عليهم آجل</span>
            {kpis.receivables.overLimit > 0 && (
              <span className="chip chip--warn num">{kpis.receivables.overLimit} فوق الحد</span>
            )}
          </>
        }
      />

      <KpiCard label="رصيد الخزن" icon={<Wallet size={16} />} value={<Money n={kpis.cashTotal} />}>
        <div className="kpi__split">
          {boxes.map((b) => (
            <div className="kpi__split-row" key={b.warehouseId}>
              <span>
                <span className={`wh-dot wh-dot--${b.warehouseId}`} aria-hidden="true" />{" "}
                {b.warehouseId === "kerdasa" ? "كرداسة" : "المحلة"}
              </span>
              <span className="bar-track" aria-hidden="true">
                <span
                  className="bar-fill"
                  style={{
                    display: "block",
                    width: `${(b.balance / maxBox) * 100}%`,
                    background: b.warehouseId === "kerdasa" ? colors.kerdasa : colors.mahalla,
                  }}
                />
              </span>
              <span className="num">{fmtMoneyShort(b.balance, false)}</span>
            </div>
          ))}
        </div>
      </KpiCard>

      <KpiCard
        label="المخزون الحالي"
        icon={<RollIcon size={16} />}
        value={
          <>
            {fmtInt(kpis.stock.rolls)}
            <small>توب</small>
          </>
        }
        meta={
          <span className="num">
            {fmtInt(kpis.stock.meters)} متر · {fmtInt(kpis.stock.kilos)} كيلو
          </span>
        }
      >
        <div className="kpi__meta">
          <span className="num">قيمته {fmtMoneyShort(kpis.stock.value)}</span>
          {kpis.stock.inTransit > 0 && (
            <span className="chip chip--info num">
              <Truck size={12} aria-hidden="true" />
              {kpis.stock.inTransit} في الطريق
            </span>
          )}
        </div>
      </KpiCard>
    </section>
  );
}
