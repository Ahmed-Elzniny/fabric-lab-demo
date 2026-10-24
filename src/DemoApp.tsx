// src/DemoApp.tsx
"use client";

// نقطة الدخول للديمو: هيكل الشاشة (سايدبار + شريط علوي) والتنقل بين الشاشات.
import { useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { buildAlerts } from "@/data/selectors";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ComingSoon, VIEW_META } from "@/features/placeholder/ComingSoon";
import { CustomerDrawer } from "@/features/customers/CustomerDrawer";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { LotDrawer } from "@/features/inventory/LotDrawer";
import { InvoiceDrawer } from "@/features/sales/InvoiceDrawer";
import { NewInvoicePage } from "@/features/sales/NewInvoicePage";
import { SalesListPage } from "@/features/sales/SalesListPage";
import { NewTransferPage } from "@/features/transfers/NewTransferPage";
import { TransfersPage } from "@/features/transfers/TransfersPage";
import { EmployeeDrawer } from "@/features/workforce/EmployeeDrawer";
import { NewPurchasePage } from "@/features/purchases/NewPurchasePage";
import { PurchaseDrawer } from "@/features/purchases/PurchaseDrawer";
import { PurchasesPage } from "@/features/purchases/PurchasesPage";
import { WorkforcePage } from "@/features/workforce/WorkforcePage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { CashPage } from "@/features/cash/CashPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SupplierDrawer, SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { DemoProvider, useDemo } from "@/store/DemoProvider";

function Shell() {
  const { ds, ix, view, setView, warehouse, can, toast } = useDemo();
  const [navOpen, setNavOpen] = useState(false);
  const alertsRef = useRef<HTMLDivElement | null>(null);

  const alerts = useMemo(
    () => buildAlerts(ds, ix, warehouse).filter((a) => can.seeProfit || a.kind !== "advance_high"),
    [ds, ix, warehouse, can.seeProfit],
  );
  const inTransit = useMemo(
    () =>
      ds.transfers.filter(
        (t) => t.status === "in_transit" && (warehouse === "all" || t.toWarehouseId === warehouse || t.fromWarehouseId === warehouse),
      ).length,
    [ds, warehouse],
  );
  const meta = VIEW_META[view];

  const showAlerts = () => {
    if (view !== "dashboard") setView("dashboard");
    requestAnimationFrame(() => {
      alertsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      alertsRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <div className={`app ${navOpen ? "app--nav-open" : ""}`}>
      <Sidebar inTransitCount={inTransit} onNavigate={() => setNavOpen(false)} />
      <button type="button" className="scrim" aria-label="قفل القائمة" onClick={() => setNavOpen(false)} />
      <div className="main">
        <Topbar
          title={meta.title}
          crumb={`${meta.crumb} · أبو سعدة للأقمشة`}
          alertCount={alerts.length}
          showFilters={!view.endsWith("_new")}
          onMenu={() => setNavOpen(true)}
          onAlerts={showAlerts}
        />
        <main className="content" id="main">
          {view === "dashboard" ? (
            <DashboardPage alertsRef={alertsRef} />
          ) : view === "sales" ? (
            <SalesListPage />
          ) : view === "sales_new" ? (
            <NewInvoicePage />
          ) : view === "purchases" ? (
            <PurchasesPage />
          ) : view === "purchases_new" ? (
            <NewPurchasePage />
          ) : view === "suppliers" ? (
            <SuppliersPage />
          ) : view === "cash" ? (
            <CashPage />
          ) : view === "settings" ? (
            <SettingsPage />
          ) : view === "reports" ? (
            <ReportsPage />
          ) : view === "workforce" ? (
            <WorkforcePage />
          ) : view === "customers" ? (
            <CustomersPage />
          ) : view === "inventory" ? (
            <InventoryPage />
          ) : view === "transfers" ? (
            <TransfersPage />
          ) : view === "transfers_new" ? (
            <NewTransferPage />
          ) : (
            <ComingSoon view={view} onBack={() => setView("dashboard")} />
          )}
        </main>
      </div>
      <LotDrawer />
      <CustomerDrawer />
      <EmployeeDrawer />
      <SupplierDrawer />
      <PurchaseDrawer />
      <InvoiceDrawer />
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DemoApp() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}
