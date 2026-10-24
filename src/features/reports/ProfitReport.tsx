// src/features/reports/ProfitReport.tsx
"use client";

// الربحية: أرباح وخسائر مبسّطة + الربح بالصنف (رسم) + أكتر العملاء ربحاً.
import { Award, Scale, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DeltaChip } from "@/components/ui/DeltaChip";
import { profitAndLoss, profitByCustomer, profitByItem, type ProfitRow } from "@/data/reports";
import { PERIOD_LABEL } from "@/data/selectors";
import { fmtAxis, fmtInt, fmtMoney, fmtMoneyShort, fmtQty } from "@/lib/format";
import { useThemeColors } from "@/lib/useThemeColors";
import { useDemo } from "@/store/DemoProvider";
import { CopyButton } from "./CopyButton";

function PnLRow({ label, value, base, kind, note }: { label: string; value: number; base: number; kind: "base" | "minus" | "result"; note?: string }) {
  const pct = base > 0 ? Math.min(100, (Math.abs(value) / base) * 100) : 0;
  return (
    <div className={`pnl__row pnl__row--${kind}`}>
      <span className="pnl__label">
        {kind === "minus" ? "− " : kind === "result" ? "= " : ""}
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className="pnl__bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <b className="num">{fmtMoney(value)}</b>
      <span className="pnl__pct num">{base > 0 ? `${((value / base) * 100).toFixed(1)}٪` : ""}</span>
    </div>
  );
}

export function ProfitReport() {
  const { ds, ix, warehouse, period } = useDemo();
  const colors = useThemeColors();
  const pnl = useMemo(() => profitAndLoss(ds, warehouse, period), [ds, warehouse, period]);
  const items = useMemo(() => profitByItem(ds, ix, warehouse, period), [ds, ix, warehouse, period]);
  const customers = useMemo(() => profitByCustomer(ds, ix, warehouse, period), [ds, ix, warehouse, period]);
  const delta = pnl.previousNet !== null && pnl.previousNet !== 0 ? ((pnl.net - pnl.previousNet) / Math.abs(pnl.previousNet)) * 100 : null;
  const avgMargin = pnl.grossMargin;

  const itemRows = (rows: ProfitRow[]) =>
    rows.map((r) => [r.name, r.sub ?? "", Math.round(r.sales), Math.round(r.cost), Math.round(r.profit), Number(r.margin.toFixed(1)), r.rolls, Math.round(r.qty)]);

  return (
    <>
      <div className="grid">
        <Card
          className="span-5"
          icon={<Scale size={17} />}
          title="الأرباح والخسائر المبسّطة"
          subtitle={`${PERIOD_LABEL[period]} · ${fmtInt(pnl.invoices)} فاتورة`}
          footer={
            <>
              <span>صافي الربح التشغيلي</span>
              <span className="kpi__meta" style={{ minHeight: 0 }}>
                <DeltaChip delta={delta} />
              </span>
            </>
          }
        >
          <div className="pnl">
            <PnLRow label="المبيعات" value={pnl.sales} base={pnl.sales} kind="base" note={pnl.discounts > 0 ? `بعد خصومات ${fmtMoneyShort(pnl.discounts)}` : undefined} />
            <PnLRow label="تكلفة البضاعة المباعة" value={pnl.cogs} base={pnl.sales} kind="minus" note="شاملة النقل والتحميل" />
            <PnLRow label="مجمل الربح" value={pnl.gross} base={pnl.sales} kind="result" />
            <PnLRow label="المرتبات والأسبوعيات" value={pnl.labor} base={pnl.sales} kind="minus" />
            <PnLRow label="مصروفات التشغيل" value={pnl.opex} base={pnl.sales} kind="minus" note="كهرباء، بنزين، ضيافة، صيانة…" />
            <PnLRow label="صافي الربح التشغيلي" value={pnl.net} base={pnl.sales} kind="result" />
          </div>
          <p className="pnl__note">السلف مش مصروف — دي فلوس راجعة من القبضة. ومصاريف نقل المشتريات داخلة في تكلفة الطبخات.</p>
        </Card>

        <Card
          className="span-7"
          icon={<Award size={17} />}
          title="مجمل الربح بالصنف"
          subtitle={`الرقم جنب الصنف = الهامش · العمود الأفتح = هامش أقل من المتوسط (${avgMargin.toFixed(1)}٪)`}
          actions={<CopyButton headers={["الصنف", "الموسم", "المبيعات", "التكلفة", "مجمل الربح", "الهامش ٪", "التواب", "الكمية"]} rows={itemRows(items)} />}
        >
          {items.length === 0 ? (
            <p className="t-muted">مفيش مبيعات في الفترة دي.</p>
          ) : (
            <>
              <div className="chart-box" style={{ height: Math.max(220, items.length * 40 + 30) }} role="img" aria-label="رسم أعمدة لمجمل الربح بالصنف">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={items} layout="vertical" margin={{ top: 4, right: 0, bottom: 0, left: 8 }} barCategoryGap="26%">
                    <CartesianGrid horizontal={false} stroke={colors.line} strokeDasharray="3 4" />
                    <XAxis type="number" reversed tickLine={false} axisLine={false} tick={{ fill: colors.fg3, fontSize: 11 }} tickFormatter={(v: number) => fmtAxis(v)} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      width={150}
                      tick={(p: { x: number; y: number; payload: { value: string } }) => {
                        const r = items.find((x) => x.name === p.payload.value);
                        return (
                          <text x={p.x} y={p.y} dy={4} direction="rtl" textAnchor="end" fontSize={12.5} fontFamily="inherit">
                            <tspan fill={colors.fg} fontWeight={600}>
                              {p.payload.value}
                            </tspan>
                            {r && <tspan fill={colors.fg3}>{` · ${r.margin.toFixed(1)}٪`}</tspan>}
                          </text>
                        );
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: colors.line, opacity: 0.45 }}
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        const r = payload?.[0]?.payload as ProfitRow | undefined;
                        if (!active || !r) return null;
                        return (
                          <div className="tooltip">
                            <div className="tooltip__title">{r.name}</div>
                            <div className="tooltip__row">
                              <span />
                              <span>المبيعات</span>
                              <b>{fmtMoney(r.sales)}</b>
                            </div>
                            <div className="tooltip__row">
                              <span />
                              <span>التكلفة</span>
                              <b>{fmtMoney(r.cost)}</b>
                            </div>
                            <div className="tooltip__row tooltip__total">
                              <span />
                              <span>مجمل الربح · {r.margin.toFixed(1)}٪</span>
                              <b>{fmtMoney(r.profit)}</b>
                            </div>
                            <div className="tooltip__row">
                              <span />
                              <span>
                                {fmtInt(r.rolls)} توب · {fmtQty(Math.round(r.qty))} {r.unit === "kg" ? "كجم" : "م"}
                              </span>
                              <b />
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="profit" radius={[4, 0, 0, 4]} isAnimationActive={false} maxBarSize={22}>
                      {items.map((r) => (
                        <Cell key={r.id} fill={colors.teal} fillOpacity={r.margin >= avgMargin ? 1 : 0.45} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </div>

      <Card
        icon={<UsersRound size={17} />}
        title="الربح بالعميل"
        subtitle={`أكتر العملاء اللي بيكسّبوك · ${PERIOD_LABEL[period]}`}
        actions={<CopyButton headers={["العميل", "المنطقة", "المبيعات", "التكلفة", "مجمل الربح", "الهامش ٪", "التواب", "الفواتير"]} rows={customers.map((r) => [r.name, r.sub ?? "", Math.round(r.sales), Math.round(r.cost), Math.round(r.profit), Number(r.margin.toFixed(1)), r.rolls, r.invoices])} />}
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">العميل</th>
                <th scope="col" className="t-num">
                  الفواتير
                </th>
                <th scope="col" className="t-num">
                  التواب
                </th>
                <th scope="col" className="t-num">
                  المبيعات
                </th>
                <th scope="col" className="t-num">
                  مجمل الربح
                </th>
                <th scope="col">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="t-strong">{r.name}</div>
                    <div className="t-muted">{r.sub}</div>
                  </td>
                  <td className="t-num">{r.invoices}</td>
                  <td className="t-num">{fmtInt(r.rolls)}</td>
                  <td className="t-num">{fmtMoney(r.sales)}</td>
                  <td className="t-num t-strong">{fmtMoney(r.profit)}</td>
                  <td>
                    <span className={`chip ${r.margin >= avgMargin ? "chip--good" : "chip--warn"} num`}>{r.margin.toFixed(1)}٪</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
