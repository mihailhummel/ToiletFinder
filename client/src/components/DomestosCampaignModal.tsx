import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Domestos campaign modal — opens like the WelcomeModal (centered Dialog, not a
 * bottom sheet). Shown once to new visitors (campaign → then welcome) and
 * re-openable from the floating campaign button / branded popups
 * (window.openDomestosModal → App.tsx).
 *
 * Bulgarian-only. Sizing is tuned small for mobile. Section headers + step
 * titles use the Domestos navy. Copy may still be edited.
 */
interface DomestosCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAVY = "#011E62"; // matches the Domestos badge navy
const BLUE = "#2D6BFF";
const RED = "#FF3B4E";

const steps = [
  {
    n: 1,
    title: "Добавяй или оценявай локации",
    //body: "Добави нова локация или оцени място, което вече си посетил. Така ще помогнеш за изграждането на карта, базирана на реалния потребителски опит и препоръки.",
    body: "Добави нова локация или оцени място, което вече си посетил.",
  },
  {
    n: 2,
    title: "Помогни и на други хора",
    //body: "Сподели своята оценка и помогни на други потребители по-лесно да се ориентират и да откриват тоалетни в София. Заедно можем да отличим добрите примери и да насърчим по-добри хигиенни стандарти в публичните пространства.",
    body: "Сподели своята оценка и помогни на други потребители по-лесно да се ориентират и да откриват тоалетни в София.",
  },
  {
    n: 3,
    title: "Участвай за награди от Domestos",
    body: "Всички участници се включват в теглене за 10 продуктови комплекта от Domestos, а 10-те локации с най-висок рейтинг ще получат специално отличие и продуктова подкрепа от Domestos до края на годината.",
  },
];

export const DomestosCampaignModal = ({ isOpen, onClose }: DomestosCampaignModalProps) => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-[9999] flex max-h-[calc(100dvh-48px)] w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-3xl border border-slate-200 p-0 sm:max-w-[480px]">
        {/* Header */}
        <div
          className="relative flex shrink-0 items-center gap-1.5 border-b border-slate-100 pb-3 pt-4 pl-2 pr-9"
          style={{ background: "linear-gradient(135deg, rgba(45,107,255,0.10), #ffffff 55%, rgba(255,59,78,0.08))" }}
        >
          <img
            src="/domestos-pin.png"
            alt="Domestos"
            className="h-[50px] w-[50px] shrink-0 object-contain drop-shadow"
          />
          <DialogTitle className="text-[15px] font-bold leading-snug tracking-tight text-slate-900">
            <span className="font-black">Domestos</span> и{" "}
            <img
              src="/logo.png"
              alt="toaletna.com"
              className="mx-0.5 inline-block h-[15px] w-auto -translate-y-px align-middle"
            />
            <span className="font-black">toaletna.com</span> обединяват сили в инициатива за по-чисти тоалетни в България.
          </DialogTitle>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 text-left text-slate-800" style={{ scrollbarWidth: "none" }}>
          {/* За инициативата (collapsible) */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/80">
            <button
              onClick={() => setAboutOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100/60"
            >
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: NAVY }}>
                За инициативата
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aboutOpen ? "rotate-180" : ""}`} />
            </button>
            {aboutOpen && (
              <div className="px-3.5 pb-3.5">
                {/* Key visual — constrained width (not full-bleed), centered */}
                <img
                  src="/domestos-kv.jpg"
                  alt="София вече има карта на тоалетните — toaletna.com x Domestos"
                  className="mx-auto mb-3 block w-[78%] max-w-[260px] rounded-xl border border-slate-200 shadow-sm"
                />
                <div className="space-y-2 text-[11.5px] leading-relaxed text-slate-700">
                  <p>Намирането на чиста тоалетна в града често е въпрос на късмет. Или на добри препоръки между приятели. А когато си навън, в движение или с деца, това става особено важно.</p>
                  <p>Сега <strong>Domestos</strong> и <strong>toaletna.com</strong> – първата карта на тоалетните в България, заедно стартират инициатива, за да насърчат хората да откриват, добавят и оценяват различни локации в София, изграждайки карта, базирана на реалния потребителски опит.</p>
                  <p>От 29.06 до 30.08.2026 г. потребителите ще могат активно да оценяват и добавят различни софийски локации в платформата, а 10-те най-високо оценени тоалетни ще получат специално отличие от Domestos и продуктова подкрепа за поддържане на хигиената до края на годината.</p>
                  <p>Освен че ще помага на хората по-лесно да намират чисти и поддържани тоалетни, инициативата има за цел и да насърчи по-добри хигиенни стандарти в публичните пространства.</p>
                </div>
              </div>
            )}
          </div>

          {/* Как да участваш */}
          <div className="space-y-2.5">
            <h3 className="px-1 text-[11px] font-black uppercase tracking-wider" style={{ color: NAVY }}>
              Как да участваш
            </h3>
            {steps.map((s) => (
              <div key={s.n} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${BLUE}, ${RED})` }}
                >
                  {s.n}
                </div>
                <div className="min-w-0">
                  <h4 className="mb-0.5 text-[12px] font-bold uppercase leading-tight tracking-wide" style={{ color: NAVY }}>
                    {s.title}
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </div>
            ))}

            {/* Eligibility */}
            <p className="px-1 text-[10.5px] leading-relaxed text-slate-500">
              За валидно участие е необходимо да бъде извършено поне едно действие (добавяне или оценяване на локация) в периода на кампанията. Участието не е обвързано с покупка на продукт и е отворено за всички лица над 18 години, пребиваващи на територията на Република България.
            </p>
          </div>

          {/* Организатор (collapsible) */}
          <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-slate-100/70">
            <button
              onClick={() => setOrganizerOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-slate-200/50"
            >
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: NAVY }}>
                Организатор
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${organizerOpen ? "rotate-180" : ""}`} />
            </button>
            {organizerOpen && (
              <div className="px-3.5 pb-3.5 text-[10px] leading-relaxed text-slate-500">
                <p>
                  Кампанията е организирана от Юниливър България ЕООД със седалище и адрес на управление: Младост 4, Бизнес Парк София, сграда 4, ет. 5, 1715 София, Идентификационен № 121796402, ДДС № BG121796402, и от фирма „Би Плюс Ар” ООД със седалище и адрес на управление: гр. София, ул. Иван Денкоглу 26, ет. 2, ЕИК 203772137, наричани заедно „Организатор“. Организаторът си запазва правото да премахва дублиращи се, неверни или злонамерени записи.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-slate-100 bg-white p-3">
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-[12.5px] font-black uppercase tracking-wider text-white shadow-md transition-all hover:shadow-lg active:scale-[0.99]"
            style={{ background: `linear-gradient(90deg, ${BLUE}, ${RED})` }}
          >
            Разбрах, към картата
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
