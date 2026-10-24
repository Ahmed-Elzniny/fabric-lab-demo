// src/features/transfers/NewTransferPage.tsx
"use client";

import { ArrowLeft, CheckCheck, CircleCheckBig, List, Plus, Truck } from "lucide-react";
import { useState } from "react";
import { transferContents } from "@/data/transfers";
import type { StockTransfer } from "@/data/types";
import { fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { TransferComposer } from "./TransferComposer";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function NewTransferPage() {
  const { ds, ix, can, setView, receiveTransfer, notify } = useDemo();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const t: StockTransfer | undefined = createdId ? ds.transfers.find((x) => x.id === createdId) : undefined;

  if (!t) {
    return (
      <TransferComposer
        key={round}
        onDone={(created) => {
          setCreatedId(created.id);
          notify(`اتبعت ${created.number} — في الطريق لمخزن ${WH[created.toWarehouseId]}.`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onCancel={() => setView("transfers")}
      />
    );
  }

  const c = transferContents(t, ix);
  const received = t.status === "received";
  const canReceive = can.access(t.toWarehouseId);
  const qty = [c.meters > 0 ? `${fmtQty(Math.round(c.meters * 10) / 10)} م` : "", c.kilos > 0 ? `${fmtQty(Math.round(c.kilos * 10) / 10)} كجم` : ""]
    .filter(Boolean)
    .join(" + ");

  return (
    <section className="card success" aria-live="polite">
      <div className="success__head">
        <span className="success__icon" aria-hidden="true">
          {received ? <CircleCheckBig size={30} /> : <Truck size={30} />}
        </span>
        <div>
          <p className="eyebrow">{received ? "اتسلم" : "اتبعت"}</p>
          <h2>
            تحويل <span className="mono">{t.number}</span> · {WH[t.fromWarehouseId]} ← {WH[t.toWarehouseId]}
          </h2>
          <p className="success__sub">
            {fmtInt(c.rolls)} توب · {qty} · السواق {t.driver}
          </p>
        </div>
      </div>
      <ul className="success__effects">
        <li>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>
            خرج <b className="num">{fmtInt(c.rolls)} توب</b> من مخزون {WH[t.fromWarehouseId]}
            {can.seeProfit && <> (قيمتهم بالتكلفة {fmtMoney(c.costValue)})</>}
          </span>
        </li>
        <li>
          {received ? <CheckCheck size={18} aria-hidden="true" /> : <Truck size={18} aria-hidden="true" />}
          <span>
            {received ? (
              <>دخلوا مخزون {WH[t.toWarehouseId]} وبقوا متاحين للبيع</>
            ) : (
              <>
                هيبانوا «في الطريق» لحد ما {WH[t.toWarehouseId]} تأكد الاستلام — وبيظهروا في لوحة التحكم وفي التنبيهات لو اتأخروا
              </>
            )}
          </span>
        </li>
      </ul>
      <div className="success__actions">
        {!received && canReceive && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              const r = receiveTransfer(t.id);
              notify(`اتسلم ${r.number} في ${WH[r.toWarehouseId]}.`);
            }}
          >
            <CheckCheck size={16} aria-hidden="true" /> جرّب الاستلام في {WH[t.toWarehouseId]}
          </button>
        )}
        <button
          type="button"
          className={received || !canReceive ? "btn btn--primary" : "btn btn--outline"}
          onClick={() => {
            setCreatedId(null);
            setRound((r) => r + 1);
          }}
        >
          <Plus size={16} aria-hidden="true" /> تحويل جديد
        </button>
        <button type="button" className="btn btn--outline" onClick={() => setView("transfers")}>
          <List size={16} aria-hidden="true" /> كل التحويلات
        </button>
      </div>
    </section>
  );
}
