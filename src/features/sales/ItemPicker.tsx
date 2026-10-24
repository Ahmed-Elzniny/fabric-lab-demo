// src/features/sales/ItemPicker.tsx
"use client";

import { Check, Snowflake, Sun } from "lucide-react";
import type { AssortmentRow } from "@/data/selectors";
import type { Item } from "@/data/types";
import { fmtInt, fmtMoney } from "@/lib/format";

interface Props {
  rows: AssortmentRow[];
  items: Map<string, Item>;
  activeId: string | null;
  inInvoice: Set<string>;
  onPick: (itemId: string) => void;
  addedLabel?: string;
}

export function ItemPicker({ rows, items, activeId, inInvoice, onPick, addedLabel = "في الفاتورة" }: Props) {
  return (
    <div className="item-grid">
      {rows.map((row) => {
        const item = items.get(row.itemId);
        if (!item) return null;
        const stock = row.cells.reduce((s, c) => s + c.rolls, 0);
        const empty = stock === 0;
        return (
          <button
            key={row.itemId}
            type="button"
            className={`item-card ${row.inSeason ? "" : "item-card--off"}`}
            aria-pressed={activeId === row.itemId}
            disabled={empty}
            onClick={() => onPick(row.itemId)}
          >
            <span className="item-card__top">
              <strong>{item.name}</strong>
              {inInvoice.has(row.itemId) && (
                <span className="chip chip--good">
                  <Check size={11} aria-hidden="true" /> {addedLabel}
                </span>
              )}
            </span>
            <span className="item-card__meta">
              {item.season === "winter" ? <Snowflake size={12} aria-hidden="true" /> : <Sun size={12} aria-hidden="true" />}
              {fmtMoney(item.salePrice)} لل{item.unit === "kg" ? "كيلو" : "متر"}
            </span>
            <span className="dots dots--lg" aria-hidden="true">
              {row.cells.map((c) => (
                <span key={c.colorId} className={c.rolls === 0 ? "is-out" : ""} style={{ backgroundColor: c.rolls ? c.hex : undefined }} />
              ))}
            </span>
            <span className="item-card__stock num">
              {empty ? "مفيش مخزون" : `${fmtInt(stock)} توب · ${row.complete}/${row.total} لون`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
