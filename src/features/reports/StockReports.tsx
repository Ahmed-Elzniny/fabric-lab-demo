// src/features/reports/StockReports.tsx
"use client";

// حركة الأصناف (كل لون بيكفي كام يوم + اقتراح الشراء) والمخزون الراكد.
import { Gauge, PackageX, ShoppingCart, Snowflake, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { itemVelocity, stagnantStock, VELOCITY_META, type VelocityStatus } from "@/data/reports";
import { fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { CopyButton } from "./CopyButton";

type VFilter = "all" | VelocityStatus;

export function VelocityReport() {
  const { ds, ix, warehouse, period, setView } = useDemo();
  const [filter, setFilter] = useState<VFilter>("reorder");
  const rows = useMemo(() => itemVelocity(ds, ix, warehouse, period), [ds, ix, warehouse, period]);
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const maxCover = 60;

  return (
    <Card
      icon={<Gauge size={17} />}
      title="حركة الأصناف واقتراح الشراء"
      subtitle="كل لون بيكفي كام يوم شغل بمعدل البيع الحالي — أقل من 21 يوم يبقى لازم تطلب، واقتراح الكمية بيغطي 45 يوم"
      actions={
        <div className="toolbar__actions">
          <Segmented<VFilter>
            label="الحالة"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "reorder", label: `اطلب تاني (${counts.reorder ?? 0})` },
              { value: "ok", label: `كويس (${counts.ok ?? 0})` },
              { value: "excess", label: `زيادة (${counts.excess ?? 0})` },
              { value: "idle", label: `واقف (${counts.idle ?? 0})` },
              { value: "all", label: "الكل" },
            ]}
          />
          <CopyButton
            headers={["الصنف", "اللون", "اتباع (توب)", "في الأسبوع", "المخزون", "في الطريق", "يكفي (يوم)", "الحالة", "اقتراح الطلب (توب)"]}
            rows={shown.map((r) => [r.itemName, r.colorName, r.soldRolls, Number(r.perWeek.toFixed(1)), r.stockRolls, r.inTransit, r.coverDays === null ? "" : Math.round(r.coverDays), VELOCITY_META[r.status].label, r.suggest])}
          />
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="t-muted">مفيش ألوان بالحالة دي.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">الصنف واللون</th>
                <th scope="col" className="t-num">
                  اتباع
                </th>
                <th scope="col" className="t-num">
                  في الأسبوع
                </th>
                <th scope="col" className="t-num">
                  المخزون
                </th>
                <th scope="col">يكفي قد إيه</th>
                <th scope="col">الحالة</th>
                <th scope="col" className="t-num">
                  اقتراح الطلب
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const cover = r.coverDays === null ? null : Math.round(r.coverDays);
                const w = cover === null ? 0 : Math.min(100, (cover / maxCover) * 100);
                const barColor = r.status === "reorder" ? "var(--crit)" : r.status === "excess" ? "var(--warn)" : "var(--good)";
                return (
                  <tr key={`${r.itemId}-${r.colorId}`}>
                    <td>
                      <span className="color-tag color-tag--sm">
                        <span className="color-tag__chip" style={{ backgroundColor: r.colorHex }} aria-hidden="true" />
                        <b>{r.itemName}</b> {r.colorName}
                      </span>
                      <div className="t-muted">
                        {r.season === "winter" ? <Snowflake size={11} aria-hidden="true" /> : <Sun size={11} aria-hidden="true" />} {r.season === "winter" ? "شتوي" : "صيفي"}
                      </div>
                    </td>
                    <td className="t-num">{fmtInt(r.soldRolls)} توب</td>
                    <td className="t-num t-muted">{fmtQty(Math.round(r.perWeek * 10) / 10)}</td>
                    <td className="t-num">
                      {fmtInt(r.stockRolls)}
                      {r.inTransit > 0 && <small className="t-muted"> +{r.inTransit} في الطريق</small>}
                    </td>
                    <td style={{ minWidth: 150 }}>
                      {cover === null ? (
                        <span className="t-muted">مفيش بيع</span>
                      ) : (
                        <div className="cover">
                          <span className="cover__bar" aria-hidden="true">
                            <span style={{ width: `${w}%`, background: barColor }} />
                            <i style={{ right: `${(21 / maxCover) * 100}%` }} />
                          </span>
                          <span className="num">{cover > 365 ? "+سنة" : `${cover} يوم`}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`chip ${VELOCITY_META[r.status].cls}`}>{VELOCITY_META[r.status].label}</span>
                    </td>
                    <td className="t-num t-strong">{r.suggest > 0 ? `${r.suggest} توب` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filter === "reorder" && shown.length > 0 && (
        <div className="report-cta">
          <ShoppingCart size={16} aria-hidden="true" />
          <span>
            محتاج تطلب <b className="num">{fmtInt(shown.reduce((s, r) => s + r.suggest, 0))} توب</b> في {shown.length} لون عشان ماتقعش في عجز.
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setView("purchases_new")}>
            سجّل استلام بضاعة
          </button>
        </div>
      )}
    </Card>
  );
}

export function StagnantReport() {
  const { ds, ix, warehouse, can, setOpenLot } = useDemo();
  const [minIdle, setMinIdle] = useState<"30" | "45" | "90">("45");
  const rows = useMemo(() => stagnantStock(ds, ix, warehouse, Number(minIdle)), [ds, ix, warehouse, minIdle]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const rolls = rows.reduce((s, r) => s + r.rolls, 0);

  return (
    <Card
      icon={<PackageX size={17} />}
      title="المخزون الراكد"
      subtitle={`${fmtInt(rolls)} توب في ${rows.length} طبخة مفيش منها بيع من ${minIdle} يوم أو أكتر${can.seeProfit ? ` · قيمتهم ${fmtMoneyShort(total)}` : ""}`}
      actions={
        <div className="toolbar__actions">
          <Segmented<"30" | "45" | "90">
            label="مدة الركود"
            size="sm"
            value={minIdle}
            onChange={setMinIdle}
            options={[
              { value: "30", label: "30+ يوم" },
              { value: "45", label: "45+ يوم" },
              { value: "90", label: "90+ يوم" },
            ]}
          />
          <CopyButton
            headers={["الطبخة", "الصنف", "اللون", "التواب", "الكمية", "القيمة بالتكلفة", "أيام من غير بيع", "كرداسة", "المحلة"]}
            rows={rows.map((r) => [r.lotCode, r.itemName, r.colorName, r.rolls, Math.round(r.qty), Math.round(r.value), r.idleDays, r.byWarehouse.kerdasa, r.byWarehouse.mahalla])}
          />
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="t-muted">مفيش مخزون راكد بالمدة دي — البضاعة كلها بتتحرك.</p>
      ) : (
        <div className="table-wrap">
          <table className="table table--click">
            <thead>
              <tr>
                <th scope="col">الطبخة</th>
                <th scope="col">الصنف واللون</th>
                <th scope="col" className="t-num">
                  التواب
                </th>
                <th scope="col" className="t-num">
                  الكمية
                </th>
                {can.seeProfit && (
                  <th scope="col" className="t-num">
                    القيمة بالتكلفة
                  </th>
                )}
                <th scope="col">من غير بيع</th>
                <th scope="col">فين</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lotId} tabIndex={0} onClick={() => setOpenLot({ lotId: r.lotId })} onKeyDown={(e) => e.key === "Enter" && setOpenLot({ lotId: r.lotId })}>
                  <td className="mono t-strong">{r.lotCode}</td>
                  <td>
                    <span className="color-tag color-tag--sm">
                      <span className="color-tag__chip" style={{ backgroundColor: r.colorHex }} aria-hidden="true" />
                      <b>{r.itemName}</b> {r.colorName}
                    </span>
                    <div className="t-muted">{r.season === "winter" ? "شتوي" : "صيفي"}</div>
                  </td>
                  <td className="t-num">{fmtInt(r.rolls)}</td>
                  <td className="t-num t-muted">
                    {fmtQty(Math.round(r.qty))} {r.unit === "kg" ? "كجم" : "م"}
                  </td>
                  {can.seeProfit && <td className="t-num t-strong">{fmtMoney(r.value)}</td>}
                  <td>
                    <span className={`chip ${r.idleDays >= 90 ? "chip--crit" : "chip--warn"} num`}>{r.idleDays} يوم</span>
                  </td>
                  <td>
                    <span className="split-mini num">
                      {r.byWarehouse.kerdasa > 0 && (
                        <span>
                          <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" /> {r.byWarehouse.kerdasa}
                        </span>
                      )}
                      {r.byWarehouse.mahalla > 0 && (
                        <span>
                          <span className="wh-dot wh-dot--mahalla" aria-hidden="true" /> {r.byWarehouse.mahalla}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <p className="pnl__note">اقتراح: عرض تصفية على الطبخات دي، أو تحويلها للمخزن التاني لو الصنف ماشي هناك.</p>
      )}
    </Card>
  );
}
