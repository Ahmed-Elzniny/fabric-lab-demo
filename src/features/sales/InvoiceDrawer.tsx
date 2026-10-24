// src/features/sales/InvoiceDrawer.tsx
"use client";

// تفاصيل الفاتورة في لوحة جانبية: كل لون بطبخته وأكواد التواب وأطوالها الفعلية.
import { Check, Copy, Phone, ReceiptText, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { BUSINESS } from "@/data/catalog";
import { customerBalance, invoiceText } from "@/data/sales";
import type { SalesLine } from "@/data/types";
import { fmtFullDate, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { copyText } from "@/lib/clipboard";
import { invoiceStatus, STATUS_META } from "./status";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function InvoiceDrawer() {
  const { ds, ix, openInvoiceId, openInvoice, can, notify, openCustomer } = useDemo();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const inv = useMemo(() => ds.salesInvoices.find((i) => i.id === openInvoiceId) ?? null, [ds, openInvoiceId]);

  useEffect(() => {
    if (!inv) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") openInvoice(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inv, openInvoice]);

  if (!inv) return null;

  const customer = ix.customerById.get(inv.customerId);
  const status = invoiceStatus(inv);
  const gross = inv.lines.reduce((s, l) => s + l.total, 0);
  const remaining = inv.total - inv.paidNow;
  const profit = inv.total - inv.cost;
  const groups = new Map<string, SalesLine[]>();
  for (const l of inv.lines) groups.set(l.itemId, [...(groups.get(l.itemId) ?? []), l]);

  const onCopy = async () => {
    const ok = await copyText(invoiceText(inv, ix, BUSINESS.name));
    notify(ok ? "اتنسخ ملخص الفاتورة — تقدر تلصقه على واتساب." : "المتصفح منع النسخ — حدد النص وانسخه يدوي.");
  };

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__scrim" aria-label="قفل تفاصيل الفاتورة" onClick={() => openInvoice(null)} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="inv-title">
        <header className="drawer__head">
          <div className="drawer__title">
            <span className="card__icon" aria-hidden="true">
              <ReceiptText size={17} />
            </span>
            <div>
              <h2 id="inv-title">
                فاتورة <span className="mono">{inv.number}</span>
              </h2>
              <p>
                {fmtFullDate(inv.date)} · مخزن {WH[inv.warehouseId]}
                {inv.createdBy && ` · سجّلها ${inv.createdBy}`}
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => openInvoice(null)} aria-label="قفل">
            <X size={18} />
          </button>
        </header>

        <div className="drawer__body">
          <section className="inv-party">
            <span className="avatar" aria-hidden="true">
              <UserRound size={16} />
            </span>
            <div className="row__main">
              <div className="row__title">
                <button
                  type="button"
                  className="link-btn link-btn--plain"
                  onClick={() => {
                    openInvoice(null);
                    if (customer) openCustomer(customer.id);
                  }}
                >
                  {customer?.name}
                </button>
              </div>
              <div className="row__sub">
                <span>{customer?.area}</span>
                <span className="ltr num">
                  <Phone size={11} aria-hidden="true" /> {customer?.phone}
                </span>
              </div>
            </div>
            <div className="row__value">
              {fmtMoney(customerBalance(ds, inv.customerId))}
              <small>رصيده الحالي</small>
            </div>
          </section>

          {[...groups.entries()].map(([itemId, lines]) => {
            const item = ix.itemById.get(itemId);
            const unit = item?.unit === "kg" ? "كجم" : "م";
            const rolls = lines.reduce((s, l) => s + l.rollIds.length, 0);
            const qty = lines.reduce((s, l) => s + l.quantity, 0);
            return (
              <section key={itemId} className="inv-group">
                <div className="inv-group__head">
                  <strong>{item?.name}</strong>
                  <span className="num">
                    {fmtMoney(lines[0]?.unitPrice ?? 0)} لل{item?.unit === "kg" ? "كيلو" : "متر"} · {rolls} توب · {fmtQty(qty)} {unit}
                  </span>
                </div>
                <ul className="inv-lines">
                  {lines.map((l) => {
                    const color = ix.colorById.get(l.colorId);
                    const lot = ix.lotById.get(l.lotId);
                    return (
                      <li key={`${l.colorId}-${l.lotId}`}>
                        <div className="inv-line__top">
                          <span className="color-tag">
                            <span className="color-tag__chip" style={{ backgroundColor: color?.hex }} aria-hidden="true" />
                            {color?.name}
                          </span>
                          <span className="chip chip--flat num">طبخة {lot?.code}</span>
                          <span className="inv-line__qty num">
                            {fmtQty(l.quantity)} {unit}
                          </span>
                          <span className="inv-line__total num">{fmtMoney(l.total)}</span>
                        </div>
                        <div className="roll-tags">
                          {l.rollIds.map((id) => {
                            const r = ix.rollById.get(id);
                            return (
                              <span key={id} className="roll-tag num">
                                <span className="ltr">{r?.code}</span> · {fmtQty(r?.quantity ?? 0)}
                                {unit}
                              </span>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <section className="inv-totals">
            <div>
              <span>إجمالي الأصناف</span>
              <b className="num">{fmtMoney(gross)}</b>
            </div>
            {inv.discount ? (
              <div>
                <span>خصم</span>
                <b className="num">− {fmtMoney(inv.discount)}</b>
              </div>
            ) : null}
            <div className="inv-totals__net">
              <span>الصافي</span>
              <b className="num">{fmtMoney(inv.total)}</b>
            </div>
            <div>
              <span>مدفوع نقدي</span>
              <b className="num amt-in">{fmtMoney(inv.paidNow)}</b>
            </div>
            <div>
              <span>الباقي على الحساب (آجل)</span>
              <b className="num">{fmtMoney(remaining)}</b>
            </div>
            {can.seeProfit && (
              <div className="inv-totals__profit">
                <span>مجمل الربح</span>
                <b className="num">
                  {fmtMoney(profit)} · {inv.total > 0 ? ((profit / inv.total) * 100).toFixed(1) : "0"}٪
                </b>
              </div>
            )}
          </section>
        </div>

        <footer className="drawer__foot">
          <span className={`chip ${STATUS_META[status].cls}`}>
            {status === "paid" && <Check size={12} aria-hidden="true" />}
            {STATUS_META[status].label}
          </span>
          <button type="button" className="btn btn--outline" onClick={onCopy}>
            <Copy size={15} aria-hidden="true" /> نسخ الملخص لواتساب
          </button>
        </footer>
      </aside>
    </div>
  );
}
