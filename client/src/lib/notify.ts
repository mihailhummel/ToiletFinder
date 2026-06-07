import { toast } from "@/hooks/use-toast"

type NotifyOptions = {
  /** Optional secondary line under the title. */
  description?: string
}

/**
 * Thin, app-wide helper over the toast singleton.
 *
 * Use this only for *anchorless, map-level* feedback that has no on-screen
 * place to live (e.g. "Toilet deleted", "Location found", "Signed out").
 * For validation / errors that happen while a modal or form is open, prefer
 * the inline `<InlineMessage />` component instead.
 *
 * Works from React components AND imperative code (e.g. Leaflet popup
 * `window.*` handlers), because it just calls the module-level `toast()` store.
 */
export const notify = {
  success: (title: string, options?: NotifyOptions) =>
    toast({ title, description: options?.description, variant: "success" }),
  error: (title: string, options?: NotifyOptions) =>
    toast({ title, description: options?.description, variant: "error" }),
  info: (title: string, options?: NotifyOptions) =>
    toast({ title, description: options?.description, variant: "info" }),
}

export type { NotifyOptions }
