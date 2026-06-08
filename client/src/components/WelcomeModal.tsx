import { Plus, Flag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { PinLegend } from "./PinLegend";

/**
 * Welcome Modal — shown on first visit. Compact, modern, and reflects the real
 * map: a 2-column legend of the actual pin types so mobile users don't scroll.
 *
 * Dev shortcuts: Ctrl+Shift+W show · Ctrl+Shift+R reset first-visit flag.
 */
interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  const { t } = useLanguage();

  const help = [
    { icon: Plus, label: t("welcome.helpAdd"), cls: "text-blue-600 bg-blue-50" },
    { icon: Flag, label: t("welcome.helpReport"), cls: "text-red-600 bg-red-50" },
    { icon: Star, label: t("welcome.helpReview"), cls: "text-amber-500 bg-amber-50" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="z-[9999] w-[calc(100vw-32px)] sm:max-w-[460px] max-h-[calc(100dvh-64px)] overflow-y-auto rounded-3xl border border-slate-200 p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 space-y-0">
          <DialogTitle className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-50">
              <img src="/newlogo.png" alt="Toaletna.com" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-[17px] text-slate-900 leading-tight tracking-tight">
                {t("welcome.title")}
              </div>
              <div className="text-[13px] text-slate-500 font-normal leading-snug">
                {t("welcome.subtitle")}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Pin legend — 2 columns, matches the real map markers */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {t("welcome.pinTypes")}
            </h3>
            <PinLegend />
          </div>

          {/* How to help — 3 compact tiles */}
          <div className="grid grid-cols-3 gap-2">
            {help.map(({ icon: Icon, label, cls }) => (
              <div
                key={label}
                className="flex flex-col items-center text-center gap-1.5 bg-white border border-slate-100 rounded-xl px-1.5 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center ${cls}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-[10.5px] font-semibold text-slate-600 leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Contact */}
          <p className="text-center text-[12px] text-slate-500">
            {t("welcome.contactMe")}{" "}
            <a href="mailto:contact@toaletna.com" className="font-bold text-blue-600 hover:text-blue-700">
              contact@toaletna.com
            </a>
          </p>

          <Button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl"
          >
            {t("welcome.gotIt")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
