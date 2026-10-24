// src/features/purchases/PurchaseDrawer.tsx
"use client";

// تفاصيل فاتورة شراء: الطبخات اللي اتسلمت، وكل طبخة بتفتح تواتبها.
import { ChevronLeft, Factory, PackagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { supplierRows } from "@/data/purchases";
import type { WarehouseId } from "@/data/types";
import { fmtFullDate, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };

export function PurchaseDrawer() {
  const { ds, ix, openPurchaseId, openPurchase, setOpenLot, can } = useDemo();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const inv = useMemo(() => ds.purchaseInvoices.find((p) => p.id === openPurchaseId) ?? null, [ds, openPurchaseId]);

  useEffect(() => {
    if (!inv) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") openPurchase(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inv, openPurchase]);

  if (!inv) return null;
  const supplier = ds.suppliers.find((s) => s.id === inv.supplierId);
  const bal = supplierRows(ds).find((r) => r.supplier.id === inv.supplierId)?.balance ?? 0;
  const lots = inv.lotIds.map((id) => ix.lotById.get(id)).filter(Boolean);

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__scrim" aria-label="قفل" onClick={() => openPurchase(null)} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="po-title">
        <header className="drawer__head">
          <div className="drawer__title">
            <span className="card__icon" aria-hidden="true">
              <PackagePlus size={17} />
            </span>
            <div>
              <h2 id="po-title">
                فاتورة شراء <span className="mono">{inv.number}</span>
              </h2>
              <p>
                {fmtFullDate(inv.date)} · مخزن {WH[inv.warehouseId]}
                {inv.supplierRef && ` · فاتورة المورد ${inv.supplierRef}`}
                {inv.createdBy && ` · ${inv.createdBy}`}
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => openPurchase(null)} aria-label="قفل">
            <X size={18} />
          </button>
        </header>
        <div className="drawer__body">
          <section className="inv-party">
            <span className="avatar" aria-hidden="true">
              <Factory size={16} />
            </span>
            <div className="row__main">
              <div className="row__title">{supplier?.name}</div>
              <div className="row__sub">{supplier?.city}</div>
            </div>
            {can.seeProfit && (
              <div className="row__value">
                {fmtMoney(bal)}
                <small>المستحق له دلوقتي</small>
              </div>
            )}
          </section>

          <section className="lot-section">
            <h3>الطبخات ({lots.length})</h3>
            <ul className="po-lots">
              {lots.map((lot) => {
                if (!lot) return null;
                const item = ix.itemById.get(lot.itemId);
                const color = ix.colorById.get(lot.colorId);
                const rolls = ds.rolls.filter((r) => r.lotId === lot.id);
                const qty = rolls.reduce((s, r) => s + r.quantity, 0);
                const avail = rolls.filter((r) => r.status === "available").length;
                const unit = item?.unit === "kg" ? "كجم" : "م";
                return (
                  <li key={lot.id}>
                    <button
                      type="button"
                      onClick={() => {
                        openPurchase(null);
                        setOpenLot({ lotId: lot.id });
                      }}
                    >
                      <span className="lot-swatch" style={{ backgroundColor: color?.hex }} aria-hidden="true" />
                      <span className="row__main">
                        <span className="row__title">
                          طبخة <span className="mono">{lot.code}</span> · {item?.name} {color?.name}
                        </span>
                        <span className="row__sub num">
                          <span>
                            {rolls.length} توب · {fmtQty(Math.round(qty * 10) / 10)} {unit}
                          </span>
                          <span>متاح دلوقتي {avail}</span>
                        </span>
                      </span>
                      {can.seeProfit && (
                        <span className="row__value">
                          {fmtMoney(qty * lot.unitCost)}
                          <small>
                            {fmtMoney(lot.unitCost)}/{unit}
                          </small>
                        </span>
                      )}
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {can.seeProfit && (
            <section className="inv-totals">
              <div>
                <span>قيمة البضاعة (للمورد)</span>
                <b className="num">{fmtMoney(inv.total)}</b>
              </div>
              {inv.extraCost ? (
                <div>
                  <span>نقل وتحميل (اتوزّع على التكلفة)</span>
                  <b className="num">{fmtMoney(inv.extraCost)}</b>
                </div>
              ) : null}
              <div>
                <span>اتدفع مع الفاتورة</span>
                <b className="num amt-in">{fmtMoney(inv.paidNow)}</b>
              </div>
              <div className="inv-totals__net">
                <span>الباقي من الفاتورة (آجل)</span>
                <b className="num">{fmtMoney(inv.total - inv.paidNow)}</b>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
