// src/features/sales/SalesListPage.tsx
"use client";

// قائمة فواتير البيع: بحث، فلتر بالحالة، وملخص الفترة. الضغط على أي فاتورة بيفتح تفاصيلها.
import { ChevronLeft, FileSearch, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { PERIOD_LABEL, periodRange } from "@/data/selectors";
import { daysAgoLabel, fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { diffDays } from "@/lib/dates";
import { useDemo } from "@/store/DemoProvider";
import { invoiceStatus, STATUS_META, type InvoiceStatus } from "./status";

const WH = { kerdasa: "كرداسة", mahalla: "المحلة" } as const;
const PAGE = 25;

type StatusFilter = "all" | InvoiceStatus;

export function SalesListPage() {
  const { ds, ix, warehouse, period, setView, openInvoice } = useDemo();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => {
    const { current } = periodRange(ds.today, period);
    const rows = [];
    for (let i = ds.salesInvoices.length - 1; i >= 0; i--) {
      const inv = ds.salesInvoices[i]!;
      if (inv.date < current.from || inv.date > current.to) continue;
      if (warehouse !== "all" && inv.warehouseId !== warehouse) continue;
      const customer = ix.customerById.get(inv.customerId);
      const itemIds = [...new Set(inv.lines.map((l) => l.itemId))];
      let meters = 0;
      let kilos = 0;
      for (const l of inv.lines) {
        if (ix.itemById.get(l.itemId)?.unit === "kg") kilos += l.quantity;
        else meters += l.quantity;
      }
      rows.push({
        inv,
        customer: customer?.name ?? "",
        area: customer?.area ?? "",
        items: itemIds.map((id) => ix.itemById.get(id)?.name ?? "").join(" + "),
        colors: inv.lines.map((l) => ix.colorById.get(l.colorId)?.hex ?? "#999"),
        meters,
        kilos,
        status: invoiceStatus(inv),
      });
    }
    return rows;
  }, [ds, ix, warehouse, period]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    return all.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (!needle || r.customer.includes(needle) || r.inv.number.toLowerCase().includes(needle.toLowerCase()) || r.items.includes(needle)),
    );
  }, [all, q, status]);

  const sum = filtered.reduce(
    (s, r) => {
      s.total += r.inv.total;
      s.paid += r.inv.paidNow;
      s.rolls += r.inv.rollCount;
      return s;
    },
    { total: 0, paid: 0, rolls: 0 },
  );

  return (
    <>
      <section className="card toolbar" aria-label="أدوات الفواتير">
        <label className="search search--inline">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">بحث في الفواتير</span>
          <input
            id="sales-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="ابحث برقم الفاتورة، اسم العميل، أو الصنف"
          />
        </label>
        <Segmented<StatusFilter>
          label="حالة الدفع"
          size="sm"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: "الكل" },
            { value: "paid", label: "مدفوعة" },
            { value: "partial", label: "جزء آجل" },
            { value: "credit", label: "آجل" },
          ]}
        />
        <button type="button" className="btn btn--primary toolbar__cta" onClick={() => setView("sales_new")}>
          <Plus size={16} aria-hidden="true" /> فاتورة بيع جديدة
        </button>
      </section>

      <section className="stat-strip" aria-label="ملخص الفواتير">
        <div className="stat-tile">
          <span>عدد الفواتير · {PERIOD_LABEL[period]}</span>
          <strong className="num">{fmtInt(filtered.length)}</strong>
        </div>
        <div className="stat-tile">
          <span>التواب المباعة</span>
          <strong className="num">{fmtInt(sum.rolls)}</strong>
        </div>
        <div className="stat-tile">
          <span>إجمالي المبيعات</span>
          <strong className="num">{fmtMoneyShort(sum.total)}</strong>
        </div>
        <div className="stat-tile">
          <span>اتحصّل نقدي</span>
          <strong className="num amt-in">{fmtMoneyShort(sum.paid)}</strong>
        </div>
        <div className="stat-tile">
          <span>اتسجّل آجل</span>
          <strong className="num">{fmtMoneyShort(sum.total - sum.paid)}</strong>
        </div>
      </section>

      <section className="card">
        <div className="card__body" style={{ paddingTop: 0 }}>
          {filtered.length === 0 ? (
            <div className="empty">
              <FileSearch size={28} aria-hidden="true" />
              <p>مفيش فواتير بالبحث ده في {PERIOD_LABEL[period]}.</p>
              <button type="button" className="link-btn" onClick={() => setView("sales_new")}>
                اعمل فاتورة جديدة
              </button>
            </div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 0 }}>
              <table className="table table--click">
                <thead>
                  <tr>
                    <th scope="col">الفاتورة</th>
                    <th scope="col">العميل</th>
                    <th scope="col">الأصناف والألوان</th>
                    <th scope="col">المخزن</th>
                    <th scope="col" className="t-num">
                      التواب
                    </th>
                    <th scope="col" className="t-num">
                      الكمية
                    </th>
                    <th scope="col" className="t-num">
                      الصافي
                    </th>
                    <th scope="col" className="t-num">
                      الباقي آجل
                    </th>
                    <th scope="col">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((r) => (
                    <tr
                      key={r.inv.id}
                      tabIndex={0}
                      onClick={() => openInvoice(r.inv.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openInvoice(r.inv.id);
                        }
                      }}
                      aria-label={`فتح فاتورة ${r.inv.number}`}
                    >
                      <td>
                        <div className="mono">{r.inv.number}</div>
                        <div className="t-muted">
                          {daysAgoLabel(diffDays(ds.today, r.inv.date))}
                          {r.inv.createdBy && " · جديدة"}
                        </div>
                      </td>
                      <td>
                        <div className="t-strong">{r.customer}</div>
                        <div className="t-muted">{r.area}</div>
                      </td>
                      <td>
                        <div>{r.items}</div>
                        <div className="dots" aria-label={`${r.colors.length} لون`}>
                          {r.colors.slice(0, 10).map((hex, i) => (
                            <span key={i} style={{ backgroundColor: hex }} />
                          ))}
                          {r.colors.length > 10 && <em className="num">+{r.colors.length - 10}</em>}
                        </div>
                      </td>
                      <td>
                        <span className={`chip chip--${r.inv.warehouseId}`}>
                          <span className={`wh-dot wh-dot--${r.inv.warehouseId}`} aria-hidden="true" />
                          {WH[r.inv.warehouseId]}
                        </span>
                      </td>
                      <td className="t-num">{fmtInt(r.inv.rollCount)}</td>
                      <td className="t-num t-muted">
                        {r.meters > 0 && <div>{fmtQty(Math.round(r.meters))} م</div>}
                        {r.kilos > 0 && <div>{fmtQty(Math.round(r.kilos))} كجم</div>}
                      </td>
                      <td className="t-num t-strong">{fmtMoney(r.inv.total)}</td>
                      <td className="t-num">{r.inv.total - r.inv.paidNow > 0.5 ? fmtMoney(r.inv.total - r.inv.paidNow) : "—"}</td>
                      <td>
                        <span className={`chip ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {filtered.length > limit && (
          <footer className="card__foot">
            <span className="num">
              معروض {fmtInt(limit)} من {fmtInt(filtered.length)}
            </span>
            <button type="button" className="link-btn" onClick={() => setLimit((l) => l + PAGE)}>
              عرض {PAGE} كمان <ChevronLeft size={14} aria-hidden="true" />
            </button>
          </footer>
        )}
      </section>
    </>
  );
}
