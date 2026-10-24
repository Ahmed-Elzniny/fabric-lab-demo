// src/components/layout/Topbar.tsx
"use client";

import { Bell, Menu, Monitor, Moon, Search, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import type { Period, WarehouseFilter } from "@/data/selectors";
import { useDemo, type ThemeChoice } from "@/store/DemoProvider";

interface TopbarProps {
  title: string;
  crumb: string;
  alertCount: number;
  onMenu: () => void;
  onAlerts: () => void;
  showFilters?: boolean;
}

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<ThemeChoice, string> = { system: "حسب الجهاز", light: "فاتح", dark: "غامق" };

export function Topbar({ title, crumb, alertCount, onMenu, onAlerts, showFilters = true }: TopbarProps) {
  const { warehouse, setWarehouse, period, setPeriod, can, theme, setTheme, setInventoryQuery, setView } = useDemo();
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="فتح القائمة">
          <Menu size={18} />
        </button>
        <div className="topbar__title">
          <div>
            <div className="topbar__crumb">{crumb}</div>
            <h1>{title}</h1>
          </div>
        </div>

        <div className="topbar__filters" hidden={!showFilters}>
          <Segmented<WarehouseFilter>
            label="المخزن"
            value={warehouse}
            onChange={setWarehouse}
            options={[
              { value: "all", label: "كل المخازن", disabled: !can.seeAllWarehouses },
              {
                value: "kerdasa",
                label: (
                  <>
                    <span className="wh-dot wh-dot--kerdasa" aria-hidden="true" />
                    كرداسة
                  </>
                ),
              },
              {
                value: "mahalla",
                label: (
                  <>
                    <span className="wh-dot wh-dot--mahalla" aria-hidden="true" />
                    المحلة
                  </>
                ),
                disabled: !can.seeAllWarehouses,
              },
            ]}
          />
          <Segmented<Period>
            label="الفترة"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: "النهارده" },
              { value: "7d", label: "7 أيام" },
              { value: "30d", label: "30 يوم" },
              { value: "90d", label: "90 يوم" },
            ]}
          />
        </div>

        <div className="topbar__tools">
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement | null;
              const q = input?.value.trim() ?? "";
              if (!q) return;
              setInventoryQuery(q);
              setView("inventory");
              if (input) input.value = "";
            }}
          >
            <Search size={16} aria-hidden="true" />
            <label htmlFor="global-search" className="sr-only">
              بحث بكود التوب أو رقم الطبخة أو الصنف
            </label>
            <input id="global-search" name="q" type="search" dir="auto" placeholder="ابحث بكود التوب، الطبخة، أو الصنف" autoComplete="off" />
          </form>
          <button type="button" className="icon-btn" onClick={onAlerts} aria-label={`التنبيهات (${alertCount})`}>
            <Bell size={18} />
            {alertCount > 0 && <span className="icon-btn__dot num">{alertCount}</span>}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme(THEME_NEXT[theme])}
            aria-label={`المظهر: ${THEME_LABEL[theme]} — اضغط للتغيير`}
            title={`المظهر: ${THEME_LABEL[theme]}`}
          >
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
