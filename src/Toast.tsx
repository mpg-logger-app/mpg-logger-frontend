import { useEffect } from 'react'

// How long the toast stays up before it dismisses itself.
export const TOAST_DURATION_MS = 1800

export type ToastVariant = 'success' | 'error'

type Props = {
  message: string
  variant: ToastVariant
  onDone: () => void
}

// An iOS-style HUD whose icon draws itself in: a green check mark on success
// (e.g. "Log saved"), or a red cross that shakes on failure (e.g. "Couldn't delete log").
// Give it a new `key` to replay the animation for a repeat message.
export default function Toast({ message, variant, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className={`toast ${variant}`} role="status" aria-live="polite">
      <svg className="toast-icon" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="toast-icon-circle" cx="26" cy="26" r="24" />
        {variant === 'success' ? (
          <path className="toast-icon-mark" d="M15 27l7.5 7.5L37 19" />
        ) : (
          <path className="toast-icon-mark" d="M18 18l16 16M34 18L18 34" />
        )}
      </svg>
      <span>{message}</span>
    </div>
  )
}
