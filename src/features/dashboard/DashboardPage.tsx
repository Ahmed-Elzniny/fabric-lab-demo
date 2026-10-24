// src/features/dashboard/DashboardPage.tsx
"use client";

import { Lock } from "lucide-react";
import { useMemo } from "react";
import {
  assortmentReadiness,
  buildAlerts,
  cashBoxes,
  computeKpis,
  payrollSummary,
  recentInvoices,
  salesTrend,
  stockSplit,
  topDebtors,
  topItems,
  transfersOverview,
  PERIOD_LABEL,
} from "@/data/selectors";
import { useThemeColors } from "@/lib/useThemeColors";
import { useDemo } from "@/store/DemoProvider";
import { RoleGuard } from "./guards";
import { AlertsCard } from "./AlertsCard";
import { AssortmentCard } from "./AssortmentCard";
import { InvoicesCard, TransfersCard } from "./ActivityCards";
import { KpiRow } from "./KpiRow";
import { CashBoxesCard, DebtorsCard } from "./MoneyCards";
import { PayrollCard } from "./PayrollCard";
import { SalesTrendCard } from "./SalesTrendCard";
import { StockSplitCard } from "./StockSplitCard";
import { TopItemsCard } from "./TopItemsCard";
import { WelcomeBand } from "./WelcomeBand";

export function DashboardPage({ alertsRef }: { alertsRef: React.RefObject<HTMLDivElement | null> }) {
  const { ds, ix, warehouse, period, role, can, setView, openInvoice, openCustomer } = useDemo();
  const colors = useThemeColors();
  const periodLabel = PERIOD_LABEL[period];

  const data = useMemo(() => {
    const kpis = computeKpis(ds, ix, warehouse, period);
    const todayKpis = computeKpis(ds, ix, warehouse, "today");
    return {
      kpis,
      todayKpis,
      boxes: cashBoxes(ds, warehouse, period),
      trend: salesTrend(ds, period),
      split: stockSplit(ds, ix),
      items: topItems(ds, ix, warehouse, period),
      assortment: {
        kerdasa: assortmentReadiness(ds, ix, "kerdasa"),
        mahalla: assortmentReadiness(ds, ix, "mahalla"),
      },
      alerts: buildAlerts(ds, ix, warehouse).filter((a) => can.seeProfit || a.kind !== "advance_high"),
      debtors: topDebtors(ds, warehouse),
      invoices: recentInvoices(ds, ix, warehouse),
      transfers: transfersOverview(ds, ix, warehouse),
      payroll: payrollSummary(ds, warehouse, period),
    };
  }, [ds, ix, warehouse, period, can.seeProfit]);

  const trendSubtitle =
    period === "today"
      ? "آخر 14 يوم شغل (الجمعة إجازة)"
      : period === "90d"
        ? "آخر 90 يوم · بالأسبوع"
        : `${periodLabel} · باليوم (الجمعة إجازة)`;

  return (
    <>
      <WelcomeBand
        today={ds.today}
        role={role}
        invoicesToday={data.todayKpis.invoiceCount}
        rollsToday={data.todayKpis.rollsSold}
        inTransit={data.transfers.inTransit.length}
        urgent={data.alerts.filter((a) => a.severity === "critical").length}
        go={setView}
      />

      <KpiRow kpis={data.kpis} boxes={data.boxes} colors={colors} seeProfit={can.seeProfit} periodLabel={periodLabel} />

      <div className="grid">
        <SalesTrendCard
          points={data.trend}
          warehouse={warehouse}
          colors={colors}
          weekly={period === "90d"}
          subtitle={trendSubtitle}
        />
        <StockSplitCard split={data.split} warehouse={warehouse} colors={colors} />
      </div>

      <div className="grid">
        <AssortmentCard
          byWarehouse={data.assortment}
          initial={warehouse === "mahalla" ? "mahalla" : "kerdasa"}
          lockedTo={warehouse === "all" ? undefined : warehouse}
        />
        <AlertsCard ref={alertsRef} alerts={data.alerts} />
      </div>

      <div className="grid grid--pair">
        <TopItemsCard items={data.items} warehouse={warehouse} colors={colors} subtitle={`${periodLabel} · بالقيمة`} />
        <DebtorsCard debtors={data.debtors} colors={colors} onOpen={() => setView("customers")} onRow={openCustomer} />
        <CashBoxesCard boxes={data.boxes} periodLabel={periodLabel} />
      </div>

      <div className="grid">
        <InvoicesCard rows={data.invoices} today={ds.today} onOpen={() => setView("sales")} onRow={openInvoice} />
        <TransfersCard inTransit={data.transfers.inTransit} recent={data.transfers.recent} onOpen={() => setView("transfers")} />
      </div>

      <RoleGuard
        allowed={can.seeProfit}
        locked={
          <div className="locked-note">
            <Lock size={16} aria-hidden="true" />
            حسابات العمالة والمرتبات والسلف بتظهر للمالك بس. بدّل المستخدم من القائمة الجانبية عشان تشوفها.
          </div>
        }
      >
        <div className="grid">
          <PayrollCard summary={data.payroll} today={ds.today} periodLabel={periodLabel} onOpen={() => setView("workforce")} />
        </div>
      </RoleGuard>
    </>
  );
}
