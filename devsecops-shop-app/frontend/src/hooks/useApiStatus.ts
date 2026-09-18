import { useEffect, useState } from 'react'
import { apiUrl } from '../api'
import type { HealthStatus } from '../types'

async function pollStatus(path: '/health' | '/ready'): Promise<HealthStatus> {
  try {
    const res = await fetch(apiUrl(path))
    const body = (await res.json().catch(() => ({}))) as HealthStatus
    if (!res.ok) {
      return { status: body.status || 'error', error: body.error }
    }
    return body
  } catch {
    return { status: path === '/health' ? 'down' : 'not_ready' }
  }
}

/** Poll /health and /ready every 5s for the top-bar pills. */
export function useApiStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [ready, setReady] = useState<HealthStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      const [h, r] = await Promise.all([pollStatus('/health'), pollStatus('/ready')])
      if (!cancelled) {
        setHealth(h)
        setReady(r)
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { health, ready }
}
