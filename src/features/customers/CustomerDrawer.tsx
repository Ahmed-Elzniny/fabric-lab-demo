// src/features/customers/CustomerDrawer.tsx
"use client";

// كشف حساب العميل: الرصيد، وأعمار الدين، وكل حركة بالرصيد المتراكم.
import { Copy, HandCoins, Phone, Plus, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { BUSINESS } from "@/data/catalog";
import { agingByCustomer, customerLedger, statementText } from "@/data/customers";
import { customerBalances, daysSincePaid } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";
import { copyText } from "@/lib/clipboard";
import { addDays } from "@/lib/dates";
import { daysAgoLabel, fmtDayMonth, fmtMoney, fmtMoneyShort } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { AgingBar } from "./AgingBar";
import { CollectionForm } from "./CollectionForm";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type Range = "30" | "90" | "all";

export function CustomerDrawer() {
  const { ds, ix, openCustomerId, openCustomer, openInvoice, newInvoiceFor, notify } = useDemo();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [range, setRange] = useState<Range>("30");
  const [collecting, setCollecting] = useState(false);
  const customer = openCustomerId ? ix.customerById.get(openCustomerId) : undefined;

  const data = useMemo(() => {
    if (!customer) return null;
    const ledger = customerLedger(ds, ix, customer.id);
    const b = customerBalances(ds).get(customer.id)!;
    const aging = agingByCustomer(ds).get(customer.id)!;
    const since90 = addDays(ds.today, -90);
    const purchases90 = ledger.filter((e) => e.kind === "invoice" && e.date >= since90).reduce((s, e) => s + e.debit, 0);
    const paid90 = ledger.filter((e) => e.kind !== "invoice" && e.date >= since90).reduce((s, e) => s + e.credit, 0);
    return { ledger, b, aging, purchases90, paid90, lastPay: daysSincePaid(ds.today, b) };
  }, [ds, ix, customer]);

  useEffect(() => {
    if (!customer) return;
    setCollecting(false);
    closeRef.current?.focus();
  }, [customer]);

  useEffect(() => {
    if (!customer || collecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") openCustomer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customer, collecting, openCustomer]);

  if (!customer || !data) return null;

  const from = range === "all" ? null : addDays(ds.today, -Number(range));
  const shown = from ? data.ledger.filter((e) => e.date >= from) : data.ledger;
  const firstIdx = data.ledger.length - shown.length;
  const opening = firstIdx > 0 ? data.ledger[firstIdx - 1]!.balance : 0;
  const pct = Math.min(100, (Math.max(0, data.b.balance) / customer.creditLimit) * 100);
  const over = data.b.balance > customer.creditLimit;

  const onCopy = async () => {
    const ok = await copyText(statementText(customer, data.ledger, BUSINESS.name));
    notify(ok ? "اتنسخ كشف الحساب — تقدر تبعته للعميل على واتساب." : "المتصفح منع النسخ.");
  };

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__scrim" aria-label="قفل كشف الحساب" onClick={() => openCustomer(null)} />
      <aside className="drawer__panel drawer__panel--wide" role="dialog" aria-modal="true" aria-labelledby="cust-title">
        <header className="drawer__head">
          <div className="drawer__title">
            <span className="card__icon" aria-hidden="true">
              <UserRound size={17} />
            </span>
            <div>
              <h2 id="cust-title">{customer.name}</h2>
              <p>
                {customer.area} · عميل {WH[customer.homeWarehouseId]} ·{" "}
                <span className="ltr num">
                  <Phone size={11} aria-hidden="true" /> {customer.phone}
                </span>
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => openCustomer(null)} aria-label="قفل">
            <X size={18} />
          </button>
        </header>

        <div className="drawer__body">
          <section className="cust-kpis">
            <div className={`cust-kpi cust-kpi--main ${over ? "is-over" : ""}`}>
              <span>الرصيد المستحق عليه</span>
              <strong className="num">{fmtMoney(data.b.balance)}</strong>
              <div className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ display: "block", width: `${pct}%`, background: over ? "var(--crit)" : "var(--teal)" }} />
              </div>
              <small className="num">
                {over ? "فوق" : "من"} حد الائتمان {fmtMoneyShort(customer.creditLimit)}
              </small>
            </div>
            <div className="cust-kpi">
              <span>مشتريات آخر 90 يوم</span>
              <strong className="num">{fmtMoneyShort(data.purchases90)}</strong>
            </div>
            <div className="cust-kpi">
              <span>دفع آخر 90 يوم</span>
              <strong className="num amt-in">{fmtMoneyShort(data.paid90)}</strong>
            </div>
            <div className="cust-kpi">
              <span>آخر دفعة</span>
              <strong style={(data.lastPay ?? 0) > 40 ? { color: "var(--crit)" } : undefined}>
                {data.lastPay === null ? "—" : daysAgoLabel(data.lastPay)}
              </strong>
            </div>
          </section>

          <section className="cust-aging">
            <h3>أعمار الدين</h3>
            <AgingBar aging={data.aging} />
          </section>

          <div className="cust-actions">
            <button type="button" className="btn btn--primary" onClick={() => setCollecting(true)} disabled={data.b.balance <= 0.5}>
              <HandCoins size={16} aria-hidden="true" /> تسجيل تحصيل
            </button>
            <button type="button" className="btn btn--outline" onClick={() => newInvoiceFor(customer.id)}>
              <Plus size={16} aria-hidden="true" /> فاتورة جديدة
            </button>
            <button type="button" className="btn btn--outline" onClick={onCopy}>
              <Copy size={16} aria-hidden="true" /> نسخ الكشف لواتساب
            </button>
          </div>

          <section className="statement">
            <header>
              <h3>كشف الحساب</h3>
              <Segmented<Range>
                label="فترة الكشف"
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
                      عليه
                    </th>
                    <th scope="col" className="t-num">
                      دفع
                    </th>
                    <th scope="col" className="t-num">
                      الرصيد
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {firstIdx > 0 && (
                    <tr className="statement__opening">
                      <td>{from ? fmtDayMonth(from) : ""}</td>
                      <td>رصيد سابق</td>
                      <td />
                      <td />
                      <td className="t-num t-strong">{fmtMoney(opening)}</td>
                    </tr>
                  )}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="t-muted">
                        مفيش حركة في الفترة دي.
                      </td>
                    </tr>
                  )}
                  {shown.map((e) => (
                    <tr key={e.id} className={e.kind === "invoice" ? "is-debit" : "is-credit"}>
                      <td className="num">{fmtDayMonth(e.date)}</td>
                      <td>
                        {e.invoiceId && e.kind === "invoice" ? (
                          <button type="button" className="link-btn link-btn--plain" onClick={() => openInvoice(e.invoiceId!)}>
                            {e.description}
                          </button>
                        ) : (
                          e.description
                        )}
                        <span className="t-muted"> · {WH[e.warehouseId]}</span>
                      </td>
                      <td className="t-num">{e.debit > 0 ? fmtMoney(e.debit) : ""}</td>
                      <td className="t-num amt-in">{e.credit > 0 ? fmtMoney(e.credit) : ""}</td>
                      <td className="t-num t-strong">{fmtMoney(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </aside>

      {collecting && (
        <Modal title="تسجيل تحصيل" subtitle={customer.name} icon={<HandCoins size={17} />} onClose={() => setCollecting(false)}>
          <CollectionForm customerId={customer.id} onDone={() => setCollecting(false)} />
        </Modal>
      )}
    </div>
  );
}
