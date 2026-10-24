// src/features/dashboard/AssortmentCard.tsx
"use client";

// جاهزية التشكيلات: العميل غالباً بياخد الصنف بأكتر من لون (كلها أو بعضها)،
// فاللون الناقص ممكن يضيّع بيعة. الكارت ده بيوري الألوان المتاحة من نظرة.
import { Palette, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import type { AssortmentRow } from "@/data/selectors";
import type { WarehouseId } from "@/data/types";

interface Props {
  byWarehouse: Record<WarehouseId, AssortmentRow[]>;
  initial: WarehouseId;
  lockedTo?: WarehouseId;
}

const LOW = 2;

export function AssortmentCard({ byWarehouse, initial, lockedTo }: Props) {
  const [wh, setWh] = useState<WarehouseId>(lockedTo ?? initial);
  const active = lockedTo ?? wh;
  const rows = byWarehouse[active];
  const inSeason = rows.filter((r) => r.inSeason);
  const fullyReady = inSeason.filter((r) => r.complete === r.total && r.cells.every((c) => c.rolls > LOW)).length;

  return (
    <Card
      className="span-8"
      icon={<Palette size={17} />}
      title="جاهزية التشكيلات"
      subtitle={`${fullyReady} من ${inSeason.length} أصناف الموسم متاحة بكل ألوانها`}
      actions={
        !lockedTo && (
          <Segmented<WarehouseId>
            label="مخزن التشكيلات"
            size="sm"
            value={active}
            onChange={setWh}
            options={[
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
              },
            ]}
          />
        )
      }
      footer={
        <div className="assort-key">
          <span>
            <i style={{ background: "var(--fg-3)" }} /> الرقم = عدد التواب المتاحة من اللون
          </span>
          <span>
            <i style={{ background: "var(--warn)" }} /> {LOW} توب أو أقل
          </span>
          <span>
            <i style={{ border: "1.5px dashed var(--crit)" }} /> اللون خلص
          </span>
        </div>
      }
    >
      <div className="assort">
        {rows.map((row) => (
          <div key={row.itemId} className={`assort__row ${row.inSeason ? "" : "assort__row--off"}`}>
            <div className="assort__name">
              <strong>{row.name}</strong>
              <span>
                {row.season === "winter" ? <Snowflake size={11} aria-hidden="true" /> : <Sun size={11} aria-hidden="true" />}
                {row.season === "winter" ? "شتوي" : "صيفي"}
                {row.inSeason ? (row.season === "winter" ? " · بالكيلو" : " · بالمتر") : " · خارج الموسم"}
              </span>
            </div>
            <div className="swatches">
              {row.cells.map((c) => {
                const state = c.rolls === 0 ? "out" : c.rolls <= LOW ? "low" : "ok";
                return (
                  <div
                    key={c.colorId}
                    className={`swatch swatch--${state}`}
                    title={`${c.name}: ${c.rolls === 0 ? "خلص" : `${c.rolls} توب`}`}
                  >
                    <span className="swatch__chip" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                    <span className="swatch__count num">{c.rolls === 0 ? "×" : c.rolls}</span>
                    <span className="sr-only">
                      {c.name} {c.rolls === 0 ? "خلص" : `${c.rolls} توب`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="assort__score">
              <strong>
                {row.complete}/{row.total}
              </strong>
              لون متاح
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
