// src/features/customers/CustomersPage.tsx
"use client";

// العملاء: مين عليه كام، ومن إمتى، ومين عدّى حد الائتمان — والتحصيل بضغطة.
import { HandCoins, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { customerRows, sumAging } from "@/data/customers";
import { PERIOD_LABEL, periodRange } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";
import { daysAgoLabel, fmtInt, fmtMoney, fmtMoneyShort } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { AgingBar } from "./AgingBar";
import { CollectionForm } from "./CollectionForm";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type Filter = "all" | "debt" | "over" | "late";

export function CustomersPage() {
  const { ds, warehouse, period, openCustomer } = useDemo();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("debt");
  const [collectFor, setCollectFor] = useState<string | null>(null);

  const rows = useMemo(() => customerRows(ds, warehouse), [ds, warehouse]);
  const isLate = (r: (typeof rows)[number]) => r.overdue > 0.5 || (r.balance > 0.5 && (r.daysSincePayment ?? 0) > 40);

  const filtered = useMemo(() => {
    const n = q.trim();
    return rows.filter((r) => {
      if (n && !(r.customer.name.includes(n) || r.customer.area.includes(n) || r.customer.phone.replace(/\s/g, "").includes(n.replace(/\s/g, "")))) return false;
      if (filter === "debt") return r.balance > 0.5;
      if (filter === "over") return r.overLimit;
      if (filter === "late") return isLate(r);
      return true;
    });
  }, [rows, q, filter]);

  const stats = useMemo(() => {
    const { current } = periodRange(ds.today, period);
    const ids = new Set(rows.map((r) => r.customer.id));
    let collected = 0;
    for (const t of ds.cash) {
      if ((t.kind === "collection" || t.kind === "cash_sale") && t.partyId && ids.has(t.partyId) && t.date >= current.from) collected += t.amount;
    }
    return {
      total: rows.reduce((s, r) => s + Math.max(0, r.balance), 0),
      debtors: rows.filter((r) => r.balance > 0.5).length,
      over: rows.filter((r) => r.overLimit).length,
      overdue: rows.reduce((s, r) => s + r.overdue, 0),
      late: rows.filter(isLate).length,
      collected,
      aging: sumAging(rows.map((r) => r.aging)),
    };
  }, [rows, ds, period]);

  return (
    <>
      <section className="card toolbar" aria-label="أدوات العملاء">
        <label className="search search--inline">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">ابحث عن عميل</span>
          <input id="cust-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم العميل، المنطقة، أو رقم الموبايل" />
        </label>
        <Segmented<Filter>
          label="فلتر العملاء"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "debt", label: `عليهم فلوس (${stats.debtors})` },
            { value: "over", label: `فوق الحد (${stats.over})` },
            { value: "late", label: `متأخرين (${stats.late})` },
            { value: "all", label: "الكل" },
          ]}
        />
      </section>

      <section className="stat-strip" aria-label="ملخص العملاء">
        <div className="stat-tile">
          <span>إجمالي المستحقات</span>
          <strong className="num">{fmtMoneyShort(stats.total)}</strong>
        </div>
        <div className="stat-tile">
          <span>عملاء عليهم آجل</span>
          <strong className="num">{fmtInt(stats.debtors)}</strong>
        </div>
        <div className="stat-tile">
          <span>فوق حد الائتمان</span>
          <strong className="num" style={stats.over ? { color: "var(--crit)" } : undefined}>
            {fmtInt(stats.over)}
          </strong>
        </div>
        <div className="stat-tile">
          <span>ديون أقدم من 60 يوم</span>
          <strong className="num" style={stats.overdue > 0.5 ? { color: "var(--serious)" } : undefined}>
            {fmtMoneyShort(stats.overdue)}
          </strong>
        </div>
        <div className="stat-tile">
          <span>اتحصّل · {PERIOD_LABEL[period]}</span>
          <strong className="num amt-in">{fmtMoneyShort(stats.collected)}</strong>
        </div>
      </section>

      <section className="card">
        <header className="card__head">
          <div className="card__title">
            <span className="card__icon" aria-hidden="true">
              <UsersRound size={17} />
            </span>
            <div>
              <h3>أعمار الديون</h3>
              <p>الفلوس المستحقة متقسمة حسب عمر الفاتورة — كل دفعة بتسدّد أقدم فاتورة الأول</p>
            </div>
          </div>
        </header>
        <div className="card__body">
          <AgingBar aging={stats.aging} />
        </div>
      </section>

      <section className="card">
        <div className="card__body" style={{ paddingTop: 0 }}>
          {filtered.length === 0 ? (
            <p className="t-muted" style={{ padding: "24px 0" }}>
              مفيش عملاء بالفلتر ده.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table table--click">
                <thead>
                  <tr>
                    <th scope="col">العميل</th>
                    <th scope="col">المخزن</th>
                    <th scope="col" className="t-num">
                      الرصيد
                    </th>
                    <th scope="col">من حد الائتمان</th>
                    <th scope="col">أعمار الدين</th>
                    <th scope="col">آخر دفعة</th>
                    <th scope="col" className="t-num">
                      مشتريات 90 يوم
                    </th>
                    <th scope="col">
                      <span className="sr-only">إجراء</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const pct = Math.min(100, (Math.max(0, r.balance) / r.customer.creditLimit) * 100);
                    const late = (r.daysSincePayment ?? 0) > 40 && r.balance > 0.5;
                    return (
                      <tr
                        key={r.customer.id}
                        tabIndex={0}
                        onClick={() => openCustomer(r.customer.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openCustomer(r.customer.id);
                        }}
                        aria-label={`كشف حساب ${r.customer.name}`}
                      >
                        <td>
                          <div className="t-strong">{r.customer.name}</div>
                          <div className="t-muted">
                            {r.customer.area} · <span className="ltr num">{r.customer.phone}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`chip chip--${r.customer.homeWarehouseId}`}>
                            <span className={`wh-dot wh-dot--${r.customer.homeWarehouseId}`} aria-hidden="true" />
                            {WH[r.customer.homeWarehouseId]}
                          </span>
                        </td>
                        <td className="t-num t-strong">{r.balance > 0.5 ? fmtMoney(r.balance) : "—"}</td>
                        <td>
                          <div className="limit-cell">
                            <span className="bar-track" aria-hidden="true">
                              <span className="bar-fill" style={{ display: "block", width: `${pct}%`, background: r.overLimit ? "var(--crit)" : "var(--teal)" }} />
                            </span>
                            <span className="num" style={r.overLimit ? { color: "var(--crit)", fontWeight: 600 } : undefined}>
                              {r.overLimit ? "فوق الحد" : `${Math.round(pct)}٪`} <small className="t-muted">من {fmtMoneyShort(r.customer.creditLimit, false)}</small>
                            </span>
                          </div>
                        </td>
                        <td style={{ minWidth: 140 }}>
                          {r.balance > 0.5 ? <AgingBar aging={r.aging} size="sm" showLegend={false} /> : <span className="t-muted">—</span>}
                        </td>
                        <td>
                          <span style={late ? { color: "var(--crit)", fontWeight: 600 } : undefined}>
                            {r.daysSincePayment === null ? "—" : daysAgoLabel(r.daysSincePayment)}
                          </span>
                        </td>
                        <td className="t-num t-muted">{r.purchases90 > 0 ? fmtMoneyShort(r.purchases90, false) : "—"}</td>
                        <td>
                          {r.balance > 0.5 && (
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollectFor(r.customer.id);
                              }}
                            >
                              <HandCoins size={14} aria-hidden="true" /> تحصيل
                            </button>
                          )}
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

      {collectFor && (
        <Modal title="تسجيل تحصيل" subtitle={rows.find((r) => r.customer.id === collectFor)?.customer.name} icon={<HandCoins size={17} />} onClose={() => setCollectFor(null)}>
          <CollectionForm customerId={collectFor} onDone={() => setCollectFor(null)} />
        </Modal>
      )}
    </>
  );
}
