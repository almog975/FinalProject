import { useEffect, useState } from 'react'
import { apiGet, apiGetText, apiUrl } from '../api'
import { StatusBanner } from '../components/StatusBanner'
import type { HealthStatus } from '../types'

export function SystemPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [ready, setReady] = useState<HealthStatus | null>(null)
  const [metrics, setMetrics] = useState<string | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [h, r] = await Promise.all([
          apiGet<HealthStatus>('/health').catch(async () => {
            const res = await fetch(apiUrl('/health'))
            return (await res.json().catch(() => ({ status: 'error' }))) as HealthStatus
          }),
          apiGet<HealthStatus>('/ready').catch(async () => {
            const res = await fetch(apiUrl('/ready'))
            return (await res.json().catch(() => ({ status: 'error' }))) as HealthStatus
          }),
        ])
        if (!cancelled) {
          setHealth(h)
          setReady(r)
        }
        try {
          const text = await apiGetText('/metrics')
          if (!cancelled) {
            const lines = text.split('\n').slice(0, 30).join('\n')
            setMetrics(lines)
            setMetricsError(null)
          }
        } catch (e) {
          if (!cancelled) {
            setMetrics(null)
            setMetricsError(e instanceof Error ? e.message : String(e))
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h2>System</h2>
        <p className="muted">Probe endpoints and observability hints for Minikube demos.</p>
      </header>

      <StatusBanner loading={loading} error={error} />

      {!loading && (
        <>
          <div className="kpi-grid two">
            <section className="card">
              <h3>GET /health</h3>
              <pre className="code-block">{JSON.stringify(health, null, 2)}</pre>
            </section>
            <section className="card">
              <h3>GET /ready</h3>
              <pre className="code-block">{JSON.stringify(ready, null, 2)}</pre>
            </section>
          </div>

          <section className="card">
            <h3>Observability</h3>
            <ul className="note-list">
              <li>
                Prometheus metrics are exposed at <code>/metrics</code> on the shop API.
              </li>
              <li>
                Grafana (kube-prometheus-stack):{' '}
                <code>
                  minikube service kube-prometheus-stack-grafana -n monitoring --url
                </code>
              </li>
            </ul>
          </section>

          <section className="card">
            <h3>/metrics snippet</h3>
            {metricsError && (
              <p className="muted">Could not fetch metrics: {metricsError}</p>
            )}
            {metrics && <pre className="code-block metrics">{metrics}</pre>}
            {!metrics && !metricsError && <p className="muted">No metrics loaded.</p>}
          </section>
        </>
      )}
    </div>
  )
}
