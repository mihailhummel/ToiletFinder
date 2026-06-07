import { CheckCircle2, XCircle, Info, type LucideIcon } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const variantIcon: Record<string, { Icon: LucideIcon; className: string } | null> = {
  success: { Icon: CheckCircle2, className: "text-emerald-600" },
  error: { Icon: XCircle, className: "text-red-600" },
  destructive: { Icon: XCircle, className: "text-red-600" },
  info: { Icon: Info, className: "text-sky-600" },
  default: null,
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const icon = variantIcon[variant ?? "default"]

        return (
          <Toast key={id} variant={variant} {...props}>
            {icon && (
              <icon.Icon
                className={cn("h-5 w-5 shrink-0", icon.className)}
                aria-hidden="true"
              />
            )}
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
