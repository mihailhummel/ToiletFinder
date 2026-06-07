import * as React from "react"
import { AlertTriangle, type LucideIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

type ConfirmVariant = "default" | "destructive"

export type ConfirmOptions = {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
  /** Optional lucide icon shown in the header. Defaults to a warning for destructive. */
  icon?: LucideIcon
}

type ConfirmState =
  | (ConfirmOptions & {
      id: number
      open: boolean
      resolve: (value: boolean) => void
    })
  | null

// Module-level store + listeners, mirroring the toast singleton in
// `hooks/use-toast.ts`. This lets `confirmDialog()` be called imperatively
// from anywhere — including the Leaflet popup `window.*` handlers in Map.tsx
// that run outside any React render context.
let memoryState: ConfirmState = null
const listeners: Array<(state: ConfirmState) => void> = []
let count = 0

function emit() {
  listeners.forEach((listener) => listener(memoryState))
}

/**
 * Promise-based replacement for the native `window.confirm()`.
 * Resolves `true` when confirmed, `false` on cancel / dismiss / escape.
 *
 *   if (await confirmDialog({ title: "Delete this?", variant: "destructive" })) {
 *     // ...proceed
 *   }
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    memoryState = { ...options, id: ++count, open: true, resolve }
    emit()
  })
}

function settle(result: boolean) {
  const current = memoryState
  if (!current || !current.open) return

  // Animate the dialog closed first, then clear the state once the close
  // transition has finished (guard by id so a freshly-opened dialog isn't wiped).
  const closingId = current.id
  memoryState = { ...current, open: false }
  emit()
  current.resolve(result)

  window.setTimeout(() => {
    if (memoryState && memoryState.id === closingId) {
      memoryState = null
      emit()
    }
  }, 200)
}

export function ConfirmDialogHost() {
  const [state, setState] = React.useState<ConfirmState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  const open = !!state?.open
  const isDestructive = state?.variant === "destructive"
  const Icon = state?.icon ?? (isDestructive ? AlertTriangle : undefined)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false)
      }}
    >
      <AlertDialogContent
        className="w-[min(24rem,calc(100vw-2rem))] max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
        onOverlayClick={() => settle(false)}
        onPointerDownOutside={() => settle(false)}
      >
        <AlertDialogHeader className="items-center text-center">
          {Icon && (
            <div
              className={cn(
                "mx-auto mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                isDestructive ? "bg-red-100 text-red-600" : "bg-sky-100 text-sky-600"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            </div>
          )}
          <AlertDialogTitle className="text-lg">{state?.title}</AlertDialogTitle>
          {state?.description && (
            <AlertDialogDescription className="text-[15px] leading-relaxed">
              {state.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-3 flex flex-row items-stretch justify-stretch gap-3 sm:justify-end">
          <AlertDialogCancel
            onClick={() => settle(false)}
            className="mt-0 h-11 min-w-0 flex-1 rounded-full border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 sm:flex-none sm:px-4"
          >
            {state?.cancelText ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-full px-3 text-sm sm:flex-none sm:px-4",
              isDestructive &&
                "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
            )}
          >
            {state?.confirmText ?? "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
