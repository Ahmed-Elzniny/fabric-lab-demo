// src/features/reports/ReportsPage.tsx
"use client";

// التقارير: الربحية، حركة الأصناف، الراكد، وحركة الخزن. الفلاتر اللي فوق (المخزن والفترة) بتطبّق على الكل.
import { ArrowDownLeft, ArrowUpRight, BarChart3, Gauge, PackageX, Scale, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { CASH_KIND_LABEL, cashFlow } from "@/data/reports";
import { PERIOD_LABEL } from "@/data/selectors";
import { fmtMoney, fmtMoneyShort } from "@/lib/format";
import { useDemo } from "@/store/DemoProvider";
import { CopyButton } from "./CopyButton";
import { ProfitReport } from "./ProfitReport";
import { StagnantReport, VelocityReport } from "./StockReports";

type Tab = "profit" | "velocity" | "stagnant" | "cash";

function CashFlowReport() {
  const { ds, warehouse, period } = useDemo();
  const cf = useMemo(() => cashFlow(ds, warehouse, period), [ds, warehouse, period]);
  const max = Math.max(1, ...cf.rows.map((r) => r.total));
  const showSplit = warehouse === "all";
  const section = (dir: "in" | "out") => cf.rows.filter((r) => r.direction === dir);

  return (
    <Card
      icon={<Wallet size={17} />}
      title="حركة الخزن"
      subtitle={`النقدي اللي دخل وخرج من كل خزنة · ${PERIOD_LABEL[period]}`}
      actions={
        <CopyButton
          headers={["النوع", "الاتجاه", "كرداسة", "المحلة", "الإجمالي"]}
          rows={cf.rows.map((r) => [CASH_KIND_LABEL[r.kind], r.direction === "in" ? "وارد" : "منصرف", Math.round(r.kerdasa), Math.round(r.mahalla), Math.round(r.total)])}
        />
      }
    >
      <div className="cashflow-sum">
        <div>
          <span>
            <ArrowDownLeft size={14} aria-hidden="true" /> وارد
          </span>
          <b className="num amt-in">{fmtMoneyShort(cf.inflow.total)}</b>
        </div>
        <div>
          <span>
            <ArrowUpRight size={14} aria-hidden="true" /> منصرف
          </span>
          <b className="num amt-out">{fmtMoneyShort(cf.outflow.total)}</b>
        </div>
        <div>
          <span>الصافي</span>
          <b className="num">{fmtMoneyShort(cf.inflow.total - cf.outflow.total)}</b>
        </div>
        {cf.nonCash > 0 && (
          <div>
            <span>تحصيلات بنك وإنستاباي</span>
            <b className="num">{fmtMoneyShort(cf.nonCash)}</b>
          </div>
        )}
      </div>
      {(["in", "out"] as const).map((dir) => (
        <div key={dir} className="cashflow-group">
          <h4>{dir === "in" ? "الوارد" : "المنصرف"}</h4>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">النوع</th>
                  <th scope="col" style={{ width: "34%" }}>
                    <span className="sr-only">الحجم</span>
                  </th>
                  {showSplit && (
                    <th scope="col" className="t-num">
                      كرداسة
                    </th>
                  )}
                  {showSplit && (
                    <th scope="col" className="t-num">
                      المحلة
                    </th>
                  )}
                  <th scope="col" className="t-num">
                    الإجمالي
                  </th>
                </tr>
              </thead>
              <tbody>
                {section(dir).map((r) => (
                  <tr key={r.kind}>
                    <td className="t-strong">{CASH_KIND_LABEL[r.kind]}</td>
                    <td>
                      <span className="cf-bar" aria-hidden="true">
                        {showSplit ? (
                          <>
                            <span style={{ width: `${(r.kerdasa / max) * 100}%`, background: "var(--wh-kerdasa)" }} />
                            <span style={{ width: `${(r.mahalla / max) * 100}%`, background: "var(--wh-mahalla)" }} />
                          </>
                        ) : (
                          <span style={{ width: `${(r.total / max) * 100}%`, background: dir === "in" ? "var(--good)" : "var(--serious)" }} />
                        )}
                      </span>
                    </td>
                    {showSplit && <td className="t-num">{fmtMoney(r.kerdasa)}</td>}
                    {showSplit && <td className="t-num">{fmtMoney(r.mahalla)}</td>}
                    <td className={`t-num t-strong ${dir === "in" ? "amt-in" : "amt-out"}`}>{fmtMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {showSplit && (
        <div className="legend" style={{ marginTop: 10 }}>
          <span className="legend__item">
            <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" /> خزنة كرداسة
          </span>
          <span className="legend__item">
            <span className="wh-dot wh-dot--mahalla" aria-hidden="true" /> خزنة المحلة
          </span>
        </div>
      )}
    </Card>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("profit");
  return (
    <>
      <section className="card toolbar" aria-label="التقارير">
        <Segmented<Tab>
          label="التقرير"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "profit",
              label: (
                <>
                  <Scale size={14} aria-hidden="true" /> الربحية
                </>
              ),
            },
            {
              value: "velocity",
              label: (
                <>
                  <Gauge size={14} aria-hidden="true" /> حركة الأصناف
                </>
              ),
            },
            {
              value: "stagnant",
              label: (
                <>
                  <PackageX size={14} aria-hidden="true" /> الراكد
                </>
              ),
            },
            {
              value: "cash",
              label: (
                <>
                  <Wallet size={14} aria-hidden="true" /> حركة الخزن
                </>
              ),
            },
          ]}
        />
        <p className="toolbar__text" style={{ textAlign: "left" }}>
          <BarChart3 size={14} aria-hidden="true" style={{ verticalAlign: -2 }} /> المخزن والفترة من الفلاتر اللي فوق
        </p>
      </section>
      {tab === "profit" && <ProfitReport />}
      {tab === "velocity" && <VelocityReport />}
      {tab === "stagnant" && <StagnantReport />}
      {tab === "cash" && <CashFlowReport />}
    </>
  );
}
