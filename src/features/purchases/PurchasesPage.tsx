// src/features/purchases/PurchasesPage.tsx
"use client";

// المشتريات: فواتير الاستلام من المصانع، وأرصدة الموردين، والسداد.
import { Banknote, Factory, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { purchaseRows, supplierRows } from "@/data/purchases";
import { PERIOD_LABEL, periodRange } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";
import { diffDays } from "@/lib/dates";
import { daysAgoLabel, fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { SupplierPaymentForm } from "./SupplierPaymentForm";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
const PAGE = 25;

export function PurchasesPage() {
  const { ds, ix, warehouse, period, can, setView, openPurchase } = useDemo();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [payFor, setPayFor] = useState<string | null | undefined>(undefined);

  const rows = useMemo(() => purchaseRows(ds, ix, warehouse, period), [ds, ix, warehouse, period]);
  const suppliers = useMemo(() => supplierRows(ds), [ds]);
  const filtered = useMemo(() => {
    const n = q.trim();
    if (!n) return rows;
    return rows.filter((r) => r.supplierName.includes(n) || r.invoice.number.toLowerCase().includes(n.toLowerCase()) || r.itemNames.includes(n) || r.lots.some((l) => l.code.includes(n)));
  }, [rows, q]);

  const stats = useMemo(() => {
    const { current } = periodRange(ds.today, period);
    const paid = ds.cash
      .filter((t) => t.kind === "supplier_payment" && t.date >= current.from && (warehouse === "all" || t.warehouseId === warehouse))
      .reduce((s, t) => s - t.amount, 0);
    return {
      total: rows.reduce((s, r) => s + r.invoice.total, 0),
      lots: rows.reduce((s, r) => s + r.lots.length, 0),
      rolls: rows.reduce((s, r) => s + r.rolls, 0),
      paid,
      owed: suppliers.reduce((s, r) => s + Math.max(0, r.balance), 0),
    };
  }, [rows, suppliers, ds, period, warehouse]);

  return (
    <>
      <section className="card toolbar" aria-label="أدوات المشتريات">
        <label className="search search--inline">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">بحث في المشتريات</span>
          <input id="po-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="المورد، رقم الفاتورة، الصنف، أو رقم الطبخة" />
        </label>
        <div className="toolbar__actions" style={{ marginInlineStart: "auto" }}>
          {can.seeProfit && (
            <button type="button" className="btn btn--outline" onClick={() => setPayFor(null)}>
              <Banknote size={16} aria-hidden="true" /> سداد مورد
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setView("purchases_new")}>
            <PackagePlus size={16} aria-hidden="true" /> استلام بضاعة جديدة
          </button>
        </div>
      </section>

      <section className={`stat-strip ${can.seeProfit ? "" : "stat-strip--4"}`} aria-label="ملخص المشتريات">
        <div className="stat-tile">
          <span>فواتير الشراء · {PERIOD_LABEL[period]}</span>
          <strong className="num">{fmtInt(rows.length)}</strong>
        </div>
        <div className="stat-tile">
          <span>طبخات اتسلمت</span>
          <strong className="num">
            {fmtInt(stats.lots)} <small>· {fmtInt(stats.rolls)} توب</small>
          </strong>
        </div>
        {can.seeProfit && (
          <div className="stat-tile">
            <span>قيمة المشتريات</span>
            <strong className="num">{fmtMoneyShort(stats.total)}</strong>
          </div>
        )}
        {can.seeProfit && (
          <div className="stat-tile">
            <span>اتدفع للموردين</span>
            <strong className="num">{fmtMoneyShort(stats.paid)}</strong>
          </div>
        )}
        {can.seeProfit && (
          <div className="stat-tile">
            <span>مستحق للموردين</span>
            <strong className="num" style={{ color: "var(--serious)" }}>
              {fmtMoneyShort(stats.owed)}
            </strong>
          </div>
        )}
      </section>

      {can.seeProfit && (
        <section className="card">
          <header className="card__head">
            <div className="card__title">
              <span className="card__icon" aria-hidden="true">
                <Factory size={17} />
              </span>
              <div>
                <h3>أرصدة الموردين</h3>
                <p>المستحق لكل مصنع = فواتير الشراء − اللي اتدفع</p>
              </div>
            </div>
          </header>
          <div className="card__body">
            <ul className="supplier-list">
              {suppliers.map((s) => {
                const max = Math.max(1, ...suppliers.map((x) => x.balance));
                return (
                  <li key={s.supplier.id}>
                    <div className="row__main">
                      <div className="row__title">{s.supplier.name}</div>
                      <div className="row__sub num">
                        <span>{s.supplier.city}</span>
                        <span>{s.invoices} فاتورة</span>
                        {s.lastPayment && <span>آخر سداد {daysAgoLabel(diffDays(ds.today, s.lastPayment))}</span>}
                      </div>
                      <div className="bar-track" aria-hidden="true" style={{ marginTop: 6 }}>
                        <span className="bar-fill" style={{ display: "block", width: `${(Math.max(0, s.balance) / max) * 100}%`, background: "var(--serious)" }} />
                      </div>
                    </div>
                    <div className="row__value">
                      {fmtMoneyShort(s.balance)}
                      <small>مستحق</small>
                    </div>
                    {s.balance > 0.5 && (
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => setPayFor(s.supplier.id)}>
                        سداد
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card__body" style={{ paddingTop: 0 }}>
          {filtered.length === 0 ? (
            <p className="t-muted" style={{ padding: "24px 0" }}>
              مفيش فواتير شراء بالبحث ده في {PERIOD_LABEL[period]}.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table table--click">
                <thead>
                  <tr>
                    <th scope="col">الفاتورة</th>
                    <th scope="col">المورد</th>
                    <th scope="col">الطبخات</th>
                    <th scope="col">المخزن</th>
                    <th scope="col" className="t-num">
                      التواب
                    </th>
                    <th scope="col" className="t-num">
                      الكمية
                    </th>
                    {can.seeProfit && (
                      <th scope="col" className="t-num">
                        القيمة
                      </th>
                    )}
                    {can.seeProfit && (
                      <th scope="col" className="t-num">
                        اتدفع
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((r) => (
                    <tr
                      key={r.invoice.id}
                      tabIndex={0}
                      onClick={() => openPurchase(r.invoice.id)}
                      onKeyDown={(e) => e.key === "Enter" && openPurchase(r.invoice.id)}
                      aria-label={`فتح ${r.invoice.number}`}
                    >
                      <td>
                        <div className="mono">{r.invoice.number}</div>
                        <div className="t-muted">
                          {daysAgoLabel(diffDays(ds.today, r.invoice.date))}
                          {r.invoice.createdBy && " · جديدة"}
                        </div>
                      </td>
                      <td className="t-strong">{r.supplierName}</td>
                      <td>
                        <div>{r.itemNames}</div>
                        <div className="dots">
                          {r.colors.map((hex, i) => (
                            <span key={i} style={{ backgroundColor: hex }} />
                          ))}
                          <em className="num">{r.lots.length} طبخة</em>
                        </div>
                      </td>
                      <td>
                        <span className={`chip chip--${r.invoice.warehouseId}`}>
                          <span className={`wh-dot wh-dot--${r.invoice.warehouseId}`} aria-hidden="true" />
                          {WH[r.invoice.warehouseId]}
                        </span>
                      </td>
                      <td className="t-num">{fmtInt(r.rolls)}</td>
                      <td className="t-num t-muted">
                        {r.meters > 0 && <div>{fmtQty(Math.round(r.meters))} م</div>}
                        {r.kilos > 0 && <div>{fmtQty(Math.round(r.kilos))} كجم</div>}
                      </td>
                      {can.seeProfit && <td className="t-num t-strong">{fmtMoney(r.invoice.total)}</td>}
                      {can.seeProfit && <td className="t-num">{r.invoice.paidNow > 0 ? fmtMoney(r.invoice.paidNow) : <span className="chip chip--info">آجل</span>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > limit && (
          <footer className="card__foot">
            <span className="num">
              معروض {fmtInt(limit)} من {fmtInt(filtered.length)}
            </span>
            <button type="button" className="link-btn" onClick={() => setLimit((l) => l + PAGE)}>
              عرض {PAGE} كمان
            </button>
          </footer>
        )}
      </section>

      {payFor !== undefined && (
        <Modal title="سداد مورد" subtitle="المبلغ بيخرج من الخزنة اللي تختارها" icon={<Banknote size={17} />} onClose={() => setPayFor(undefined)}>
          <SupplierPaymentForm supplierId={payFor ?? undefined} onDone={() => setPayFor(undefined)} />
        </Modal>
      )}
    </>
  );
}
