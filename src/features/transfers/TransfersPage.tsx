// src/features/transfers/TransfersPage.tsx
"use client";

// التحويلات بين المخازن: اللي في الطريق (مع تأكيد الاستلام)، واللي اتسلم، وتحويلات النقدية بين الخزن.
import { ArrowLeft, Banknote, CheckCheck, ChevronDown, PackageCheck, Plus, Truck, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PERIOD_LABEL, periodRange } from "@/data/selectors";
import { transferContents } from "@/data/transfers";
import type { StockTransfer, WarehouseId } from "@/data/types";
import { daysAgoLabel, fmtDayMonth, fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { diffDays } from "@/lib/dates";
import { useDemo } from "@/store/DemoProvider";
import { CashTransferForm } from "./CashTransferForm";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

function qtyLabel(meters: number, kilos: number) {
  return [meters > 0 ? `${fmtQty(Math.round(meters))} م` : "", kilos > 0 ? `${fmtQty(Math.round(kilos))} كجم` : ""].filter(Boolean).join(" + ");
}

function Route({ from, to, live }: { from: WarehouseId; to: WarehouseId; live: boolean }) {
  return (
    <div className="transfer__route">
      <span>
        <span className={`wh-dot wh-dot--${from}`} aria-hidden="true" />
        {WH[from]}
      </span>
      <span className="route-line" aria-hidden="true">
        {live ? <Truck size={15} /> : <ArrowLeft size={14} />}
      </span>
      <span>
        <span className={`wh-dot wh-dot--${to}`} aria-hidden="true" />
        {WH[to]}
      </span>
    </div>
  );
}

function TransitCard({ t }: { t: StockTransfer }) {
  const { ds, ix, can, receiveTransfer, notify } = useDemo();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const c = transferContents(t, ix);
  const allowed = can.access(t.toWarehouseId);
  const age = diffDays(ds.today, t.date);

  const receive = () => {
    try {
      const r = receiveTransfer(t.id);
      notify(`اتسلم ${r.number} — ${c.rolls} توب بقوا متاحين في مخزن ${WH[r.toWarehouseId]}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "حصلت مشكلة.");
    }
  };

  return (
    <article className={`card transit ${age >= 2 ? "transit--late" : ""}`}>
      <header className="transit__head">
        <div>
          <span className="mono">{t.number}</span>
          <span className="t-muted">
            {" "}
            · اتبعت {daysAgoLabel(age)}
            {t.createdBy && ` · ${t.createdBy}`}
          </span>
        </div>
        {age >= 2 ? <span className="chip chip--crit">متأخر {age} يوم</span> : <span className="chip chip--warn">في الطريق</span>}
      </header>
      <Route from={t.fromWarehouseId} to={t.toWarehouseId} live />
      <ul className="transit__items">
        {c.byItem.map((g) => (
          <li key={g.itemId}>
            <b>{g.name}</b>
            <span className="transit__colors">
              {g.colors.map((col) => (
                <span key={`${col.colorId}-${col.lotCode}`} className="color-tag color-tag--sm">
                  <span className="color-tag__chip" style={{ backgroundColor: col.hex }} aria-hidden="true" />
                  {col.name} <span className="num t-muted">×{col.rolls.length}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="transfer__meta num">
        <span>
          {fmtInt(c.rolls)} توب · {qtyLabel(c.meters, c.kilos)}
        </span>
        <span>السواق: {t.driver}</span>
      </div>
      {t.note && <p className="transit__note">{t.note}</p>}

      <button type="button" className="ab-row__more" aria-expanded={open} onClick={() => setOpen(!open)}>
        أكواد التواب <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="transit__codes">
          {c.byItem.flatMap((g) =>
            g.colors.map((col) => (
              <div key={`${g.itemId}-${col.colorId}-${col.lotCode}`}>
                <span className="t-muted">
                  {g.name} {col.name} · طبخة {col.lotCode}:
                </span>{" "}
                <span className="roll-tags">
                  {col.rolls.map((code) => (
                    <span key={code} className="roll-tag ltr">
                      {code}
                    </span>
                  ))}
                </span>
              </div>
            )),
          )}
        </div>
      )}

      <footer className="transit__foot">
        {!allowed ? (
          <span className="t-muted">الاستلام بيتعمل من مخزن {WH[t.toWarehouseId]}</span>
        ) : confirming ? (
          <div className="confirm">
            <span>
              اتأكدت إن الـ <b className="num">{c.rolls}</b> توب وصلوا {WH[t.toWarehouseId]}؟
            </span>
            <div className="confirm__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={receive}>
                <CheckCheck size={15} aria-hidden="true" /> أيوه، استلمت
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirming(false)}>
                لسه
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setConfirming(true)}>
            <PackageCheck size={15} aria-hidden="true" /> تأكيد الاستلام في {WH[t.toWarehouseId]}
          </button>
        )}
      </footer>
    </article>
  );
}

export function TransfersPage() {
  const { ds, ix, warehouse, period, can, setView } = useDemo();
  const [cashOpen, setCashOpen] = useState(false);

  const data = useMemo(() => {
    const { current } = periodRange(ds.today, period);
    const touches = (t: StockTransfer) => warehouse === "all" || t.fromWarehouseId === warehouse || t.toWarehouseId === warehouse;
    const inTransit = ds.transfers.filter((t) => t.status === "in_transit" && touches(t)).reverse();
    const received = ds.transfers
      .filter((t) => t.status === "received" && touches(t) && (t.receivedOn ?? t.date) >= current.from)
      .reverse();
    const receivedRolls = received.reduce((s, t) => s + t.rollIds.length, 0);
    const cashMoves = ds.cash
      .filter((c) => c.kind === "cash_transfer_out" && c.date >= current.from)
      .reverse();
    const inTransitRolls = inTransit.reduce((s, t) => s + t.rollIds.length, 0);
    return { inTransit, received, receivedRolls, cashMoves, inTransitRolls };
  }, [ds, warehouse, period]);

  const cashTotal = data.cashMoves.reduce((s, c) => s - c.amount, 0);

  return (
    <>
      <section className="card toolbar" aria-label="أدوات التحويلات">
        <p className="toolbar__text">
          البضاعة اللي بتتحوّل بتخرج من مخزون المرسِل فوراً، وتدخل مخزون المستلم بعد تأكيد الاستلام.
        </p>
        <div className="toolbar__actions">
          {can.transferCash && (
            <button type="button" className="btn btn--outline" onClick={() => setCashOpen(true)}>
              <Banknote size={16} aria-hidden="true" /> تحويل نقدية بين الخزن
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setView("transfers_new")}>
            <Plus size={16} aria-hidden="true" /> تحويل بضاعة جديد
          </button>
        </div>
      </section>

      <section className="stat-strip stat-strip--4" aria-label="ملخص التحويلات">
        <div className="stat-tile">
          <span>في الطريق دلوقتي</span>
          <strong className="num">
            {fmtInt(data.inTransit.length)} <small>تحويل · {fmtInt(data.inTransitRolls)} توب</small>
          </strong>
        </div>
        <div className="stat-tile">
          <span>اتسلم · {PERIOD_LABEL[period]}</span>
          <strong className="num">{fmtInt(data.received.length)} تحويل</strong>
        </div>
        <div className="stat-tile">
          <span>تواب اتنقلت</span>
          <strong className="num">{fmtInt(data.receivedRolls)}</strong>
        </div>
        {can.transferCash && (
          <div className="stat-tile">
            <span>نقدية اتحوّلت بين الخزن</span>
            <strong className="num">{fmtMoneyShort(cashTotal)}</strong>
          </div>
        )}
      </section>

      <section aria-labelledby="transit-h">
        <h2 className="section-title" id="transit-h">
          <Truck size={18} aria-hidden="true" /> في الطريق
        </h2>
        {data.inTransit.length === 0 ? (
          <p className="hint-empty">مفيش تحويلات في الطريق دلوقتي.</p>
        ) : (
          <div className="transit-grid">
            {data.inTransit.map((t) => (
              <TransitCard key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <header className="card__head">
          <div className="card__title">
            <span className="card__icon" aria-hidden="true">
              <CheckCheck size={17} />
            </span>
            <div>
              <h3>تحويلات اتسلمت</h3>
              <p>{PERIOD_LABEL[period]}</p>
            </div>
          </div>
        </header>
        <div className="card__body">
          {data.received.length === 0 ? (
            <p className="t-muted">مفيش تحويلات اتسلمت في الفترة دي.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">التحويل</th>
                    <th scope="col">المسار</th>
                    <th scope="col">المحتوى</th>
                    <th scope="col" className="t-num">
                      التواب
                    </th>
                    <th scope="col" className="t-num">
                      الكمية
                    </th>
                    <th scope="col">السواق</th>
                    <th scope="col">الاستلام</th>
                  </tr>
                </thead>
                <tbody>
                  {data.received.map((t) => {
                    const c = transferContents(t, ix);
                    const days = diffDays(t.receivedOn ?? t.date, t.date);
                    return (
                      <tr key={t.id}>
                        <td>
                          <div className="mono">{t.number}</div>
                          <div className="t-muted">اتبعت {fmtDayMonth(t.date)}</div>
                        </td>
                        <td>
                          <span className="route-mini">
                            <span className={`wh-dot wh-dot--${t.fromWarehouseId}`} aria-hidden="true" />
                            {WH[t.fromWarehouseId]}
                            <ArrowLeft size={12} aria-hidden="true" />
                            <span className={`wh-dot wh-dot--${t.toWarehouseId}`} aria-hidden="true" />
                            {WH[t.toWarehouseId]}
                          </span>
                        </td>
                        <td>
                          {c.byItem.map((g) => (
                            <div key={g.itemId}>
                              {g.name}{" "}
                              <span className="dots dots--inline" aria-label={`${g.colors.length} لون`}>
                                {g.colors.map((col) => (
                                  <span key={`${col.colorId}-${col.lotCode}`} style={{ backgroundColor: col.hex }} title={col.name} />
                                ))}
                              </span>
                            </div>
                          ))}
                        </td>
                        <td className="t-num">{fmtInt(c.rolls)}</td>
                        <td className="t-num t-muted">{qtyLabel(c.meters, c.kilos)}</td>
                        <td>{t.driver}</td>
                        <td>
                          <span className="chip chip--good">{fmtDayMonth(t.receivedOn ?? t.date)}</span>
                          <div className="t-muted">{days <= 0 ? "نفس اليوم" : days === 1 ? "بعد يوم" : `بعد ${days} أيام`}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {can.transferCash && (
        <section className="card">
          <header className="card__head">
            <div className="card__title">
              <span className="card__icon" aria-hidden="true">
                <Wallet size={17} />
              </span>
              <div>
                <h3>تحويلات النقدية بين الخزن</h3>
                <p>{PERIOD_LABEL[period]}</p>
              </div>
            </div>
            <button type="button" className="link-btn" onClick={() => setCashOpen(true)}>
              تحويل جديد
            </button>
          </header>
          <div className="card__body">
            {data.cashMoves.length === 0 ? (
              <p className="t-muted">مفيش تحويلات نقدية في الفترة دي.</p>
            ) : (
              <ul className="rows">
                {data.cashMoves.map((m) => {
                  const to: WarehouseId = m.warehouseId === "kerdasa" ? "mahalla" : "kerdasa";
                  return (
                    <li key={m.id}>
                      <span className="route-mini">
                        <span className={`wh-dot wh-dot--${m.warehouseId}`} aria-hidden="true" />
                        {WH[m.warehouseId]}
                        <ArrowLeft size={12} aria-hidden="true" />
                        <span className={`wh-dot wh-dot--${to}`} aria-hidden="true" />
                        {WH[to]}
                      </span>
                      <div className="row__main">
                        <div className="row__sub">{m.note.split(" — ")[1] ?? ""}</div>
                      </div>
                      <div className="row__value">
                        {fmtMoney(-m.amount)}
                        <small>{fmtDayMonth(m.date)}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {cashOpen && (
        <Modal title="تحويل نقدية بين الخزن" subtitle="بيتسجل صادر من خزنة ووارد في التانية في نفس اللحظة" icon={<Banknote size={17} />} onClose={() => setCashOpen(false)}>
          <CashTransferForm onDone={() => setCashOpen(false)} />
        </Modal>
      )}
    </>
  );
}
