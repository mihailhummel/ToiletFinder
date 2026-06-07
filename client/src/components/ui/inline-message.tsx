import * as React from "react"
import { CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type InlineMessageVariant = "error" | "success" | "info"

const variantStyles: Record<
  InlineMessageVariant,
  { box: string; icon: LucideIcon; iconClass: string }
> = {
  error: {
    box: "border-red-200 bg-red-50 text-red-800",
    icon: XCircle,
    iconClass: "text-red-500",
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Info,
    iconClass: "text-sky-500",
  },
}

export interface InlineMessageProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: InlineMessageVariant
}

/**
 * Small, soft, tinted feedback box for embedding *inside* forms and modals
 * (validation errors, submit failures, etc.) — the inline half of the app's
 * hybrid feedback model. For anchorless map-level feedback use `notify.*`.
 */
export const InlineMessage = React.forwardRef<HTMLDivElement, InlineMessageProps>(
  ({ variant = "error", className, children, ...props }, ref) => {
    const styles = variantStyles[variant]
    const Icon = styles.icon

    return (
      <div
        ref={ref}
        role={variant === "error" ? "alert" : "status"}
        className={cn(
          "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
          styles.box,
          className
        )}
        {...props}
      >
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", styles.iconClass)}
          aria-hidden="true"
        />
        <span className="leading-snug">{children}</span>
      </div>
    )
  }
)
InlineMessage.displayName = "InlineMessage"
