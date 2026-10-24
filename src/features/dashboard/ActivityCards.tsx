// src/features/dashboard/ActivityCards.tsx
"use client";

// آخر فواتير البيع + التحويلات بين المخازن.
import { ArrowLeft, ChevronLeft, Receipt, Truck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { InvoiceRow, TransferRow } from "@/data/selectors";
import { daysAgoLabel, fmtDayMonth, fmtInt, fmtMoney } from "@/lib/format";
import { diffDays } from "@/lib/dates";

const STATUS = {
  paid: { label: "مدفوعة", cls: "chip--good" },
  partial: { label: "جزء آجل", cls: "chip--warn" },
  credit: { label: "آجل", cls: "chip--info" },
} as const;

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function InvoicesCard({
  rows,
  today,
  onOpen,
  onRow,
}: {
  rows: InvoiceRow[];
  today: string;
  onOpen: () => void;
  onRow: (id: string) => void;
}) {
  return (
    <Card
      className="span-8"
      icon={<Receipt size={17} />}
      title="آخر فواتير البيع"
      subtitle="كل لون في الفاتورة تواب من نفس الطبخة"
      actions={
        <button type="button" className="link-btn" onClick={onOpen}>
          كل الفواتير <ChevronLeft size={14} aria-hidden="true" />
        </button>
      }
    >
      <div className="table-wrap">
        <table className="table table--click">
          <thead>
            <tr>
              <th scope="col">الفاتورة</th>
              <th scope="col">العميل</th>
              <th scope="col">الأصناف</th>
              <th scope="col">المخزن</th>
              <th scope="col" className="t-num">
                التواب
              </th>
              <th scope="col" className="t-num">
                الإجمالي
              </th>
              <th scope="col">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => onRow(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRow(r.id);
                  }
                }}
                aria-label={`فتح فاتورة ${r.number}`}
              >
                <td>
                  <div className="mono">{r.number}</div>
                  <div className="t-muted">{daysAgoLabel(diffDays(today, r.date))}</div>
                </td>
                <td className="t-strong">{r.customer}</td>
                <td>{r.summary}</td>
                <td>
                  <span className={`chip chip--${r.warehouseId}`}>
                    <span className={`wh-dot wh-dot--${r.warehouseId}`} aria-hidden="true" />
                    {WH[r.warehouseId]}
                  </span>
                </td>
                <td className="t-num">{fmtInt(r.rolls)}</td>
                <td className="t-num t-strong">{fmtMoney(r.total)}</td>
                <td>
                  <span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function TransfersCard({ inTransit, recent, onOpen }: { inTransit: TransferRow[]; recent: TransferRow[]; onOpen: () => void }) {
  const Item = ({ row, live }: { row: TransferRow; live: boolean }) => (
    <div className="transfer">
      <div className="transfer__route">
        <span>
          <span className={`wh-dot wh-dot--${row.transfer.fromWarehouseId}`} aria-hidden="true" />
          {WH[row.transfer.fromWarehouseId]}
        </span>
        <span className="route-line" aria-hidden="true">
          {live ? <Truck size={15} /> : <ArrowLeft size={14} />}
        </span>
        <span>
          <span className={`wh-dot wh-dot--${row.transfer.toWarehouseId}`} aria-hidden="true" />
          {WH[row.transfer.toWarehouseId]}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{row.summary}</div>
      <div className="transfer__meta num">
        <span>
          {row.rolls} توب · {row.quantityLabel}
        </span>
        <span>
          {live ? (
            <span className="chip chip--warn">في الطريق · {row.transfer.driver}</span>
          ) : (
            <span className="chip chip--good">اتسلم {fmtDayMonth(row.transfer.receivedOn ?? row.transfer.date)}</span>
          )}
        </span>
      </div>
    </div>
  );

  return (
    <Card
      className="span-4"
      icon={<Truck size={17} />}
      title="التحويلات بين المخازن"
      subtitle={inTransit.length > 0 ? `${inTransit.length} تحويل لسه في الطريق` : "مفيش تحويلات في الطريق"}
      actions={
        <button type="button" className="link-btn" onClick={onOpen}>
          كل التحويلات <ChevronLeft size={14} aria-hidden="true" />
        </button>
      }
    >
      {inTransit.map((r) => (
        <Item key={r.transfer.id} row={r} live />
      ))}
      {recent.length > 0 && (
        <>
          <p className="subhead" style={{ margin: "14px 0 8px" }}>
            آخر تحويلات اتسلمت
          </p>
          {recent.slice(0, inTransit.length > 1 ? 1 : 2).map((r) => (
            <Item key={r.transfer.id} row={r} live={false} />
          ))}
        </>
      )}
    </Card>
  );
}
