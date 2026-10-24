// src/features/inventory/InventoryPage.tsx
"use client";

// المخزون والطبخات: الصنف ← الطبخات ← التواب، مع البحث بكود التوب أو رقم الطبخة.
import { ArrowLeft, ChevronDown, PackageSearch, ReceiptText, ScanSearch, Search, Snowflake, Sun, Truck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { RollIcon } from "@/components/ui/RollIcon";
import {
  inventoryByItem,
  LOT_CODE_RE,
  LOT_STATUS_META,
  lookupRoll,
  normalizeRollCode,
  type ItemRow,
  type LotRow,
} from "@/data/inventory";
import type { Season, WarehouseId } from "@/data/types";
import { diffDays } from "@/lib/dates";
import { daysAgoLabel, fmtDayMonth, fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type SeasonFilter = "all" | Season;
type StatusFilter = "all" | "low" | "stagnant" | "new";

function RollResult({ code }: { code: string }) {
  const { ds, ix, setOpenLot, openInvoice, can } = useDemo();
  const r = useMemo(() => lookupRoll(ds, ix, code), [ds, ix, code]);
  if (!r) {
    return (
      <section className="card roll-result roll-result--none">
        <ScanSearch size={22} aria-hidden="true" />
        <p>
          مفيش توب بالكود <b className="ltr mono">{code}</b>. اتأكد من رقم الطبخة ورقم التوب.
        </p>
      </section>
    );
  }
  const unit = r.item.unit === "kg" ? "كجم" : "م";
  const hidden = r.roll.status === "available" && !can.access(r.roll.warehouseId);
  return (
    <section className="card roll-result" aria-live="polite">
      <span className="lot-swatch lot-swatch--lg" style={{ backgroundColor: r.colorHex }} aria-hidden="true" />
      <div className="roll-result__main">
        <p className="t-muted">نتيجة البحث بكود التوب</p>
        <h2>
          <span className="ltr mono">{r.roll.code}</span> · {r.item.name} {r.colorName}
        </h2>
        <p className="num">
          طبخة {r.lot.code} · {fmtQty(r.roll.quantity)} {unit} · اتسلم {fmtDayMonth(r.roll.receivedOn)}
        </p>
      </div>
      <div className="roll-result__state">
        {r.roll.status === "available" && (
          <>
            <span className="chip chip--good">متاح</span>
            <b>
              <span className={`wh-dot wh-dot--${r.roll.warehouseId}`} aria-hidden="true" /> في مخزن {WH[r.roll.warehouseId]}
            </b>
            {r.transfer && <small className="t-muted">وصل بتحويل {r.transfer.number}</small>}
          </>
        )}
        {r.roll.status === "in_transit" && (
          <>
            <span className="chip chip--warn">
              <Truck size={11} aria-hidden="true" /> في الطريق
            </span>
            <b>{r.transfer ? `${WH[r.transfer.fromWarehouseId]} ← ${WH[r.transfer.toWarehouseId]}` : ""}</b>
            <small className="t-muted">{r.transfer ? `${r.transfer.number} · السواق ${r.transfer.driver}` : ""}</small>
          </>
        )}
        {r.roll.status === "sold" && (
          <>
            <span className="chip chip--info">اتباع {r.roll.soldOn ? daysAgoLabel(diffDays(ds.today, r.roll.soldOn)) : ""}</span>
            <b>{r.customerName}</b>
            {r.invoice && (
              <button type="button" className="link-btn" onClick={() => openInvoice(r.invoice!.id)}>
                <ReceiptText size={13} aria-hidden="true" /> فاتورة <span className="mono">{r.invoice.number}</span>
              </button>
            )}
          </>
        )}
      </div>
      {!hidden && (
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpenLot({ lotId: r.lot.id, rollId: r.roll.id })}>
          كل تواب الطبخة <ArrowLeft size={14} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function LotTable({
  row,
  lots,
  showValue,
  showSplit,
  highlightLot,
  today,
}: {
  row: ItemRow;
  lots: LotRow[];
  showValue: boolean;
  showSplit: boolean;
  highlightLot: string | null;
  today: string;
}) {
  const { setOpenLot } = useDemo();
  const unit = row.item.unit === "kg" ? "كجم" : "م";
  if (lots.length === 0) return <p className="t-muted inv-empty">مفيش طبخات بالفلتر ده.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--click">
        <thead>
          <tr>
            <th scope="col">الطبخة</th>
            <th scope="col">اللون</th>
            <th scope="col">المورد</th>
            <th scope="col">اتسلمت</th>
            <th scope="col">التواب المتاحة</th>
            <th scope="col" className="t-num">
              الكمية
            </th>
            {showSplit && <th scope="col">التوزيع</th>}
            {showValue && (
              <th scope="col" className="t-num">
                التكلفة
              </th>
            )}
            <th scope="col">آخر بيع</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => {
            const used = l.lot.rollCount > 0 ? Math.min(100, (l.available / l.lot.rollCount) * 100) : 0;
            return (
              <tr
                key={l.lot.id}
                className={highlightLot === l.lot.code ? "is-hl" : ""}
                tabIndex={0}
                onClick={() => setOpenLot({ lotId: l.lot.id })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenLot({ lotId: l.lot.id });
                  }
                }}
                aria-label={`تفاصيل طبخة ${l.lot.code}`}
              >
                <td>
                  <div className="mono t-strong">{l.lot.code}</div>
                  <span className={`chip ${LOT_STATUS_META[l.status].cls}`}>{LOT_STATUS_META[l.status].label}</span>
                </td>
                <td>
                  <span className="color-tag color-tag--sm">
                    <span className="color-tag__chip" style={{ backgroundColor: l.colorHex }} aria-hidden="true" />
                    {l.colorName}
                  </span>
                </td>
                <td className="t-muted">{l.supplierName}</td>
                <td>
                  <div className="num">{fmtDayMonth(l.lot.receivedOn)}</div>
                  <div className="t-muted">{daysAgoLabel(l.ageDays)}</div>
                </td>
                <td>
                  <div className="num">
                    <b>{l.available}</b> <span className="t-muted">من {l.lot.rollCount}</span>
                    {l.inTransit > 0 && (
                      <span className="chip chip--warn num" style={{ marginInlineStart: 6 }}>
                        +{l.inTransit} في الطريق
                      </span>
                    )}
                  </div>
                  <div className="lot-mini" aria-hidden="true">
                    <span style={{ width: `${used}%` }} />
                  </div>
                </td>
                <td className="t-num">
                  {fmtQty(Math.round(l.availableQty))} {unit}
                </td>
                {showSplit && (
                  <td>
                    <span className="split-mini num">
                      <span>
                        <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" /> {l.byWarehouse.kerdasa}
                      </span>
                      <span>
                        <span className="wh-dot wh-dot--mahalla" aria-hidden="true" /> {l.byWarehouse.mahalla}
                      </span>
                    </span>
                  </td>
                )}
                {showValue && (
                  <td className="t-num">
                    <div>{fmtMoney(l.availableQty * l.lot.unitCost)}</div>
                    <div className="t-muted">{fmtMoney(l.lot.unitCost)}/{row.item.unit === "kg" ? "كجم" : "م"}</div>
                  </td>
                )}
                <td className="t-muted">{l.lastSale ? daysAgoLabel(diffDays(today, l.lastSale)) : "لسه"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function InventoryPage() {
  const { ds, ix, warehouse, can, inventoryQuery, setInventoryQuery, setOpenLot } = useDemo();
  const [q, setQ] = useState(inventoryQuery);
  const [season, setSeason] = useState<SeasonFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showFinished, setShowFinished] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // البحث من الشريط العلوي
  useEffect(() => {
    if (inventoryQuery) {
      setQ(inventoryQuery);
      setInventoryQuery("");
    }
  }, [inventoryQuery, setInventoryQuery]);

  const rows = useMemo(() => inventoryByItem(ds, ix, warehouse), [ds, ix, warehouse]);
  const rollCode = normalizeRollCode(q);
  const needle = rollCode ? "" : q.trim();
  const lotCode = LOT_CODE_RE.test(needle) ? needle : null;

  const filtered = useMemo(() => {
    return rows
      .filter((r) => season === "all" || r.item.season === season)
      .map((r) => {
        const itemMatch = !needle || r.item.name.includes(needle);
        const lots = r.lots.filter((l) => {
          if (!showFinished && l.status === "finished" && l.inTransit === 0) return false;
          if (status !== "all" && l.status !== status) return false;
          if (needle && !itemMatch) {
            return l.lot.code.includes(needle) || l.colorName.includes(needle) || l.supplierName.includes(needle);
          }
          return true;
        });
        return { row: r, lots };
      })
      .filter(({ row, lots }) => lots.length > 0 || (!needle && status === "all" && row.rolls > 0));
  }, [rows, season, status, showFinished, needle]);

  const totals = useMemo(() => {
    let rolls = 0;
    let meters = 0;
    let kilos = 0;
    let value = 0;
    let low = 0;
    let stagnant = 0;
    let active = 0;
    for (const r of rows) {
      if (season !== "all" && r.item.season !== season) continue;
      rolls += r.rolls;
      value += r.value;
      if (r.item.unit === "kg") kilos += r.qty;
      else meters += r.qty;
      for (const l of r.lots) {
        if (l.status === "low") low++;
        if (l.status === "stagnant") stagnant++;
        if (l.available > 0) active++;
      }
    }
    return { rolls, meters, kilos, value, low, stagnant, active };
  }, [rows, season]);

  const isOpen = (id: string) => expanded.has(id) || !!needle || status !== "all";
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exactLot = lotCode ? ds.lots.find((l) => l.code === lotCode) : undefined;

  return (
    <>
      <section className="card toolbar" aria-label="أدوات المخزون">
        <form
          className="search search--inline"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (exactLot) setOpenLot({ lotId: exactLot.id });
          }}
        >
          <Search size={16} aria-hidden="true" />
          <label htmlFor="inv-search" className="sr-only">
            بحث في المخزون
          </label>
          <input
            id="inv-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            dir="auto"
            placeholder="كود التوب، رقم الطبخة، الصنف، اللون، أو المورد"
            autoComplete="off"
          />
          {q && (
            <button type="button" className="search__clear" onClick={() => setQ("")} aria-label="مسح البحث">
              <X size={14} />
            </button>
          )}
        </form>
        <Segmented<SeasonFilter>
          label="الموسم"
          size="sm"
          value={season}
          onChange={setSeason}
          options={[
            { value: "all", label: "الكل" },
            {
              value: "winter",
              label: (
                <>
                  <Snowflake size={13} aria-hidden="true" /> شتوي
                </>
              ),
            },
            {
              value: "summer",
              label: (
                <>
                  <Sun size={13} aria-hidden="true" /> صيفي
                </>
              ),
            },
          ]}
        />
        <Segmented<StatusFilter>
          label="حالة الطبخة"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "كل الطبخات" },
            { value: "low", label: `قربت تخلص (${totals.low})` },
            { value: "stagnant", label: `راكدة (${totals.stagnant})` },
            { value: "new", label: "جديدة" },
          ]}
        />
        <label className="check">
          <input id="show-finished" type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />
          اعرض الطبخات اللي خلصت
        </label>
      </section>

      {rollCode && <RollResult code={rollCode} />}
      {exactLot && !rollCode && (
        <p className="lot-hint">
          لقينا طبخة <b className="mono">{exactLot.code}</b> —{" "}
          <button type="button" className="link-btn" onClick={() => setOpenLot({ lotId: exactLot.id })}>
            افتح كل تواب الطبخة
          </button>
        </p>
      )}

      <section className={`stat-strip ${can.seeProfit ? "" : "stat-strip--4"}`} aria-label="ملخص المخزون">
        <div className="stat-tile">
          <span>التواب المتاحة{warehouse !== "all" ? ` · ${WH[warehouse]}` : ""}</span>
          <strong className="num">{fmtInt(totals.rolls)}</strong>
        </div>
        <div className="stat-tile">
          <span>بالمتر (صيفي)</span>
          <strong className="num">{fmtInt(totals.meters)} م</strong>
        </div>
        <div className="stat-tile">
          <span>بالكيلو (شتوي)</span>
          <strong className="num">{fmtInt(totals.kilos)} كجم</strong>
        </div>
        <div className="stat-tile">
          <span>طبخات فيها بضاعة</span>
          <strong className="num">{fmtInt(totals.active)}</strong>
        </div>
        {can.seeProfit && (
          <div className="stat-tile">
            <span>قيمة المخزون بالتكلفة</span>
            <strong className="num">{fmtMoneyShort(totals.value)}</strong>
          </div>
        )}
      </section>

      {!rollCode && filtered.length === 0 && (
        <div className="card empty">
          <PackageSearch size={28} aria-hidden="true" />
          <p>مفيش نتايج للبحث ده.</p>
        </div>
      )}

      <div className="inv-list">
        {filtered.map(({ row, lots }) => {
          const open = isOpen(row.item.id);
          const unit = row.item.unit === "kg" ? "كجم" : "م";
          const max = Math.max(1, row.byWarehouse.kerdasa + row.byWarehouse.mahalla);
          return (
            <section key={row.item.id} className={`card inv-item ${open ? "inv-item--open" : ""}`}>
              <button type="button" className="inv-item__head" aria-expanded={open} onClick={() => toggle(row.item.id)}>
                <span className="inv-item__name">
                  <strong>{row.item.name}</strong>
                  <span className="t-muted">
                    {row.item.season === "winter" ? <Snowflake size={12} aria-hidden="true" /> : <Sun size={12} aria-hidden="true" />}{" "}
                    {row.item.season === "winter" ? "شتوي · بالكيلو" : "صيفي · بالمتر"}
                  </span>
                </span>
                <span className="inv-item__colors" aria-label={`${row.colorsAvailable} من ${row.item.colorIds.length} لون متاح`}>
                  <span className="dots dots--lg">
                    {row.item.colorIds.map((cid) => {
                      const has = row.lots.some((l) => l.lot.colorId === cid && l.available > 0);
                      return <span key={cid} className={has ? "" : "is-out"} style={{ backgroundColor: has ? ix.colorById.get(cid)?.hex : undefined }} />;
                    })}
                  </span>
                  <small className="num">
                    {row.colorsAvailable}/{row.item.colorIds.length} لون
                  </small>
                </span>
                <span className="inv-item__stat inv-item__stat--rolls num">
                  <RollIcon size={14} /> <b>{fmtInt(row.rolls)}</b> توب
                  {row.inTransit > 0 && <small> +{row.inTransit} في الطريق</small>}
                </span>
                <span className="inv-item__stat inv-item__stat--qty num">
                  {fmtInt(Math.round(row.qty))} {unit}
                </span>
                {warehouse === "all" && (
                  <span className="inv-item__split" aria-label={`كرداسة ${row.byWarehouse.kerdasa} توب، المحلة ${row.byWarehouse.mahalla} توب`}>
                    <span className="split-bar" aria-hidden="true">
                      <span style={{ width: `${(row.byWarehouse.kerdasa / max) * 100}%`, background: "var(--wh-kerdasa)" }} />
                      <span style={{ width: `${(row.byWarehouse.mahalla / max) * 100}%`, background: "var(--wh-mahalla)" }} />
                    </span>
                    <small className="num">
                      كرداسة {row.byWarehouse.kerdasa} · المحلة {row.byWarehouse.mahalla}
                    </small>
                  </span>
                )}
                {can.seeProfit && <span className="inv-item__stat inv-item__stat--value num t-muted">{fmtMoneyShort(row.value)}</span>}
                <ChevronDown size={18} className="inv-item__chev" aria-hidden="true" />
              </button>
              {open && (
                <div className="inv-item__body">
                  <LotTable row={row} lots={lots} showValue={can.seeProfit} showSplit={warehouse === "all"} highlightLot={lotCode} today={ds.today} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
