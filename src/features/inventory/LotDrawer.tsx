// src/features/inventory/LotDrawer.tsx
"use client";

// تفاصيل الطبخة: كل توب فيها — المتاح وفين، اللي في الطريق، واللي اتباع ولمين.
import { Factory, Layers, ReceiptText, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { lotDetail } from "@/data/inventory";
import type { WarehouseId } from "@/data/types";
import { diffDays } from "@/lib/dates";
import { daysAgoLabel, fmtDayMonth, fmtFullDate, fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export function LotDrawer() {
  const { ds, ix, openLot, setOpenLot, openInvoice, can } = useDemo();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const d = useMemo(() => (openLot ? lotDetail(ds, ix, openLot.lotId) : null), [ds, ix, openLot]);
  const highlight = openLot?.rollId;

  useEffect(() => {
    if (!d) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenLot(null);
    };
    window.addEventListener("keydown", onKey);
    // لو جاي من البحث بكود توب: نوصل للتوب ده
    if (highlight) {
      requestAnimationFrame(() => document.getElementById(`roll-${highlight}`)?.scrollIntoView({ block: "center" }));
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [d, highlight, setOpenLot]);

  if (!d) return null;

  const unit = d.item.unit === "kg" ? "كجم" : "م";
  const pct = (n: number) => (d.rolls.length ? (n / d.rolls.length) * 100 : 0);
  const byWh = (["kerdasa", "mahalla"] as const)
    .map((w) => ({ w, rolls: d.available.filter((r) => r.warehouseId === w) }))
    .filter((g) => g.rolls.length > 0 && can.access(g.w));

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__scrim" aria-label="قفل تفاصيل الطبخة" onClick={() => setOpenLot(null)} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="lot-title">
        <header className="drawer__head">
          <div className="drawer__title">
            <span className="lot-swatch" style={{ backgroundColor: d.colorHex }} aria-hidden="true" />
            <div>
              <h2 id="lot-title">
                طبخة <span className="mono">{d.lot.code}</span> · {d.item.name} {d.colorName}
              </h2>
              <p>
                <Factory size={12} aria-hidden="true" /> {d.supplierName} · اتسلمت {fmtFullDate(d.lot.receivedOn)} في {WH[d.lot.warehouseId]}
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => setOpenLot(null)} aria-label="قفل">
            <X size={18} />
          </button>
        </header>

        <div className="drawer__body">
          <section className="lot-summary">
            <div className="lot-bar" aria-hidden="true">
              <span className="lot-bar__avail" style={{ width: `${pct(d.available.length)}%` }} />
              <span className="lot-bar__transit" style={{ width: `${pct(d.inTransit.length)}%` }} />
              <span className="lot-bar__sold" style={{ width: `${pct(d.sold.length)}%` }} />
            </div>
            <dl className="lot-stats">
              <div>
                <dt>
                  <i className="key key--avail" /> متاح
                </dt>
                <dd className="num">{d.available.length}</dd>
              </div>
              <div>
                <dt>
                  <i className="key key--transit" /> في الطريق
                </dt>
                <dd className="num">{d.inTransit.length}</dd>
              </div>
              <div>
                <dt>
                  <i className="key key--sold" /> اتباع
                </dt>
                <dd className="num">{d.sold.length}</dd>
              </div>
              <div>
                <dt>إجمالي الطبخة</dt>
                <dd className="num">
                  {d.rolls.length} توب · {fmtQty(Math.round(d.totalQty))} {unit}
                </dd>
              </div>
              {can.seeProfit && (
                <div>
                  <dt>تكلفة ال{d.item.unit === "kg" ? "كيلو" : "متر"}</dt>
                  <dd className="num">{fmtMoney(d.lot.unitCost)}</dd>
                </div>
              )}
            </dl>
          </section>

          {byWh.map((g) => (
            <section key={g.w} className="lot-section">
              <h3>
                <span className={`wh-dot wh-dot--${g.w}`} aria-hidden="true" /> متاح في {WH[g.w]} ·{" "}
                <span className="num">
                  {g.rolls.length} توب · {fmtQty(Math.round(g.rolls.reduce((s, r) => s + r.quantity, 0) * 10) / 10)} {unit}
                </span>
              </h3>
              <div className="roll-grid">
                {g.rolls.map((r) => (
                  <span key={r.id} id={`roll-${r.id}`} className={`roll-cell ${highlight === r.id ? "roll-cell--hl" : ""}`}>
                    <span className="ltr">{r.code}</span>
                    <b className="num">
                      {fmtQty(r.quantity)}
                      {unit}
                    </b>
                  </span>
                ))}
              </div>
            </section>
          ))}

          {d.inTransit.length > 0 && (
            <section className="lot-section">
              <h3>
                <Truck size={14} aria-hidden="true" /> في الطريق · <span className="num">{d.inTransit.length} توب</span>
              </h3>
              <ul className="lot-list">
                {d.inTransit.map(({ roll, transfer }) => (
                  <li key={roll.id} id={`roll-${roll.id}`} className={highlight === roll.id ? "is-hl" : ""}>
                    <span className="ltr mono">{roll.code}</span>
                    <span className="num">
                      {fmtQty(roll.quantity)} {unit}
                    </span>
                    <span className="t-muted">
                      {transfer ? `${transfer.number} · ${WH[transfer.fromWarehouseId]} ← ${WH[transfer.toWarehouseId]}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {d.sold.length > 0 && (
            <section className="lot-section">
              <h3>
                <ReceiptText size={14} aria-hidden="true" /> اتباع · <span className="num">{d.sold.length} توب</span>
              </h3>
              <ul className="lot-list">
                {d.sold.map(({ roll, invoice, customerName }) => (
                  <li key={roll.id} id={`roll-${roll.id}`} className={highlight === roll.id ? "is-hl" : ""}>
                    <span className="ltr mono">{roll.code}</span>
                    <span className="num">
                      {fmtQty(roll.quantity)} {unit}
                    </span>
                    <span className="lot-list__who">
                      {customerName ?? "—"}
                      <small>
                        {roll.soldOn ? `${fmtDayMonth(roll.soldOn)} · ${daysAgoLabel(diffDays(ds.today, roll.soldOn))}` : ""}
                      </small>
                    </span>
                    {invoice && (
                      <button
                        type="button"
                        className="link-btn mono"
                        onClick={() => {
                          setOpenLot(null);
                          openInvoice(invoice.id);
                        }}
                      >
                        {invoice.number}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="drawer__foot">
          <span className="t-muted num">
            <Layers size={13} aria-hidden="true" /> {fmtInt(d.rolls.length)} توب في الطبخة — كل توب بكوده وطوله الفعلي
          </span>
        </footer>
      </aside>
    </div>
  );
}
