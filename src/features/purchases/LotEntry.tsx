// src/features/purchases/LotEntry.tsx
"use client";

// إدخال طبخة جديدة: الصنف، اللون، السعر، وأطوال/أوزان التواب واحد واحد.
// اكتب الرقم واضغط Enter (أو مسافة)، أو الصق كذا رقم مرة واحدة.
import { Dices, Snowflake, Sun, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { parseLengths } from "@/data/purchases";
import type { FabricColor, Item } from "@/data/types";
import { fmtInt, fmtMoney, fmtQty } from "@/lib/format";

export interface LotDraftUI {
  key: string;
  itemId: string;
  colorId: string;
  unitCost: string;
  rolls: number[];
}

interface Props {
  index: number;
  lotCode: number;
  draft: LotDraftUI;
  items: Item[];
  colors: Map<string, FabricColor | { name: string; hex: string }>;
  showCost: boolean;
  landedUnitCost: number | null;
  onChange: (d: LotDraftUI) => void;
  onRemove: () => void;
}

export function LotEntry({ index, lotCode, draft, items, colors, showCost, landedUnitCost, onChange, onRemove }: Props) {
  const [entry, setEntry] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const item = items.find((i) => i.id === draft.itemId);
  const unit = item?.unit === "kg" ? "كجم" : "م";
  const qty = draft.rolls.reduce((s, q) => s + q, 0);
  const cost = Number(draft.unitCost) || 0;

  const add = (text: string) => {
    const nums = parseLengths(text);
    if (nums.length) onChange({ ...draft, rolls: [...draft.rolls, ...nums.map((n) => Math.round(n * 100) / 100)] });
    setEntry("");
  };

  const demoFill = () => {
    if (!item) return;
    const n = item.unit === "kg" ? 8 : 10;
    const base = item.nominalRollSize;
    const rolls = Array.from({ length: n }, () => Math.round((base + (Math.random() * 6 - 1.5)) * 2) / 2);
    onChange({ ...draft, rolls: [...draft.rolls, ...rolls] });
  };

  return (
    <article className="lot-entry">
      <header className="lot-entry__head">
        <span className="step__num step__num--sm">{index + 1}</span>
        <div>
          <b>طبخة جديدة</b>
          <span className="t-muted num"> · هتاخد كود {lotCode}</span>
        </div>
        <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={onRemove} aria-label={`حذف الطبخة ${index + 1}`}>
          <Trash2 size={15} />
        </button>
      </header>

      <div className="lot-entry__row">
        <label className="field field--grow">
          <span>الصنف</span>
          <select
            id={`lot-item-${draft.key}`}
            className="text-input"
            value={draft.itemId}
            onChange={(e) => {
              const it = items.find((i) => i.id === e.target.value);
              onChange({ ...draft, itemId: e.target.value, colorId: "", unitCost: it ? String(it.baseCost) : "" });
            }}
          >
            <option value="">اختار الصنف…</option>
            <optgroup label="شتوي — بالكيلو">
              {items
                .filter((i) => i.season === "winter")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="صيفي — بالمتر">
              {items
                .filter((i) => i.season === "summer")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        {showCost && (
          <label className="field">
            <span>سعر المورد لل{item?.unit === "kg" ? "كيلو" : "متر"}</span>
            <span className="field__input">
              <input
                id={`lot-cost-${draft.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={draft.unitCost}
                onChange={(e) => onChange({ ...draft, unitCost: e.target.value })}
                disabled={!item}
              />
              <em>ج.م</em>
            </span>
          </label>
        )}
      </div>

      {item && (
        <div className="field">
          <span>
            اللون {item.season === "winter" ? <Snowflake size={12} aria-hidden="true" /> : <Sun size={12} aria-hidden="true" />}
          </span>
          <div className="color-pick" role="radiogroup" aria-label="اللون">
            {item.colorIds.map((cid) => {
              const c = colors.get(cid);
              return (
                <button
                  key={cid}
                  type="button"
                  role="radio"
                  aria-checked={draft.colorId === cid}
                  className="color-pick__btn"
                  onClick={() => onChange({ ...draft, colorId: cid })}
                >
                  <span className="color-tag__chip" style={{ backgroundColor: c?.hex }} aria-hidden="true" />
                  {c?.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {item && draft.colorId && (
        <div className="field">
          <span>
            {item.unit === "kg" ? "أوزان التواب بالكيلو" : "أطوال التواب بالمتر"} — اكتب الرقم واضغط Enter، أو الصق كذا رقم
          </span>
          <div className="lengths" onClick={() => inputRef.current?.focus()}>
            {draft.rolls.map((q, i) => (
              <span key={i} className="lengths__chip num">
                <small>{String(i + 1).padStart(2, "0")}</small>
                {fmtQty(q)}
                <button
                  type="button"
                  aria-label={`شيل التوب ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ ...draft, rolls: draft.rolls.filter((_, k) => k !== i) });
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id={`lot-len-${draft.key}`}
              className="lengths__input"
              inputMode="decimal"
              dir="ltr"
              value={entry}
              placeholder={draft.rolls.length ? "" : item.unit === "kg" ? "مثلاً 101.5" : "مثلاً 61.5"}
              onChange={(e) => {
                const v = e.target.value;
                if (/[\s,،]$/.test(v)) add(v);
                else setEntry(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(entry);
                } else if (e.key === "Backspace" && !entry && draft.rolls.length) {
                  onChange({ ...draft, rolls: draft.rolls.slice(0, -1) });
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                add(e.clipboardData.getData("text"));
              }}
              onBlur={() => entry && add(entry)}
              aria-label="طول أو وزن التوب"
            />
          </div>
          <div className="lengths__tools">
            <button type="button" className="pill-btn pill-btn--ghost" onClick={demoFill}>
              <Dices size={14} aria-hidden="true" /> املأ {item.unit === "kg" ? "8" : "10"} تواب تجريبي
            </button>
            {draft.rolls.length > 0 && (
              <button type="button" className="pill-btn pill-btn--ghost" onClick={() => onChange({ ...draft, rolls: [] })}>
                مسح الكل
              </button>
            )}
          </div>
        </div>
      )}

      <footer className="lot-entry__foot num">
        <span>
          <b>{fmtInt(draft.rolls.length)}</b> توب · {fmtQty(Math.round(qty * 10) / 10)} {unit}
        </span>
        {showCost && cost > 0 && qty > 0 && (
          <span>
            القيمة <b>{fmtMoney(qty * cost)}</b>
            {landedUnitCost !== null && landedUnitCost > cost + 0.005 && (
              <span className="chip chip--info num" style={{ marginInlineStart: 6 }}>
                التكلفة بعد النقل {fmtMoney(landedUnitCost)}/{unit}
              </span>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}
