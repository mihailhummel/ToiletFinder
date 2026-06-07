import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/notify";
import { InlineMessage } from "@/components/ui/inline-message";
import { useAddReport } from "@/hooks/useToilets";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { Toilet, ReportReason } from "@/types/toilet";

interface ReportModalProps {
  toilet: Toilet;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal = ({ toilet, isOpen, onClose }: ReportModalProps) => {
  const [reason, setReason] = useState<ReportReason>("doesnt-exist");
  const [comment, setComment] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showOptionalComment, setShowOptionalComment] = useState(false);

  const { user } = useAuth();
  const { t } = useLanguage();
  const addReportMutation = useAddReport();

  const reportReasons: { value: ReportReason; label: string }[] = [
    { value: "doesnt-exist",  label: t("report.reasonDoesntExist") },
    { value: "wrong-details", label: t("report.reasonWrongDetails") },
    { value: "inaccessible",  label: t("report.reasonInaccessible") },
    { value: "closed",        label: t("report.reasonClosed") },
    { value: "other",         label: t("report.reasonOther") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (reason === "wrong-details" && !comment.trim()) {
      setFormError(t("report.detailsLabel"));
      return;
    }

    try {
      await addReportMutation.mutateAsync({
        toiletId: toilet.id,
        userId: user?.uid || "",
        userName: user?.displayName || user?.email || "",
        reason,
        comment: comment.trim() || undefined,
      });

      notify.success(t("report.success"), {
        description: "Thank you for helping improve the community data.",
      });

      handleClose();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to submit report. Please try again."
      );
    }
  };

  const handleClose = () => {
    onClose();
    setReason("doesnt-exist");
    setComment("");
    setFormError(null);
    setShowOptionalComment(false);
  };

  const needsRequiredComment = reason === "wrong-details";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className={cn(
          "w-[min(460px,calc(100vw-2rem))] gap-0 overflow-hidden p-0",
          "rounded-3xl border-0 bg-white shadow-2xl"
        )}
      >
        {/* ── Header ── */}
        <div className="border-b border-slate-100 px-5 py-4">
          <DialogTitle className="text-center text-[15px] font-bold text-slate-900 pr-6">
            {t("report.title")}
          </DialogTitle>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* ── Options ── */}
          <div className="space-y-2 px-4 py-4">
            {reportReasons.map(({ value, label }) => {
              const selected = reason === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setReason(value as ReportReason);
                    setShowOptionalComment(false);
                    setComment("");
                    setFormError(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98]",
                    selected
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/30"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {/* Custom radio circle */}
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      selected
                        ? "border-blue-500 bg-blue-500"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>

                  <span
                    className={cn(
                      "text-[14px] leading-snug font-medium",
                      selected ? "text-blue-700" : "text-slate-700"
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}

            {/* Required comment for "wrong-details" */}
            {needsRequiredComment && (
              <div className="space-y-1.5 pt-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                  {t("report.detailsLabel")}
                </p>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("report.detailsPlaceholder")}
                  rows={3}
                  className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-slate-50 text-[14px] placeholder:text-slate-400 focus-visible:border-red-400 focus-visible:ring-red-400/25"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Optional comment — collapsed by default */}
            {!needsRequiredComment && (
              <div className="pt-1">
                {!showOptionalComment ? (
                  <button
                    type="button"
                    onClick={() => setShowOptionalComment(true)}
                    className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
                  >
                    <span>{t("report.commentOptional")}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <p className="px-1 text-xs font-medium text-slate-500">
                      {t("report.commentOptional")}
                    </p>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={t("report.commentPlaceholder")}
                      rows={3}
                      className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-slate-50 text-[14px] placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}

            {formError && (
              <InlineMessage variant="error">{formError}</InlineMessage>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-11 min-w-0 flex-1 rounded-full border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50"
            >
              {t("button.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={addReportMutation.isPending}
              className="h-11 min-w-0 flex-1 rounded-full bg-red-600 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
            >
              {addReportMutation.isPending
                ? t("report.submitting")
                : t("report.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
