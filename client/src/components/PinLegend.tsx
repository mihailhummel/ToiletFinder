import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

// Canonical map-pin colours (must match the markers rendered in Map.tsx /
// the Guides legend in NavMenu.tsx).
export const PIN_COLORS = {
  babyChanging: "#ff66c4",
  gasStation: "#ff3131",
  public: "#5170ff",
  mall: "#38b6ff",
  cafe: "#ffbd59",
  portable: "#00bf63",
  other: "#ad52ec",
} as const;

// A small teardrop "WC" pin, matching the real map markers.
export const LegendPin: React.FC<{ color: string }> = ({ color }) => (
  <div className="relative w-[30px] h-[30px] flex-shrink-0 flex items-center justify-center">
    <div
      className="w-[30px] h-[30px] rounded-[50%_50%_0_50%] rotate-45 flex items-center justify-center shadow-[inset_0_-2px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/5"
      style={{ backgroundColor: color }}
    >
      <div className="w-[22px] h-[22px] bg-white rounded-full -rotate-45 flex items-center justify-center relative">
        <span className="text-[9px] font-extrabold text-slate-800 leading-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] tracking-tight">
          WC
        </span>
      </div>
    </div>
  </div>
);

// Compact 2-column legend of every pin type. Used by the welcome modal and
// available for the Guides menu. Fits without scrolling on mobile.
export const PinLegend: React.FC = () => {
  const { t } = useLanguage();

  const items: { color: string; label: string }[] = [
    { color: PIN_COLORS.public, label: t("guides.legend.public") },
    { color: PIN_COLORS.mall, label: t("guides.legend.mall") },
    { color: PIN_COLORS.gasStation, label: t("guides.legend.gasStation") },
    { color: PIN_COLORS.cafe, label: t("guides.legend.cafe") },
    { color: PIN_COLORS.portable, label: t("guides.legend.portable") },
    { color: PIN_COLORS.babyChanging, label: t("guides.legend.babyChanging") },
    { color: PIN_COLORS.other, label: t("guides.legend.other") },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100"
        >
          <LegendPin color={item.color} />
          <span className="text-[12px] font-bold text-slate-700 leading-tight">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};
