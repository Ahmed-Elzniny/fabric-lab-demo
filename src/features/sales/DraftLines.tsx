// src/features/sales/DraftLines.tsx
"use client";

// بنود الفاتورة اللي اتضافت: صنف ← ألوانه بطبخاتها وعدد التواب والكمية.
import { Pencil, Trash2 } from "lucide-react";
import type { Indexes } from "@/data/selectors";
import type { DraftGroup } from "@/data/sales";
import { fmtInt, fmtMoney, fmtQty } from "@/lib/format";

interface Props {
  groups: DraftGroup[];
  ix: Indexes;
  editingId: string | null;
  onEdit: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  showMoney?: boolean;
  emptyText?: string;
}

export function DraftLines({ groups, ix, editingId, onEdit, onRemove, showMoney = true, emptyText }: Props) {
  if (groups.length === 0) {
    return <p className="hint-empty">{emptyText ?? "لسه مفيش أصناف. اختار صنف من فوق وحدد الألوان وعدد التواب."}</p>;
  }
  return (
    <div className="draft-lines">
      {groups.map((g) => {
        const item = ix.itemById.get(g.itemId);
        const unit = item?.unit === "kg" ? "كجم" : "م";
        let rolls = 0;
        let qty = 0;
        const rows = g.picks.map((p) => {
          const q = p.rollIds.reduce((s, id) => s + (ix.rollById.get(id)?.quantity ?? 0), 0);
          rolls += p.rollIds.length;
          qty += q;
          return { p, q, color: ix.colorById.get(p.colorId), lot: ix.lotById.get(p.lotId) };
        });
        return (
          <article key={g.itemId} className={`draft-group ${editingId === g.itemId ? "draft-group--editing" : ""}`}>
            <header className="draft-group__head">
              <div>
                <strong>{item?.name}</strong>
                <span className="num">
                  {showMoney && `${fmtMoney(g.unitPrice)} لل${item?.unit === "kg" ? "كيلو" : "متر"} · `}
                  {fmtInt(rolls)} توب · {rows.length} لون · {fmtQty(Math.round(qty * 10) / 10)} {unit}
                </span>
              </div>
              {showMoney && <b className="num">{fmtMoney(qty * g.unitPrice)}</b>}
              <div className="draft-group__actions">
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => onEdit(g.itemId)} aria-label={`تعديل ${item?.name ?? ""}`}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => onRemove(g.itemId)} aria-label={`حذف ${item?.name ?? ""}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </header>
            <ul className="draft-group__colors">
              {rows.map(({ p, q, color, lot }) => (
                <li key={p.colorId}>
                  <span className="color-tag">
                    <span className="color-tag__chip" style={{ backgroundColor: color?.hex }} aria-hidden="true" />
                    {color?.name}
                  </span>
                  <span className="t-muted num">طبخة {lot?.code}</span>
                  <span className="num">{p.rollIds.length} توب</span>
                  <span className="num">
                    {fmtQty(q)} {unit}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
