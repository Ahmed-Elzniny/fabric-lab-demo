// src/features/sales/InvoiceSuccess.tsx
"use client";

// بعد الحفظ: بنوري التاجر إيه اللي اتغيّر في النظام كله من الفاتورة دي.
import { CircleCheckBig, Copy, LayoutDashboard, Plus, ReceiptText, UserRound, Wallet } from "lucide-react";
import { RollIcon } from "@/components/ui/RollIcon";
import { BUSINESS } from "@/data/catalog";
import { customerBalance, invoiceText } from "@/data/sales";
import type { SalesInvoice } from "@/data/types";
import { copyText } from "@/lib/clipboard";
import { fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;

export function InvoiceSuccess({ invoice, onNew }: { invoice: SalesInvoice; onNew: () => void }) {
  const { ds, ix, setView, openInvoice, notify } = useDemo();
  const customer = ix.customerById.get(invoice.customerId);
  let meters = 0;
  let kilos = 0;
  for (const l of invoice.lines) {
    if (ix.itemById.get(l.itemId)?.unit === "kg") kilos += l.quantity;
    else meters += l.quantity;
  }
  const qtyLabel = [meters > 0 ? `${fmtQty(Math.round(meters * 10) / 10)} م` : "", kilos > 0 ? `${fmtQty(Math.round(kilos * 10) / 10)} كجم` : ""]
    .filter(Boolean)
    .join(" + ");
  const credit = invoice.total - invoice.paidNow;

  const onCopy = async () => {
    const ok = await copyText(invoiceText(invoice, ix, BUSINESS.name));
    notify(ok ? "اتنسخ ملخص الفاتورة — تقدر تلصقه على واتساب." : "المتصفح منع النسخ — افتح الفاتورة وانسخ يدوي.");
  };

  return (
    <section className="card success" aria-live="polite">
      <div className="success__head">
        <span className="success__icon" aria-hidden="true">
          <CircleCheckBig size={30} />
        </span>
        <div>
          <p className="eyebrow">اتسجلت</p>
          <h2>
            فاتورة <span className="mono">{invoice.number}</span> · {fmtMoney(invoice.total)}
          </h2>
          <p className="success__sub">
            {customer?.name} · مخزن {WH[invoice.warehouseId]}
          </p>
        </div>
      </div>

      <ul className="success__effects">
        <li>
          <RollIcon size={18} />
          <span>
            خرج <b className="num">{fmtInt(invoice.rollCount)} توب</b> ({qtyLabel}) من مخزن {WH[invoice.warehouseId]}، واتشالوا من المخزون فوراً
          </span>
        </li>
        <li>
          <Wallet size={18} aria-hidden="true" />
          <span>
            {invoice.paidNow > 0 ? (
              <>
                اتسجل <b className="num">{fmtMoney(invoice.paidNow)}</b> نقدي في خزنة {WH[invoice.warehouseId]}
              </>
            ) : (
              <>مفيش نقدي — الفاتورة كلها آجل</>
            )}
          </span>
        </li>
        <li>
          <UserRound size={18} aria-hidden="true" />
          <span>
            {credit > 0.5 ? (
              <>
                اتضاف <b className="num">{fmtMoney(credit)}</b> على حساب العميل، ورصيده بقى <b className="num">{fmtMoney(customerBalance(ds, invoice.customerId))}</b>
              </>
            ) : (
              <>رصيد العميل ماتغيّرش — الفاتورة مدفوعة بالكامل</>
            )}
          </span>
        </li>
      </ul>

      <div className="success__actions">
        <button type="button" className="btn btn--primary" onClick={onNew}>
          <Plus size={16} aria-hidden="true" /> فاتورة جديدة
        </button>
        <button type="button" className="btn btn--outline" onClick={() => openInvoice(invoice.id)}>
          <ReceiptText size={16} aria-hidden="true" /> عرض الفاتورة
        </button>
        <button type="button" className="btn btn--outline" onClick={onCopy}>
          <Copy size={16} aria-hidden="true" /> نسخ لواتساب
        </button>
        <button type="button" className="btn btn--outline" onClick={() => setView("dashboard")}>
          <LayoutDashboard size={16} aria-hidden="true" /> شوفها في لوحة التحكم
        </button>
      </div>
    </section>
  );
}
