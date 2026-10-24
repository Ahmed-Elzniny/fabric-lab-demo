// src/features/dashboard/AlertsCard.tsx
"use client";

import { BellRing, Clock3, HardHat, Layers, PackageX, Palette } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import type { AlertKind, DashboardAlert } from "@/data/selectors";

const ICON: Record<AlertKind, ReactNode> = {
  lot_low: <Layers size={16} />,
  overdue: <Clock3 size={16} />,
  missing_color: <Palette size={16} />,
  stagnant: <PackageX size={16} />,
  advance_high: <HardHat size={16} />,
};

const SEVERITY_LABEL = { critical: "عاجل", warning: "متابعة", info: "معلومة" } as const;

export const AlertsCard = forwardRef<HTMLDivElement, { alerts: DashboardAlert[] }>(function AlertsCard({ alerts }, ref) {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  return (
    <div ref={ref} className="span-4" style={{ display: "flex", minWidth: 0 }} tabIndex={-1} id="alerts">
      <Card
        className="fill"
        icon={<BellRing size={17} />}
        title="تنبيهات النهارده"
        subtitle={critical > 0 ? `${critical} تنبيه عاجل محتاج تصرف` : "مفيش حاجة عاجلة"}
      >
        {alerts.length === 0 ? (
          <p style={{ color: "var(--fg-3)" }}>كله تمام — مفيش تنبيهات.</p>
        ) : (
          <ul className="alerts">
            {alerts.slice(0, 7).map((a) => (
              <li key={a.id} className={`alert alert--${a.severity}`}>
                <span className="alert__icon" aria-hidden="true">
                  {ICON[a.kind]}
                </span>
                <div>
                  <div className="alert__title">
                    {a.title}
                    <span className="alert__tag">{SEVERITY_LABEL[a.severity]}</span>
                  </div>
                  <div className="alert__detail">{a.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
});
