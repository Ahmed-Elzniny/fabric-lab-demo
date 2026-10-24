// src/features/sales/CustomerPicker.tsx
"use client";

import { AlertTriangle, Phone, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { CustomerBalance } from "@/data/selectors";
import type { Customer, WarehouseId } from "@/data/types";
import { daysAgoLabel, fmtMoney, fmtMoneyShort } from "@/lib/format";
import { diffDays } from "@/lib/dates";

interface Props {
  customers: Customer[];
  balances: Map<string, CustomerBalance>;
  warehouseId: WarehouseId;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  today: string;
}

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function CustomerPicker({ customers, balances, warehouseId, selectedId, onSelect, today }: Props) {
  const [q, setQ] = useState("");
  const selected = customers.find((c) => c.id === selectedId);

  const matches = useMemo(() => {
    const needle = q.trim();
    return customers
      .filter((c) => !needle || c.name.includes(needle) || c.area.includes(needle) || c.phone.replace(/\s/g, "").includes(needle.replace(/\s/g, "")))
      .sort((a, b) => Number(b.homeWarehouseId === warehouseId) - Number(a.homeWarehouseId === warehouseId))
      .slice(0, 8);
  }, [customers, q, warehouseId]);

  if (selected) {
    const b = balances.get(selected.id);
    const balance = b?.balance ?? 0;
    const pct = Math.min(100, (Math.max(0, balance) / selected.creditLimit) * 100);
    const over = balance > selected.creditLimit;
    const lastPay = b?.lastPayment ? diffDays(today, b.lastPayment) : null;
    return (
      <div className="cust-card">
        <span className="avatar" aria-hidden="true">
          <UserRound size={16} />
        </span>
        <div className="row__main">
          <div className="row__title">{selected.name}</div>
          <div className="row__sub">
            <span>{selected.area}</span>
            <span className="ltr num">
              <Phone size={11} aria-hidden="true" /> {selected.phone}
            </span>
            <span>عميل {WH[selected.homeWarehouseId]}</span>
          </div>
          <div className="cust-card__credit">
            <div className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ display: "block", width: `${pct}%`, background: over ? "var(--crit)" : "var(--teal)" }} />
            </div>
            <span className="num">
              رصيده {fmtMoney(balance)} من حد {fmtMoneyShort(selected.creditLimit)}
            </span>
          </div>
          {(over || (lastPay ?? 0) > 40) && (
            <div className="cust-card__warn">
              <AlertTriangle size={13} aria-hidden="true" />
              {over ? "العميل عدّى حد الائتمان" : `آخر دفعة ${daysAgoLabel(lastPay ?? 0)}`}
            </div>
          )}
        </div>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => onSelect(null)}>
          تغيير
        </button>
      </div>
    );
  }

  return (
    <div className="cust-picker">
      <label className="search search--inline">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">ابحث عن عميل</span>
        <input
          id="customer-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اسم العميل، المنطقة، أو رقم الموبايل"
          autoComplete="off"
        />
      </label>
      <ul className="cust-list" aria-label="العملاء">
        {matches.map((c) => {
          const bal = balances.get(c.id)?.balance ?? 0;
          return (
            <li key={c.id}>
              <button type="button" onClick={() => onSelect(c.id)}>
                <span className="row__main">
                  <span className="row__title">{c.name}</span>
                  <span className="row__sub">
                    <span>{c.area}</span>
                    {c.homeWarehouseId !== warehouseId && <span>عميل {WH[c.homeWarehouseId]}</span>}
                  </span>
                </span>
                <span className="row__value">
                  {fmtMoneyShort(bal)}
                  <small style={bal > c.creditLimit ? { color: "var(--crit)", fontWeight: 600 } : undefined}>
                    {bal > c.creditLimit ? "فوق الحد" : "رصيد"}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
        {matches.length === 0 && <li className="cust-list__empty">مفيش عميل بالاسم ده.</li>}
      </ul>
    </div>
  );
}
