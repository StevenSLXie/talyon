'use client'

import { useEffect } from 'react'

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker on app initialization
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration.scope)
        })
        .catch((error) => {
          console.warn('Service Worker registration failed:', error)
        })
    }
  }, [])

  return <>{children}</>
}
