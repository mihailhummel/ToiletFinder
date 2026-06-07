import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Lightweight, soft & friendly confirmation modal for the blog admin.
 * Replaces native window.confirm(). Self-contained (framer-motion only),
 * driven by `open` + callbacks from the parent.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Потвърди",
  cancelText = "Отказ",
  variant = "default",
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const isDestructive = variant === "destructive";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                isDestructive
                  ? "bg-red-100 text-red-600"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              <AlertTriangle size={22} />
            </div>

            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {message && (
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                {message}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-300 px-5 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-full px-5 py-2 font-semibold text-white shadow-sm transition-colors ${
                  isDestructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
