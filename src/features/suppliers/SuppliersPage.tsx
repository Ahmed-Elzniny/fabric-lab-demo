// src/features/suppliers/SuppliersPage.tsx
"use client";

// الموردين: المستحق لكل مصنع، والأصناف اللي بيوردها، وكشف الحساب والسداد.
import { Banknote, Factory, MapPin, PackagePlus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { supplierLedger, supplierRows } from "@/data/purchases";
import type { WarehouseId } from "@/data/types";
import { addDays, diffDays } from "@/lib/dates";
import { daysAgoLabel, fmtDayMonth, fmtInt, fmtMoney, fmtMoneyShort } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { SupplierPaymentForm } from "@/features/purchases/SupplierPaymentForm";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type Range = "30" | "90" | "all";

function useSupplierItems() {
  const { ds, ix } = useDemo();
  return useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of ds.lots) {
      const set = m.get(l.supplierId) ?? new Set<string>();
      set.add(ix.itemById.get(l.itemId)?.name ?? "");
      m.set(l.supplierId, set);
    }
    return m;
  }, [ds, ix]);
}

export function SupplierDrawer() {
  const { ds, ix, openSupplierId, openSupplier, openPurchase } = useDemo();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [range, setRange] = useState<Range>("30");
  const [paying, setPaying] = useState(false);
  const supplier = openSupplierId ? ds.suppliers.find((s) => s.id === openSupplierId) : undefined;
  const ledger = useMemo(() => (supplier ? supplierLedger(ds, ix, supplier.id) : []), [ds, ix, supplier]);
  const row = useMemo(() => (supplier ? supplierRows(ds).find((r) => r.supplier.id === supplier.id) : undefined), [ds, supplier]);
  const items = useSupplierItems();

  useEffect(() => {
    if (!supplier) return;
    setPaying(false);
    closeRef.current?.focus();
  }, [supplier]);
  useEffect(() => {
    if (!supplier || paying) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openSupplier(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supplier, paying, openSupplier]);

  if (!supplier || !row) return null;
  const from = range === "all" ? null : addDays(ds.today, -Number(range));
  const shown = from ? ledger.filter((e) => e.date >= from) : ledger;
  const first = ledger.length - shown.length;
  const opening = first > 0 ? ledger[first - 1]!.balance : 0;
  const since90 = addDays(ds.today, -90);
  const bought90 = ledger.filter((e) => e.kind === "purchase" && e.date >= since90).reduce((s, e) => s + e.credit, 0);
  const paid90 = ledger.filter((e) => e.kind === "payment" && e.date >= since90).reduce((s, e) => s + e.debit, 0);

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__scrim" aria-label="قفل" onClick={() => openSupplier(null)} />
      <aside className="drawer__panel drawer__panel--wide" role="dialog" aria-modal="true" aria-labelledby="sup-title">
        <header className="drawer__head">
          <div className="drawer__title">
            <span className="card__icon" aria-hidden="true">
              <Factory size={17} />
            </span>
            <div>
              <h2 id="sup-title">{supplier.name}</h2>
              <p>
                {supplier.city} · بيورّد: {[...(items.get(supplier.id) ?? [])].join("، ")}
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => openSupplier(null)} aria-label="قفل">
            <X size={18} />
          </button>
        </header>
        <div className="drawer__body">
          <section className="cust-kpis">
            <div className="cust-kpi cust-kpi--main">
              <span>المستحق له</span>
              <strong className="num">{fmtMoney(row.balance)}</strong>
              <small className="num">من إجمالي مشتريات {fmtMoneyShort(row.purchases)}</small>
            </div>
            <div className="cust-kpi">
              <span>اشترينا منه آخر 90 يوم</span>
              <strong className="num">{fmtMoneyShort(bought90)}</strong>
            </div>
            <div className="cust-kpi">
              <span>دفعناله آخر 90 يوم</span>
              <strong className="num amt-in">{fmtMoneyShort(paid90)}</strong>
            </div>
            <div className="cust-kpi">
              <span>آخر سداد</span>
              <strong>{row.lastPayment ? daysAgoLabel(diffDays(ds.today, row.lastPayment)) : "—"}</strong>
            </div>
          </section>
          <div className="cust-actions">
            <button type="button" className="btn btn--primary" onClick={() => setPaying(true)} disabled={row.balance <= 0.5}>
              <Banknote size={16} aria-hidden="true" /> سداد
            </button>
          </div>
          <section className="statement">
            <header>
              <h3>كشف الحساب</h3>
              <Segmented<Range>
                label="الفترة"
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: "30", label: "30 يوم" },
                  { value: "90", label: "90 يوم" },
                  { value: "all", label: "من الأول" },
                ]}
              />
            </header>
            <div className="table-wrap">
              <table className="table statement__table">
                <thead>
                  <tr>
                    <th scope="col">التاريخ</th>
                    <th scope="col">البيان</th>
                    <th scope="col" className="t-num">
                      له
                    </th>
                    <th scope="col" className="t-num">
                      اتدفع
                    </th>
                    <th scope="col" className="t-num">
                      الرصيد
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {first > 0 && (
                    <tr className="statement__opening">
                      <td>{from ? fmtDayMonth(from) : ""}</td>
                      <td>رصيد سابق</td>
                      <td />
                      <td />
                      <td className="t-num">{fmtMoney(opening)}</td>
                    </tr>
                  )}
                  {shown.map((e) => (
                    <tr key={e.id} className={e.kind === "payment" ? "is-credit" : ""}>
                      <td className="num">{fmtDayMonth(e.date)}</td>
                      <td>
                        {e.purchaseId ? (
                          <button type="button" className="link-btn link-btn--plain" onClick={() => openPurchase(e.purchaseId!)}>
                            {e.description}
                          </button>
                        ) : (
                          e.description
                        )}
                        <span className="t-muted"> · {WH[e.warehouseId]}</span>
                      </td>
                      <td className="t-num">{e.credit > 0 ? fmtMoney(e.credit) : ""}</td>
                      <td className="t-num amt-in">{e.debit > 0 ? fmtMoney(e.debit) : ""}</td>
                      <td className="t-num t-strong">{fmtMoney(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </aside>
      {paying && (
        <Modal title="سداد مورد" subtitle={supplier.name} icon={<Banknote size={17} />} onClose={() => setPaying(false)}>
          <SupplierPaymentForm supplierId={supplier.id} onDone={() => setPaying(false)} />
        </Modal>
      )}
    </div>
  );
}

export function SuppliersPage() {
  const { ds, openSupplier, setView } = useDemo();
  const [q, setQ] = useState("");
  const [payFor, setPayFor] = useState<string | null>(null);
  const rows = useMemo(() => supplierRows(ds), [ds]);
  const items = useSupplierItems();
  const shown = rows.filter((r) => !q.trim() || r.supplier.name.includes(q.trim()) || r.supplier.city.includes(q.trim()));
  const total = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const max = Math.max(1, ...rows.map((r) => r.balance));

  return (
    <>
      <section className="card toolbar" aria-label="أدوات الموردين">
        <label className="search search--inline">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">ابحث عن مورد</span>
          <input id="sup-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم المصنع أو المدينة" />
        </label>
        <div className="toolbar__actions" style={{ marginInlineStart: "auto" }}>
          <button type="button" className="btn btn--primary" onClick={() => setView("purchases_new")}>
            <PackagePlus size={16} aria-hidden="true" /> استلام بضاعة
          </button>
        </div>
      </section>

      <section className="stat-strip stat-strip--4" aria-label="ملخص الموردين">
        <div className="stat-tile">
          <span>عدد الموردين</span>
          <strong className="num">{rows.length}</strong>
        </div>
        <div className="stat-tile">
          <span>إجمالي المستحق للموردين</span>
          <strong className="num" style={{ color: "var(--serious)" }}>
            {fmtMoneyShort(total)}
          </strong>
        </div>
        <div className="stat-tile">
          <span>أكبر مورد</span>
          <strong>{rows.slice().sort((a, b) => b.purchases - a.purchases)[0]?.supplier.name}</strong>
        </div>
        <div className="stat-tile">
          <span>فواتير شراء</span>
          <strong className="num">{fmtInt(rows.reduce((s, r) => s + r.invoices, 0))}</strong>
        </div>
      </section>

      <section className="card">
        <div className="card__body" style={{ paddingTop: 0 }}>
          <div className="table-wrap">
            <table className="table table--click">
              <thead>
                <tr>
                  <th scope="col">المورد</th>
                  <th scope="col">بيورّد</th>
                  <th scope="col" className="t-num">
                    إجمالي المشتريات
                  </th>
                  <th scope="col">المستحق له</th>
                  <th scope="col">آخر شراء</th>
                  <th scope="col">آخر سداد</th>
                  <th scope="col">
                    <span className="sr-only">إجراء</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.supplier.id} tabIndex={0} onClick={() => openSupplier(r.supplier.id)} onKeyDown={(e) => e.key === "Enter" && openSupplier(r.supplier.id)} aria-label={`كشف حساب ${r.supplier.name}`}>
                    <td>
                      <div className="t-strong">{r.supplier.name}</div>
                      <div className="t-muted">
                        <MapPin size={11} aria-hidden="true" /> {r.supplier.city}
                      </div>
                    </td>
                    <td>{[...(items.get(r.supplier.id) ?? [])].join("، ")}</td>
                    <td className="t-num">{fmtMoneyShort(r.purchases)}</td>
                    <td style={{ minWidth: 170 }}>
                      <div className="limit-cell">
                        <span className="num t-strong">{fmtMoney(r.balance)}</span>
                        <span className="bar-track" aria-hidden="true">
                          <span className="bar-fill" style={{ display: "block", width: `${(Math.max(0, r.balance) / max) * 100}%`, background: "var(--serious)" }} />
                        </span>
                      </div>
                    </td>
                    <td className="t-muted">{r.lastPurchase ? daysAgoLabel(diffDays(ds.today, r.lastPurchase)) : "—"}</td>
                    <td className="t-muted">{r.lastPayment ? daysAgoLabel(diffDays(ds.today, r.lastPayment)) : "—"}</td>
                    <td>
                      {r.balance > 0.5 && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPayFor(r.supplier.id);
                          }}
                        >
                          <Banknote size={14} aria-hidden="true" /> سداد
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {payFor && (
        <Modal title="سداد مورد" icon={<Banknote size={17} />} onClose={() => setPayFor(null)}>
          <SupplierPaymentForm supplierId={payFor} onDone={() => setPayFor(null)} />
        </Modal>
      )}
    </>
  );
}
