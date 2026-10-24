// src/features/settings/SettingsPage.tsx
"use client";

// الإعدادات والصلاحيات: بيانات النشاط، المستخدمين، جدول الصلاحيات، أسعار الأصناف، وسجل العمليات.
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  Check,
  ClipboardCheck,
  HandCoins,
  History,
  KeyRound,
  Minus,
  PackagePlus,
  Receipt,
  Tags,
  Truck,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { activityLog, type ActivityKind } from "@/data/activity";
import { BUSINESS, USERS } from "@/data/catalog";
import type { WarehouseId } from "@/data/types";
import { daysAgoLabel, fmtDayMonth, fmtMoney } from "@/lib/format";
import { diffDays } from "@/lib/dates";
import { useDemo } from "@/store/DemoProvider";

const WH: Record<WarehouseId, string> = { kerdasa: "كرداسة", mahalla: "المحلة" };
type Tab = "users" | "permissions" | "prices" | "log";
type Access = "yes" | "own" | "no";

const ROLE_LABEL = { owner: "المالك", accountant: "محاسب", storekeeper: "أمين مخزن" } as const;

const PERMISSIONS: { area: string; owner: Access; accountant: Access; storekeeper: Access }[] = [
  { area: "لوحة التحكم", owner: "yes", accountant: "own", storekeeper: "own" },
  { area: "فواتير البيع", owner: "yes", accountant: "own", storekeeper: "own" },
  { area: "هامش الربح وتكلفة البضاعة", owner: "yes", accountant: "yes", storekeeper: "no" },
  { area: "تعدّي حد ائتمان العميل", owner: "yes", accountant: "no", storekeeper: "no" },
  { area: "استلام بضاعة (الكميات والأطوال)", owner: "yes", accountant: "own", storekeeper: "own" },
  { area: "أسعار الشراء والدفع للمورد", owner: "yes", accountant: "yes", storekeeper: "no" },
  { area: "التحويلات بين المخازن", owner: "yes", accountant: "own", storekeeper: "own" },
  { area: "تحصيل من العملاء", owner: "yes", accountant: "own", storekeeper: "own" },
  { area: "الخزنة: مصروف وتقفيل يومية", owner: "yes", accountant: "own", storekeeper: "own" },
  { area: "تحويل نقدية بين الخزن", owner: "yes", accountant: "no", storekeeper: "no" },
  { area: "العمالة والمرتبات والسلف", owner: "yes", accountant: "own", storekeeper: "no" },
  { area: "الموردين وأرصدتهم", owner: "yes", accountant: "yes", storekeeper: "no" },
  { area: "التقارير", owner: "yes", accountant: "yes", storekeeper: "no" },
  { area: "الإعدادات وتعديل الأسعار", owner: "yes", accountant: "no", storekeeper: "no" },
];

const ACCESS_META: Record<Access, { label: string; cls: string; Icon: LucideIcon }> = {
  yes: { label: "كامل", cls: "chip--good", Icon: Check },
  own: { label: "مخزنه بس", cls: "chip--info", Icon: Minus },
  no: { label: "ممنوع", cls: "chip--flat", Icon: X },
};

const ACT_ICON: Record<ActivityKind, LucideIcon> = {
  sale: Receipt,
  purchase: PackagePlus,
  transfer: Truck,
  receive: ArrowLeftRight,
  collection: HandCoins,
  cash: Banknote,
  payroll: Wallet,
  advance: HandCoins,
  closing: ClipboardCheck,
  expense: Receipt,
  supplier: Banknote,
};

function PriceRow({ itemId }: { itemId: string }) {
  const { ds, ix, updateItemPrice, notify } = useDemo();
  const item = ds.items.find((i) => i.id === itemId)!;
  const [val, setVal] = useState(String(item.salePrice));
  // متوسط تكلفة المخزون المتاح من الصنف
  const avgCost = useMemo(() => {
    let q = 0;
    let v = 0;
    for (const r of ds.rolls) {
      if (r.itemId !== itemId || r.status !== "available") continue;
      q += r.quantity;
      v += r.quantity * (ix.lotById.get(r.lotId)?.unitCost ?? 0);
    }
    return q > 0 ? v / q : item.baseCost;
  }, [ds, ix, itemId, item.baseCost]);
  const price = Number(val) || 0;
  const margin = price > 0 ? ((price - avgCost) / price) * 100 : 0;
  const dirty = price !== item.salePrice;
  const unit = item.unit === "kg" ? "كيلو" : "متر";

  const save = () => {
    try {
      updateItemPrice(itemId, price);
      notify(`سعر ${item.name} بقى ${fmtMoney(price)} لل${unit} — هيظهر في الفواتير الجديدة.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "حصلت مشكلة.");
      setVal(String(item.salePrice));
    }
  };

  return (
    <tr>
      <td>
        <div className="t-strong">{item.name}</div>
        <div className="t-muted">
          {item.season === "winter" ? "شتوي" : "صيفي"} · بال{unit} · {item.colorIds.length} لون
        </div>
      </td>
      <td className="t-num t-muted">{fmtMoney(avgCost)}</td>
      <td>
        <span className="field__input field__input--sm">
          <input
            id={`price-set-${item.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dirty && price > 0 && save()}
            aria-label={`سعر بيع ${item.name}`}
          />
          <em>ج.م</em>
        </span>
      </td>
      <td>
        <span className={`chip ${margin < 5 ? "chip--crit" : margin < 10 ? "chip--warn" : "chip--good"} num`}>{margin.toFixed(1)}٪</span>
      </td>
      <td>
        {dirty && (
          <div className="toolbar__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={!(price > 0)}>
              حفظ
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setVal(String(item.salePrice))}>
              تراجع
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function SettingsPage() {
  const { ds, ix, setRole, role } = useDemo();
  const [tab, setTab] = useState<Tab>("users");
  const log = useMemo(() => activityLog(ds, ix), [ds, ix]);

  return (
    <>
      <section className="card biz">
        <div className="biz__main">
          <span className="tenant__badge biz__badge" aria-hidden="true">
            {BUSINESS.initials}
          </span>
          <div>
            <h2>{BUSINESS.name}</h2>
            <p className="t-muted">{BUSINESS.owner} · تجارة أقمشة بالجملة · البيع بالتوب</p>
          </div>
        </div>
        <div className="biz__whs">
          {ds.warehouses.map((w) => (
            <div key={w.id} className={`route-pick__wh route-pick__wh--${w.id}`}>
              <small>
                <Building2 size={12} aria-hidden="true" /> {w.city}
              </small>
              <b>
                <span className={`wh-dot wh-dot--${w.id}`} aria-hidden="true" /> {w.name}
              </b>
              <small>أمين المخزن: {w.manager} · خزنة منفصلة</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card toolbar" aria-label="أقسام الإعدادات">
        <Segmented<Tab>
          label="القسم"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "users",
              label: (
                <>
                  <UsersRound size={14} aria-hidden="true" /> المستخدمين
                </>
              ),
            },
            {
              value: "permissions",
              label: (
                <>
                  <KeyRound size={14} aria-hidden="true" /> الصلاحيات
                </>
              ),
            },
            {
              value: "prices",
              label: (
                <>
                  <Tags size={14} aria-hidden="true" /> الأصناف والأسعار
                </>
              ),
            },
            {
              value: "log",
              label: (
                <>
                  <History size={14} aria-hidden="true" /> سجل العمليات ({log.length})
                </>
              ),
            },
          ]}
        />
      </section>

      {tab === "users" && (
        <section className="card">
          <div className="card__body" style={{ paddingTop: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">المستخدم</th>
                    <th scope="col">الدور</th>
                    <th scope="col">المخزن</th>
                    <th scope="col">آخر دخول</th>
                    <th scope="col">
                      <span className="sr-only">إجراء</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {USERS.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="t-strong">{u.name}</div>
                        <div className="t-muted ltr num">{u.phone}</div>
                      </td>
                      <td>
                        <span className={`chip ${u.role === "owner" ? "chip--good" : u.role === "accountant" ? "chip--info" : "chip--flat"}`}>{u.title}</span>
                      </td>
                      <td>
                        {u.warehouse ? (
                          <span className={`chip chip--${u.warehouse}`}>
                            <span className={`wh-dot wh-dot--${u.warehouse}`} aria-hidden="true" /> {WH[u.warehouse]}
                          </span>
                        ) : (
                          <span className="t-muted">كل المخازن</span>
                        )}
                      </td>
                      <td className="t-muted">{u.lastSeen}</td>
                      <td>
                        {u.id === "u2" && role === "owner" && (
                          <button type="button" className="btn btn--outline btn--sm" onClick={() => setRole("storekeeper")}>
                            جرّب الدخول بيه
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pnl__note">الديمو فيه دورين للتجربة (المالك وأمين مخزن كرداسة). دور المحاسب موجود في جدول الصلاحيات وهيتفعّل في النسخة الحقيقية.</p>
          </div>
        </section>
      )}

      {tab === "permissions" && (
        <section className="card">
          <div className="card__body" style={{ paddingTop: 0 }}>
            <div className="table-wrap">
              <table className="table perm-table">
                <thead>
                  <tr>
                    <th scope="col">الصلاحية</th>
                    {(["owner", "accountant", "storekeeper"] as const).map((r) => (
                      <th key={r} scope="col">
                        {ROLE_LABEL[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p) => (
                    <tr key={p.area}>
                      <td className="t-strong">{p.area}</td>
                      {(["owner", "accountant", "storekeeper"] as const).map((r) => {
                        const m = ACCESS_META[p[r]];
                        return (
                          <td key={r}>
                            <span className={`chip ${m.cls}`}>
                              <m.Icon size={11} aria-hidden="true" /> {m.label}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pnl__note">في النسخة الحقيقية الصلاحيات بتتطبّق في الـ API نفسه — المستخدم مايقدرش يوصل لبيانات مخزن أو شاشة مش من حقه حتى لو حاول من برّه الواجهة.</p>
          </div>
        </section>
      )}

      {tab === "prices" && (
        <section className="card">
          <div className="card__body" style={{ paddingTop: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">الصنف</th>
                    <th scope="col" className="t-num">
                      متوسط تكلفة المخزون
                    </th>
                    <th scope="col">سعر البيع</th>
                    <th scope="col">الهامش</th>
                    <th scope="col">
                      <span className="sr-only">حفظ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ds.items.map((i) => (
                    <PriceRow key={i.id} itemId={i.id} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pnl__note">السعر الجديد بيبقى السعر الافتراضي في فواتير البيع الجديدة، وتقدر تعدّله في أي فاتورة. الفواتير القديمة مابتتغيرش.</p>
          </div>
        </section>
      )}

      {tab === "log" && (
        <section className="card">
          <div className="card__body">
            {log.length === 0 ? (
              <div className="empty">
                <History size={28} aria-hidden="true" />
                <p>لسه مفيش عمليات في الجلسة دي.</p>
                <p className="t-muted">أي فاتورة، أو تحويل، أو تحصيل، أو مصروف هيظهر هنا باسم اللي عمله ووقته.</p>
              </div>
            ) : (
              <ol className="activity">
                {log.map((a) => {
                  const Icon = ACT_ICON[a.kind];
                  return (
                    <li key={a.id}>
                      <span className="activity__icon" aria-hidden="true">
                        <Icon size={15} />
                      </span>
                      <div className="row__main">
                        <div className="row__title">{a.title}</div>
                        <div className="row__sub">
                          <span>{a.detail}</span>
                        </div>
                      </div>
                      <div className="row__value">
                        {a.amount !== undefined ? fmtMoney(a.amount) : ""}
                        <small>
                          {a.who} · {diffDays(ds.today, a.date) === 0 ? "النهارده" : `${fmtDayMonth(a.date)} · ${daysAgoLabel(diffDays(ds.today, a.date))}`}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      )}
    </>
  );
}
