// src/features/customers/AgingBar.tsx
// شريط أعمار الديون: كل فترة بلون حالة (أخضر ← أحمر) + اسمها ومبلغها، عشان اللون ميبقاش لوحده.
import { AGING_BUCKETS, type Aging, type AgingBucket } from "@/data/customers";
import { fmtMoney, fmtMoneyShort } from "@/lib/format";

export const AGING_COLOR: Record<AgingBucket, string> = {
  b30: "var(--good)",
  b60: "var(--warn)",
  b90: "var(--serious)",
  b90p: "var(--crit)",
};

export function AgingBar({ aging, size = "md", showLegend = true }: { aging: Aging; size?: "sm" | "md"; showLegend?: boolean }) {
  const total = AGING_BUCKETS.reduce((s, b) => s + aging[b.key], 0);
  if (total <= 0.5) return <span className="t-muted">مفيش مديونية</span>;
  const label = AGING_BUCKETS.filter((b) => aging[b.key] > 0.5)
    .map((b) => `${b.label}: ${fmtMoney(aging[b.key])}`)
    .join("، ");
  return (
    <div className={`aging aging--${size}`}>
      <div className="aging__bar" role="img" aria-label={`أعمار الديون — ${label}`}>
        {AGING_BUCKETS.map((b) =>
          aging[b.key] > 0.5 ? (
            <span key={b.key} style={{ width: `${(aging[b.key] / total) * 100}%`, background: AGING_COLOR[b.key] }} title={`${b.label}: ${fmtMoney(aging[b.key])}`} />
          ) : null,
        )}
      </div>
      {showLegend && (
        <ul className="aging__legend">
          {AGING_BUCKETS.map((b) => (
            <li key={b.key} className={aging[b.key] > 0.5 ? "" : "is-zero"}>
              <i style={{ background: AGING_COLOR[b.key] }} aria-hidden="true" />
              <span>{b.label}</span>
              <b className="num">{fmtMoneyShort(aging[b.key])}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
