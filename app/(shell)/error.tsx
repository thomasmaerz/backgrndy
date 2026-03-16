'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-app p-8">
      <div className="max-w-md w-full bg-bg-surface border border-bg-border rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-text-base mb-4">Something went wrong</h2>
        <p className="text-text-muted mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
